"""HindSight HTTP API: a thin layer over backend.engine.

It loads the presets, crops and rotation library, reads the cached NASA data for a preset,
calls run_analysis, and returns the engine output unchanged under "result". No scientific
logic lives here. Run from the project root:

    uvicorn backend.api:app --reload --port 8000
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.data_sources import cache, modis_ndvi, power, soilgrids
from backend.data_sources.errors import DataSourceError
from backend.engine import ENGINE_VERSION, EngineError, run_analysis
from backend.engine.rotation import Y_END, Y_START, rotation_name, schedule
# The request is built exactly as scripts/run_site.py builds it, which is how the saved responses were made.
from scripts.run_site import PRIORITIES, build_request

API_VERSION = "1.0.0"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "backend" / "data"
FRONTEND_DIST = ROOT / "frontend" / "dist"
SAVED_NOTICE = ("Saved output of the HindSight engine, generated earlier from the same cached NASA data. "
                "It is not a fresh analysis.")

log = logging.getLogger("hindsight.api")


def _load_json(path: Path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


PRESETS: list[dict] = _load_json(DATA / "presets.json")
PRESETS_BY_ID = {p["id"]: p for p in PRESETS}
CROPS: list[dict] = _load_json(DATA / "crops.json")
CROPS_BY_ID = {c["id"]: c for c in CROPS}
LIBRARY: list[dict] = _load_json(DATA / "rotations_library.json")

# Place labels for the homepage cards. presets.json has no country field; everything else
# shown on a card (name, coordinates, water, soil, rotation) is read from the preset itself.
PLACE_LABELS = {
    "chakwal": {"place": "Chakwal", "region": "Pothwar Plateau, Punjab", "country": "Pakistan"},
    "sheikhupura": {"place": "Sheikhupura", "region": "Punjab plains", "country": "Pakistan"},
    "ames_iowa": {"place": "Ames", "region": "Iowa", "country": "USA"},
}
PRIORITY_LABELS = {
    "stability": "Stability in bad years", "water_use": "Water use", "forage": "Forage",
    "nitrogen": "Legume share (nitrogen potential)", "erosion": "Ground cover in heavy rain",
    "organic_matter": "Residue (organic matter potential)", "market": "Market suitability",
}


# ---------------------------------------------------------------- cache-only data access
# The homepage must never wait on a slow download, so the demo endpoints only read the cache.

def _climate_cached(lat: float, lon: float) -> dict:
    name = power.cache_file_name(lat, lon)
    if not power._cache_matches(cache.read_cache(name), 1984, 2024):
        raise DataSourceError(power.SOURCE_NAME, f"no cached NASA POWER series ({name})")
    return power.get_daily_climate(lat, lon)  # cache hit: no network


def _soil_cached(lat: float, lon: float) -> tuple[dict | None, str]:
    cached = cache.read_cache(soilgrids.cache_file_name(lat, lon))
    if not isinstance(cached, dict) or "profile" not in cached:
        return None, "not_cached"
    return cached["profile"], ("profile" if cached["profile"] else "no_data")


def _ndvi_point(preset: dict) -> dict:
    return preset.get("ndvi_point") or {"lat": preset["lat"], "lon": preset["lon"]}


def _ndvi_cached(lat: float, lon: float) -> dict | None:
    cached = cache.read_cache(modis_ndvi.cache_file_name(lat, lon))
    if not modis_ndvi._cache_matches(cached, 2001, 2024):
        return None  # get_ndvi_series would start a 30-50 s download; skip the optional check instead
    return modis_ndvi.get_ndvi_series(lat, lon)  # cache hit: no network


# ---------------------------------------------------------------- preset summaries

def _doy_label(doy: int) -> str:
    d = date(2023, 1, 1) + timedelta(days=int(doy) - 1)  # the engine uses a 365-day year
    return f"{d.day} {d.strftime('%b')}"


def _water_label(water: dict) -> str:
    mode = (water or {}).get("mode")
    if mode == "rainfed":
        return "Rainfed"
    if mode == "full":
        return "Irrigated"
    if mode == "limited":
        cap = water.get("seasonal_cap_mm")
        return f"Limited irrigation ({cap} mm cap)" if cap else "Limited irrigation"
    return str(mode or "unknown")


def _data_status(preset: dict) -> dict:
    lat, lon = preset["lat"], preset["lon"]
    pt = _ndvi_point(preset)
    return {
        "nasa_power_cached": power._cache_matches(cache.read_cache(power.cache_file_name(lat, lon)), 1984, 2024),
        "modis_ndvi_cached": modis_ndvi._cache_matches(
            cache.read_cache(modis_ndvi.cache_file_name(pt["lat"], pt["lon"])), 2001, 2024),
        "soilgrids": _soil_cached(lat, lon)[1],
        "saved_response": (DATA / "saved" / f"{preset['id']}_response.json").is_file(),
    }


def _preset_summary(preset: dict) -> dict:
    rot = preset["current_rotation"]
    slots = sorted(rot["slots"], key=lambda s: (s["year_offset"], s["plant_doy"]))
    try:
        rot_name = rotation_name(schedule(rot, CROPS_BY_ID), CROPS_BY_ID)
    except EngineError:
        rot_name = None
    return {
        **preset,  # every original key is passed through unchanged
        "display": PLACE_LABELS.get(preset["id"], {"place": preset["name"], "region": None, "country": None}),
        "water_label": _water_label(preset.get("water")),
        "rotation_name": rot_name,
        "rotation_crops": [{
            "crop_id": s["crop_id"],
            "crop_name": CROPS_BY_ID.get(s["crop_id"], {}).get("name", s["crop_id"]),
            "year_offset": s["year_offset"],
            "plant_doy": s["plant_doy"],
            "plant_date": _doy_label(s["plant_doy"]),
        } for s in slots],
        "data_status": _data_status(preset),
    }


# ---------------------------------------------------------------- analysis

_live_cache: dict[str, dict] = {}
_locks = {pid: threading.Lock() for pid in PRESETS_BY_ID}


def _saved_envelope(preset_id: str, fallback_reason: str | None = None) -> dict | None:
    path = DATA / "saved" / f"{preset_id}_response.json"
    if not path.is_file():
        return None
    result = _load_json(path)
    return {
        "source": "saved",
        "preset_id": preset_id,
        "engine_version": (result.get("meta") or {}).get("engine_version"),
        "notice": SAVED_NOTICE,
        "fallback_reason": fallback_reason,
        "saved_file": path.relative_to(ROOT).as_posix(),
        "request": build_request(PRESETS_BY_ID[preset_id]),  # saved files are produced by run_site with this request
        "result": result,
    }


def _run_live(preset: dict) -> dict:
    lat, lon = preset["lat"], preset["lon"]
    t0 = time.perf_counter()
    climate = _climate_cached(lat, lon)
    soil, soil_status = _soil_cached(lat, lon)
    pt = _ndvi_point(preset)
    ndvi = _ndvi_cached(pt["lat"], pt["lon"])
    request = build_request(preset)
    result = run_analysis(request, climate, soil, CROPS, LIBRARY, ndvi=ndvi)
    json.dumps(result, allow_nan=False)  # strict JSON or fall back to the saved file
    return {
        "source": "live",
        "preset_id": preset["id"],
        "engine_version": result["meta"]["engine_version"],
        "computed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "elapsed_ms": round((time.perf_counter() - t0) * 1000),
        "inputs": {
            "climate": {"source": climate.get("source"), "start": climate.get("start"), "end": climate.get("end"),
                        "grid_note": climate.get("grid_note")},
            "soil": {"used": result["site"]["soil_used"]["source"], "soilgrids": soil_status},
            "ndvi": {"used": ndvi is not None, "point": pt},
        },
        "request": request,
        "result": result,
    }


# ---------------------------------------------------------------- app

app = FastAPI(title="HindSight API", version=API_VERSION,
              description="Thin HTTP layer over the HindSight crop-rotation engine.")

_origins = [o.strip() for o in os.environ.get(
    "HINDSIGHT_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["GET", "POST"], allow_headers=["*"])


def _error(status: int, code: str, detail: str, **extra) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "detail": detail, **extra})


def _unknown(preset_id: str) -> JSONResponse:
    return _error(404, "unknown_preset", f"No preset with id '{preset_id}'.", valid_ids=sorted(PRESETS_BY_ID))


@app.get("/api/health")
def health():
    return {"status": "ok", "api_version": API_VERSION, "engine_version": ENGINE_VERSION,
            "presets": len(PRESETS), "hindcast": {"start_year": Y_START, "end_year": Y_END}}


@app.get("/api/presets")
def presets():
    return {
        "presets": [_preset_summary(p) for p in PRESETS],
        "default_priorities": PRIORITIES,
        "priority_labels": PRIORITY_LABELS,
        "crop_names": {c["id"]: c["name"] for c in CROPS},
        "hindcast": {"start_year": Y_START, "end_year": Y_END, "spin_up_year": Y_START - 1},
        "engine_version": ENGINE_VERSION,
    }


@app.get("/api/demo/{preset_id}")
def demo(preset_id: str):
    if preset_id not in PRESETS_BY_ID:
        return _unknown(preset_id)
    env = _saved_envelope(preset_id)
    if env is None:
        return _error(404, "no_saved_result", f"No saved result for '{preset_id}'.")
    return env


@app.post("/api/analyze/preset/{preset_id}")
def analyze_preset(preset_id: str):
    preset = PRESETS_BY_ID.get(preset_id)
    if preset is None:
        return _unknown(preset_id)
    with _locks[preset_id]:
        if preset_id in _live_cache:  # the engine is deterministic, so a repeat run gives identical output
            return _live_cache[preset_id]
        try:
            env = _run_live(preset)
        except EngineError as exc:
            reason = f"The engine stopped: {exc.message} ({exc.code})"
        except DataSourceError as exc:
            reason = f"Data unavailable: {exc.message}"
        except Exception as exc:  # unexpected runtime problem; the saved result keeps the demo usable
            log.exception("live analysis failed for %s", preset_id)
            reason = f"Unexpected error during analysis ({type(exc).__name__})"
        else:
            _live_cache[preset_id] = env
            return env
    log.warning("falling back to saved result for %s: %s", preset_id, reason)
    env = _saved_envelope(preset_id, fallback_reason=reason)
    if env is None:
        return _error(503, "analysis_unavailable", reason)
    return env


if FRONTEND_DIST.is_dir():  # serve the built homepage when it exists (production-style single process)
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
