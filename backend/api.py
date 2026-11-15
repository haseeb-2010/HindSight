"""HindSight HTTP API: a thin layer over backend.engine.

It validates farmer input, reads weather and soil through the existing data sources, calls
run_analysis, and returns the engine output unchanged under "result". No scientific logic lives
here. Run from the project root:

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

import requests
from fastapi import FastAPI, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend import schemas
from backend.context import climate_context, ndvi_coverage
from backend.data_sources import cache, modis_ndvi, power, soilgrids
from backend.data_sources.errors import DataSourceError
from backend.engine import ENGINE_VERSION, EngineError, run_analysis
from backend.engine.candidates import usable
from backend.engine.rotation import Y_END, Y_START, crop_len, rotation_name, schedule, structure
from backend.engine.soil import resolve_soil
from backend.jobs import STAGES, Job, JobError, JobManager
# The preset request is built exactly as scripts/run_site.py builds it, which is how the saved responses were made.
from scripts.run_site import PRIORITIES, build_request

API_VERSION = "3.0.0"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "backend" / "data"
FRONTEND_DIST = ROOT / "frontend" / "dist"
SAVED_NOTICE = ("Saved output of the HindSight engine, generated earlier from the same cached NASA data. "
                "It is not a fresh analysis.")
DEFAULT_MARKET_RATING = 2  # backend/engine/__init__.py: market.get(crop_id, 2)
SOILGRIDS_LABEL = "SoilGrids — 250 m soil data"
GEOCODE_URL = "https://nominatim.openstreetmap.org/search"
GEOCODE_HEADERS = {"User-Agent": "HindSight/2.0 (crop-rotation decision support; NASA Space Apps Challenge 2026)",
                   "Accept-Language": "en"}

log = logging.getLogger("hindsight.api")


def _load_json(path: Path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


PRESETS: list[dict] = _load_json(DATA / "presets.json")
PRESETS_BY_ID = {p["id"]: p for p in PRESETS}
CROPS: list[dict] = _load_json(DATA / "crops.json")
CROPS_BY_ID = {c["id"]: c for c in CROPS}
LIBRARY: list[dict] = _load_json(DATA / "rotations_library.json")
# The engine's own rule for a crop it will simulate: verified and with a sourced Ky.
USABLE_CROPS = {c["id"] for c in CROPS if usable(c, set(), False)}

# Place labels for the cards. presets.json has no country field; everything else shown on a card
# (name, coordinates, water, soil, rotation) is read from the preset itself.
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

jobs = JobManager()


# ---------------------------------------------------------------- cache-only data access
# The homepage must never wait on a slow download, so the demo endpoints only read the cache.

def _r2(value: float) -> float:
    return round(float(value), 2) + 0.0  # the data sources key their cache on 0.01 degrees


def _power_is_cached(lat: float, lon: float) -> bool:
    return power._cache_matches(cache.read_cache(power.cache_file_name(lat, lon)), 1984, 2024)


def _climate_cached(lat: float, lon: float) -> dict:
    if not _power_is_cached(lat, lon):
        raise DataSourceError(power.SOURCE_NAME, f"no cached NASA POWER series ({power.cache_file_name(lat, lon)})")
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


# ---------------------------------------------------------------- presets and crops

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
        "nasa_power_cached": _power_is_cached(lat, lon),
        "modis_ndvi_cached": modis_ndvi._cache_matches(
            cache.read_cache(modis_ndvi.cache_file_name(pt["lat"], pt["lon"])), 2001, 2024),
        "soilgrids": _soil_cached(lat, lon)[1],
        "saved_response": (DATA / "saved" / f"{preset['id']}_response.json").is_file(),
    }


def _rotation_crops(rot: dict) -> list[dict]:
    slots = sorted(rot["slots"], key=lambda s: (s["year_offset"], s["plant_doy"]))
    return [{
        "crop_id": s["crop_id"],
        "crop_name": CROPS_BY_ID.get(s["crop_id"], {}).get("name", s["crop_id"]),
        "year_offset": s["year_offset"],
        "plant_doy": s["plant_doy"],
        "plant_date": _doy_label(s["plant_doy"]),
    } for s in slots]


def _rotation_name(rot: dict) -> str | None:
    try:
        return rotation_name(schedule(rot, CROPS_BY_ID), CROPS_BY_ID)
    except EngineError:
        return None


def _preset_summary(preset: dict) -> dict:
    rot = preset["current_rotation"]
    return {
        **preset,  # every original key is passed through unchanged
        "display": PLACE_LABELS.get(preset["id"], {"place": preset["name"], "region": None, "country": None}),
        "water_label": _water_label(preset.get("water")),
        "rotation_name": _rotation_name(rot),
        "rotation_crops": _rotation_crops(rot),
        "data_status": _data_status(preset),
    }


def _crop_public(c: dict) -> dict:
    return {"id": c["id"], "name": c["name"], "group": c.get("group"), "family": c.get("family"),
            "is_legume": bool(c.get("is_legume")), "is_forage": bool(c.get("is_forage")),
            "season_type": c.get("season_type"), "season_days": crop_len(c)}


# ---------------------------------------------------------------- analysis

_live_cache: dict[str, dict] = {}
_locks = {pid: threading.Lock() for pid in PRESETS_BY_ID}


_saved_extras_cache: dict[str, dict] = {}


def _climate_inputs(climate: dict, from_cache: bool | None = None) -> dict:
    out = {"source": climate.get("source"), "start": climate.get("start"), "end": climate.get("end"),
           "grid_note": climate.get("grid_note"), "elevation_m": climate.get("elevation_m"),
           "days": len(climate.get("dates") or [])}
    if from_cache is not None:
        out["from_cache"] = from_cache
    return out


def _saved_extras(preset: dict) -> dict:
    """Inputs and yearly context for a saved result, read from the cached data it was generated from."""
    pid = preset["id"]
    if pid not in _saved_extras_cache:
        extras: dict = {"inputs": None, "context": {"climate": None}}
        try:
            climate = _climate_cached(preset["lat"], preset["lon"])
            profile, soil_status = _soil_cached(preset["lat"], preset["lon"])
            pt = _ndvi_point(preset)
            ndvi = _ndvi_cached(pt["lat"], pt["lon"])
            request = build_request(preset)
            extras = {
                "inputs": {
                    "climate": _climate_inputs(climate, from_cache=True),
                    "soil": {"soilgrids": soil_status, "profile": profile},
                    "ndvi": {"used": ndvi is not None, "point": pt, **ndvi_coverage(ndvi)},
                },
                "context": {"climate": climate_context(climate, request.get("scenario"))},
            }
        except Exception:  # the saved result still stands on its own without the extras
            log.exception("could not read cached inputs for the saved result of %s", pid)
        _saved_extras_cache[pid] = extras
    return _saved_extras_cache[pid]


def _saved_envelope(preset_id: str, fallback_reason: str | None = None) -> dict | None:
    path = DATA / "saved" / f"{preset_id}_response.json"
    if not path.is_file():
        return None
    result = _load_json(path)
    extras = _saved_extras(PRESETS_BY_ID[preset_id])
    env = {
        "source": "saved",
        "preset_id": preset_id,
        "engine_version": (result.get("meta") or {}).get("engine_version"),
        "notice": SAVED_NOTICE,
        "fallback_reason": fallback_reason,
        "saved_file": path.relative_to(ROOT).as_posix(),
        "request": build_request(PRESETS_BY_ID[preset_id]),  # saved files are produced by run_site with this request
        "context": extras["context"],
        "result": result,
    }
    if extras["inputs"]:
        soil_used = ((result.get("site") or {}).get("soil_used") or {}).get("source")
        env["inputs"] = {**extras["inputs"], "soil": {**extras["inputs"]["soil"], "used": soil_used}}
    return env


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
            "climate": _climate_inputs(climate, from_cache=True),
            "soil": {"used": result["site"]["soil_used"]["source"], "soilgrids": soil_status, "profile": soil},
            "ndvi": {"used": ndvi is not None, "point": pt, **ndvi_coverage(ndvi)},
        },
        "request": request,
        "context": {"climate": climate_context(climate, request.get("scenario"))},
        "result": result,
    }


def _check_crops(body: schemas.AnalyzeBody | None, rotation: schemas.Rotation, constraints: schemas.Constraints | None = None):
    """Crop ids must be ones the engine will simulate. Returns an error response or None."""
    for s in rotation.slots:
        crop = CROPS_BY_ID.get(s.crop_id)
        if crop is None:
            return _error(422, "unknown_crop", f"'{s.crop_id}' is not a crop HindSight knows.")
        if s.crop_id not in USABLE_CROPS:
            return _error(422, "unsupported_crop",
                          f"{crop['name']} cannot be analysed yet: its crop values have not been verified against a source.")
    if constraints:
        for cid in list(constraints.excluded_crops) + list(constraints.market_rating):
            if cid not in USABLE_CROPS:
                return _error(422, "unknown_crop", f"'{cid}' is not a supported crop.")
    return None


def _matching_preset(loc: schemas.Location) -> dict | None:
    preset = PRESETS_BY_ID.get(loc.preset_id or "")
    if preset and _r2(preset["lat"]) == _r2(loc.lat) and _r2(preset["lon"]) == _r2(loc.lon):
        return preset
    return None  # a moved marker is a custom field: the regional library no longer applies


def _engine_request(body: schemas.AnalyzeBody, preset: dict | None, use_profile: bool) -> dict:
    lat, lon = _r2(body.location.lat), _r2(body.location.lon)
    # With an accepted SoilGrids profile the request carries no texture, so resolve_soil() uses the
    # profile's own sand, clay and organic matter instead of a texture-class default.
    soil = ({"texture_class": None, "organic_matter_level": None, "depth_cm": body.soil.depth_cm} if use_profile
            else body.soil.model_dump())
    return {
        "location": {"lat": lat, "lon": lon, "name": body.location.name or (preset["name"] if preset else None),
                     "preset_id": preset["id"] if preset else None},
        "soil": soil,
        "water": body.water.model_dump(),
        "current_rotation": body.current_rotation.model_dump(),
        "priorities": {**PRIORITIES, **body.priorities},
        "constraints": body.constraints.model_dump(),
        "scenario": body.scenario.model_dump(),
        "options": body.options.model_dump(),
    }


def _gather(job: Job, body: schemas.AnalyzeBody) -> dict:
    """Read everything an analysis of this field needs, once: weather, optional soil profile, stored NDVI."""
    job.enter("prepare")
    lat, lon = _r2(body.location.lat), _r2(body.location.lon)
    preset = _matching_preset(body.location)
    notes: list[str] = []
    if body.location.preset_id and not preset:
        notes.append("The location differs from the demonstration farm, so it was analysed as a custom field.")

    from_cache = _power_is_cached(lat, lon)
    job.enter("weather", "Using the cached NASA POWER record for this location." if from_cache else
              "Downloading 41 years of daily weather from NASA POWER. This can take a minute or more.")
    try:
        climate = power.get_daily_climate(lat, lon)
    except DataSourceError as exc:
        raise JobError("weather_unavailable",
                       f"NASA POWER weather could not be retrieved for {lat:.2f}, {lon:.2f} ({exc.message}). "
                       "The service may be busy; please try again in a moment.") from exc

    job.enter("soil")
    profile, soil_status = None, "not_requested"
    if body.soil_source == "soilgrids":
        profile = soilgrids.get_soil(lat, lon)  # cache first; never raises
        soil_status = _soil_cached(lat, lon)[1] if profile is None else "profile"
        if profile is None:
            soil_status = "no_data" if soil_status == "no_data" else "unavailable"
            notes.append("A SoilGrids profile was not available when the analysis ran, so the soil values "
                         "entered in the form were used instead.")
            job.enter("soil", "No SoilGrids profile was available; using the soil values you entered.")

    pt = _ndvi_point(preset) if preset else {"lat": lat, "lon": lon}
    ndvi = _ndvi_cached(pt["lat"], pt["lon"])  # cached series only; never starts a MODIS download
    return {"preset": preset, "notes": notes, "climate": climate, "from_cache": from_cache, "profile": profile,
            "soil_status": soil_status, "ndvi": ndvi, "ndvi_point": pt}


def _simulate(job: Job, body: schemas.AnalyzeBody, data: dict, t0: float, allow_saved_fallback: bool = True) -> dict:
    """One engine run on already-gathered data. The engine output goes into the envelope unchanged."""
    preset, climate, profile, ndvi = data["preset"], data["climate"], data["profile"], data["ndvi"]
    request = _engine_request(body, preset, use_profile=profile is not None)
    try:
        result = run_analysis(request, climate, profile, CROPS, LIBRARY, ndvi=ndvi)
        json.dumps(result, allow_nan=False)
    except EngineError as exc:
        raise JobError(str(exc.code).lower(), exc.message) from exc
    except Exception as exc:
        # A demonstration farm with untouched settings still has its saved engine output to fall back on.
        if allow_saved_fallback and preset and request == build_request(preset):
            log.exception("job %s failed; using the saved result for %s", job.id, preset["id"])
            env = _saved_envelope(preset["id"], f"Unexpected error during analysis ({type(exc).__name__})")
            if env:
                return env
        raise

    ndvi_check = (result.get("validation") or {}).get("ndvi_check")
    return {
        "source": "live",
        "preset_id": preset["id"] if preset else None,
        "engine_version": result["meta"]["engine_version"],
        "computed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "elapsed_ms": round((time.perf_counter() - t0) * 1000),
        "notes": list(data["notes"]),
        "inputs": {
            "climate": _climate_inputs(climate, from_cache=data["from_cache"]),
            "soil": {"used": result["site"]["soil_used"]["source"], "requested": body.soil_source,
                     "soilgrids": data["soil_status"], "profile": profile},
            "ndvi": {"used": ndvi is not None, "point": data["ndvi_point"], **ndvi_coverage(ndvi),
                     "reason": None if ndvi_check else (
                         "No MODIS NDVI series is stored for this location, so the optional check was skipped."
                         if ndvi is None else
                         "The engine could not compute a correlation: the season index does not vary from year "
                         "to year (as under full irrigation) or fewer than 8 years overlap.")},
        },
        "request": request,
        "context": {"climate": climate_context(climate, request.get("scenario"))},
        "result": result,
    }


def _run_job(job: Job, body: schemas.AnalyzeBody) -> dict:
    t0 = time.perf_counter()
    data = _gather(job, body)
    job.enter("simulate")
    return _simulate(job, body, data, t0)


def _run_compare(job: Job, body: schemas.CompareBody) -> dict:
    """Several engine runs for one field that differ only in scenario or priorities.

    Weather, soil and NDVI are read once and reused, so no data is downloaded twice.
    """
    t0 = time.perf_counter()
    data = _gather(job, body.base)
    variants = []
    for i, v in enumerate(body.variants):
        job.enter("simulate", f"Run {i + 1} of {len(body.variants)}: {v.label}")
        update: dict = {}
        if v.scenario is not None:
            update["scenario"] = v.scenario
        if v.priorities is not None:
            update["priorities"] = {**body.base.priorities, **v.priorities}
        t1 = time.perf_counter()
        env = _simulate(job, body.base.model_copy(update=update), data, t1, allow_saved_fallback=False)
        env["analysis_id"] = f"{job.id}-{v.id}"
        variants.append({"id": v.id, "label": v.label, "envelope": env})
    return {
        "kind": "comparison",
        "computed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "elapsed_ms": round((time.perf_counter() - t0) * 1000),
        "weather_from_cache": data["from_cache"],
        "variants": variants,
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


@app.exception_handler(RequestValidationError)
async def _validation_handler(_request, exc: RequestValidationError):
    detail, fields = schemas.friendly_errors(exc.errors())
    return _error(422, "invalid_request", detail, fields=fields)


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


@app.get("/api/crops")
def crops():
    """Crops the engine will simulate, plus the ones it cannot yet and why."""
    return {
        "crops": [_crop_public(c) for c in CROPS if c["id"] in USABLE_CROPS],
        "unavailable": [{"id": c["id"], "name": c["name"],
                         "reason": "No sourced yield-response (Ky) value yet" if c.get("ky") is None
                         else "Crop values not yet verified against their source"}
                        for c in CROPS if c["id"] not in USABLE_CROPS],
        "default_market_rating": DEFAULT_MARKET_RATING,
        "limits": {"depth_cm": schemas.DEPTH_CM, "seasonal_cap_mm": schemas.CAP_MM,
                   "temp_delta_c": schemas.TEMP_DELTA_C, "precip_factor": schemas.PRECIP_FACTOR,
                   "failure_threshold": schemas.FAILURE_THRESHOLD, "top_n": schemas.TOP_N,
                   "max_slots": schemas.MAX_SLOTS, "max_compare_runs": schemas.MAX_VARIANTS},
        "soil_textures": schemas.TEXTURES,
        "organic_matter_levels": schemas.OM_LEVEL_NAMES,
    }


@app.get("/api/rotation-library")
def rotation_library(preset_id: str | None = None):
    """Regional reference rotations the engine adds as alternatives for a demonstration farm."""
    if preset_id is not None and preset_id not in PRESETS_BY_ID:
        return _unknown(preset_id)
    items = [r for r in LIBRARY if preset_id is None or preset_id in r.get("preset_ids", [])]
    return {"rotations": [{**r, "engine_name": _rotation_name(r), "crops": _rotation_crops(r)} for r in items]}


@app.post("/api/rotation/preview")
def rotation_preview(rotation: schemas.Rotation):
    """Run the engine's own schedule check on a rotation and return its calendar."""
    bad = _check_crops(None, rotation)
    if bad:  # while a farmer edits, an invalid rotation is an ordinary answer rather than a failed request
        return {"valid": False, **json.loads(bad.body)}
    rot = rotation.model_dump()
    try:
        sched = schedule(rot, CROPS_BY_ID)
    except EngineError as exc:
        return {"valid": False, "error": str(exc.code).lower(), "detail": exc.message}
    calendar, struct = structure(sched)
    seasons = []
    for s in sched["slots"]:
        days = crop_len(CROPS_BY_ID[s["crop_id"]])
        end = (s["year_offset"] * 365 + s["plant_doy"] - 1 + days - 1) % sched["N"]
        seasons.append({"crop_id": s["crop_id"], "crop_name": CROPS_BY_ID[s["crop_id"]]["name"],
                        "year_offset": s["year_offset"], "plant_doy": s["plant_doy"],
                        "plant_date": _doy_label(s["plant_doy"]), "season_days": days,
                        "harvest_year_offset": end // 365, "harvest_date": _doy_label(end % 365 + 1)})
    return {"valid": True, "name": rotation_name(sched, CROPS_BY_ID), "cycle_years": sched["C"], "calendar": calendar,
            "seasons": seasons, **struct}


@app.post("/api/soil/lookup")
def soil_lookup(point: schemas.PointBody):
    """Optional SoilGrids profile for a point. A missing profile is a normal answer, not an error."""
    lat, lon = _r2(point.lat), _r2(point.lon)
    profile = soilgrids.get_soil(lat, lon)  # cache first, then one 15 s request; never raises
    status = "profile" if profile else _soil_cached(lat, lon)[1]
    status = {"not_cached": "unavailable"}.get(status, status)
    message = {
        "profile": "SoilGrids has a soil estimate for this location.",
        "no_data": "SoilGrids has no soil data at this location. Please describe the soil yourself.",
        "unavailable": "SoilGrids did not answer just now. You can enter the soil yourself and carry on.",
    }[status]
    return {"status": status, "profile": profile, "lat": lat, "lon": lon, "source_label": SOILGRIDS_LABEL,
            "message": message,
            "depth_note": "SoilGrids was read for 0–30 cm only. It does not tell you how deep the soil is."}


@app.post("/api/soil/resolve")
def soil_resolve(body: schemas.SoilResolveBody):
    """The soil-water values the engine derives for these inputs (its own resolve_soil())."""
    profile = _soil_cached(_r2(body.lat), _r2(body.lon))[0] if body.soil_source == "soilgrids" else None
    req = ({"texture_class": None, "organic_matter_level": None, "depth_cm": body.soil.depth_cm} if profile
           else body.soil.model_dump())
    used = resolve_soil(req, profile)
    return {**{k: v for k, v in used.items() if not k.startswith("_")}, "depth_cm": round(used["_depth_m"] * 100),
            "from_profile": profile is not None,
            "method": "Saxton and Rawls (2006) estimates from texture and organic matter; not a laboratory measurement."}


_geocode_cache: dict[str, list] = {}


@app.get("/api/geocode")
def geocode(q: str = Query(min_length=2, max_length=120)):
    """Place search through OpenStreetMap Nominatim (one request per search; results are cached)."""
    key = " ".join(q.lower().split())
    if key not in _geocode_cache:
        try:
            reply = requests.get(GEOCODE_URL, params={"q": q, "format": "jsonv2", "limit": 5},
                                 headers=GEOCODE_HEADERS, timeout=10)
            reply.raise_for_status()
            rows = reply.json()
        except (requests.exceptions.RequestException, ValueError) as exc:
            log.warning("geocode failed for %r: %s", q, exc)
            return _error(502, "geocode_unavailable",
                          "Place search is not available right now. You can type coordinates or click the map instead.")
        if len(_geocode_cache) > 200:
            _geocode_cache.clear()
        _geocode_cache[key] = [{"name": r.get("display_name"), "lat": _r2(r["lat"]), "lon": _r2(r["lon"])}
                               for r in rows if r.get("lat") and r.get("lon")]
    return {"query": q, "results": _geocode_cache[key], "attribution": "© OpenStreetMap contributors"}


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


@app.post("/api/analyze", status_code=202)
def analyze(body: schemas.AnalyzeBody):
    """Start an analysis for any field. Poll GET /api/analysis/{analysis_id} for its state."""
    bad = _check_body(body)
    if bad:
        return bad
    job = jobs.submit(_run_job, body)
    return {"analysis_id": job.id, "status": job.status, "poll": f"/api/analysis/{job.id}",
            "stages": [{"id": s, "label": label} for s, label in STAGES]}


def _check_body(body: schemas.AnalyzeBody):
    """Checks shared by every analysis request. Returns an error response or None."""
    if body.location.preset_id and body.location.preset_id not in PRESETS_BY_ID:
        return _unknown(body.location.preset_id)
    bad = _check_crops(body, body.current_rotation, body.constraints)
    if bad:
        return bad
    try:  # fail fast on a rotation the engine would reject, before any download starts
        schedule(body.current_rotation.model_dump(), CROPS_BY_ID)
    except EngineError as exc:
        return _error(422, str(exc.code).lower(), exc.message)
    return None


@app.post("/api/scenarios/compare", status_code=202)
def scenarios_compare(body: schemas.CompareBody):
    """Run the same field under several scenarios or priority sets. Poll GET /api/analysis/{analysis_id}."""
    bad = _check_body(body.base)
    if bad:
        return bad
    job = jobs.submit(_run_compare, body)
    return {"analysis_id": job.id, "status": job.status, "poll": f"/api/analysis/{job.id}", "kind": "comparison",
            "variants": [{"id": v.id, "label": v.label} for v in body.variants],
            "stages": [{"id": s, "label": label} for s, label in STAGES]}


@app.get("/api/analysis/{analysis_id}")
def analysis(analysis_id: str):
    job = jobs.get(analysis_id)
    if job is None:
        return _error(404, "unknown_analysis",
                      "This analysis is no longer available. Analyses are kept in memory and are lost when the server restarts.")
    return job.public()


class _SpaFiles(StaticFiles):
    """Serve the built frontend; unknown non-file paths get index.html so client-side routes deep-link."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api") and "." not in path.rsplit("/", 1)[-1]:
                return await super().get_response("index.html", scope)
            raise


if FRONTEND_DIST.is_dir():  # serve the built app when it exists (production-style single process)
    app.mount("/", _SpaFiles(directory=FRONTEND_DIST, html=True), name="frontend")
