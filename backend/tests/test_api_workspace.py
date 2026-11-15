"""Workspace API checks (Phase 02): crops, rotation preview, soil, and analysis jobs.
No test touches the network: weather for custom points and SoilGrids failures are patched in."""
import copy
import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
pytestmark = pytest.mark.skipif(not (ROOT / "backend/data/cache/power_32.93_72.86.json").exists(), reason="no NASA cache")

from fastapi.testclient import TestClient  # noqa: E402
from backend import api  # noqa: E402
from backend.data_sources.errors import DataSourceError  # noqa: E402

client = TestClient(api.app)
IDS = ["chakwal", "sheikhupura", "ames_iowa"]
VERIFIED = {"wheat", "maize", "sorghum", "cotton", "soybean", "groundnut", "peas", "sunflower", "potato"}


def saved(pid):
    return json.load(open(ROOT / f"backend/data/saved/{pid}_response.json", encoding="utf-8"))


def body_for(pid, **changes):
    """The request the workspace sends for an untouched demonstration farm."""
    p = api.PRESETS_BY_ID[pid]
    b = {"location": {"lat": p["lat"], "lon": p["lon"], "name": p["name"], "preset_id": pid},
         "soil": dict(p["soil"]), "soil_source": "farmer", "water": dict(p["water"]),
         "current_rotation": copy.deepcopy(p["current_rotation"]), "priorities": dict(api.PRIORITIES),
         "constraints": {"excluded_crops": [], "market_rating": {}, "max_cycle_years": 3},
         "scenario": {"temp_delta_c": 0.0, "precip_factor": 1.0},
         "options": {"apply_legume_effect": True, "failure_threshold": 0.5, "top_n": 5}}
    for path, value in changes.items():
        node = b
        keys = path.split("__")
        for k in keys[:-1]:
            node = node[k]
        node[keys[-1]] = value
    return b


def run(body, expect="done"):
    r = client.post("/api/analyze", json=body)
    assert r.status_code == 202, r.text
    job_id = r.json()["analysis_id"]
    for _ in range(600):
        state = client.get(f"/api/analysis/{job_id}").json()
        if state["status"] in ("done", "error"):
            assert state["status"] == expect, state.get("error")
            return state
        time.sleep(0.05)
    raise AssertionError("analysis did not finish")


def by_id(result):
    return {r["id"]: r for r in result["rotations"]}


# ---------------------------------------------------------------- reference data

def test_crops_are_exactly_the_verified_ones():
    body = client.get("/api/crops").json()
    assert {c["id"] for c in body["crops"]} == VERIFIED
    assert {c["id"] for c in body["unavailable"]} == {"rice", "chickpea", "mung_bean", "pearl_millet", "mustard"}
    assert body["default_market_rating"] == 2
    wheat = next(c for c in body["crops"] if c["id"] == "wheat")
    assert wheat["season_days"] == 160 and wheat["group"] == "cereal" and wheat["is_legume"] is False
    assert len(body["soil_textures"]) == 12


def test_rotation_library_filters_by_preset():
    assert len(client.get("/api/rotation-library", params={"preset_id": "chakwal"}).json()["rotations"]) == 4
    assert len(client.get("/api/rotation-library").json()["rotations"]) == 10
    assert client.get("/api/rotation-library", params={"preset_id": "nowhere"}).status_code == 404


def test_rotation_preview_uses_the_engine_schedule():
    ok = client.post("/api/rotation/preview", json=api.PRESETS_BY_ID["chakwal"]["current_rotation"]).json()
    assert ok["valid"] is True and ok["name"] == "Wheat then bare fallow" and len(ok["calendar"]) == 12
    assert ok["calendar"] == saved("chakwal")["rotations"][0]["calendar"]
    assert ok["seasons"][0]["plant_date"] == "1 Nov" and ok["seasons"][0]["season_days"] == 160
    assert ok["seasons"][0]["harvest_date"] == "9 Apr"

    overlap = client.post("/api/rotation/preview", json={"cycle_years": 1, "slots": [
        {"year_offset": 0, "plant_doy": 305, "crop_id": "wheat"}, {"year_offset": 0, "plant_doy": 330, "crop_id": "peas"}]})
    assert overlap.status_code == 200 and overlap.json()["valid"] is False and overlap.json()["error"] == "rotation_overlap"
    assert "overlap" in overlap.json()["detail"]

    rice = client.post("/api/rotation/preview", json={"cycle_years": 1, "slots": [{"year_offset": 0, "plant_doy": 150, "crop_id": "rice"}]})
    assert rice.status_code == 200 and rice.json()["valid"] is False and rice.json()["error"] == "unsupported_crop"
    malformed = client.post("/api/rotation/preview", json={"cycle_years": 7, "slots": []})
    assert malformed.status_code == 422 and malformed.json()["error"] == "invalid_request"


# ---------------------------------------------------------------- soil

def test_soil_lookup_reports_profile_no_data_and_unavailable(monkeypatch):
    ames = client.post("/api/soil/lookup", json={"lat": 42.03, "lon": -93.63}).json()
    assert ames["status"] == "profile" and ames["profile"]["texture_class"] == "silty_clay_loam"
    assert ames["source_label"].startswith("SoilGrids")
    chakwal = client.post("/api/soil/lookup", json={"lat": 32.93, "lon": 72.86}).json()
    assert chakwal["status"] == "no_data" and chakwal["profile"] is None
    monkeypatch.setattr(api.soilgrids, "get_soil", lambda lat, lon: None)  # a timeout looks like this
    down = client.post("/api/soil/lookup", json={"lat": 10.0, "lon": 10.0}).json()
    assert down["status"] == "unavailable" and down["profile"] is None
    assert client.post("/api/soil/lookup", json={"lat": 95, "lon": 0}).status_code == 422


def test_soil_resolve_returns_engine_values():
    farmer = client.post("/api/soil/resolve", json={"lat": 32.93, "lon": 72.86, "soil": {"texture_class": "loam", "organic_matter_level": "low", "depth_cm": 100}}).json()
    used = saved("chakwal")["site"]["soil_used"]
    assert {k: farmer[k] for k in used} == used and farmer["from_profile"] is False
    grids = client.post("/api/soil/resolve", json={"lat": 42.03, "lon": -93.63, "soil_source": "soilgrids", "soil": {"texture_class": "sand", "depth_cm": 80}}).json()
    assert grids["source"] == "soilgrids" and grids["texture_class"] == "silty_clay_loam" and grids["from_profile"] is True
    assert grids["depth_cm"] == 80
    # SoilGrids requested where it has no data: the farmer's values are used and it says so
    none = client.post("/api/soil/resolve", json={"lat": 32.93, "lon": 72.86, "soil_source": "soilgrids", "soil": {"texture_class": "clay"}}).json()
    assert none["source"] == "farmer" and none["texture_class"] == "clay" and none["from_profile"] is False


# ---------------------------------------------------------------- analysis jobs

@pytest.mark.parametrize("pid", IDS)
def test_untouched_demo_farm_reproduces_saved_engine_output(pid):
    state = run(body_for(pid))
    env = state["envelope"]
    assert env["source"] == "live" and env["preset_id"] == pid and env["analysis_id"] == state["analysis_id"]
    assert env["result"] == saved(pid)
    assert env["request"] == api.build_request(api.PRESETS_BY_ID[pid])
    assert env["inputs"]["climate"]["from_cache"] is True
    assert [s["state"] for s in state["stages"]] == ["done"] * 4
    json.dumps(state, allow_nan=False)


def test_priorities_change_the_ranking():
    base = saved("chakwal")
    res = run(body_for("chakwal", priorities__water_use=5, priorities__stability=0, priorities__nitrogen=0))["envelope"]
    assert res["request"]["priorities"]["water_use"] == 5 and res["request"]["priorities"]["stability"] == 0
    assert by_id(res["result"])["current"]["scores"]["total"] != by_id(base)["current"]["scores"]["total"]
    assert by_id(res["result"])["current"]["scores"]["rank"] < by_id(base)["current"]["scores"]["rank"]  # low-water wheat/fallow moves up
    # the simulation itself is untouched by weights
    assert by_id(res["result"])["current"]["hindcast"] == by_id(base)["current"]["hindcast"]


def test_scenario_is_applied_and_flagged():
    env = run(body_for("chakwal", scenario__precip_factor=0.8, scenario__temp_delta_c=1.0))["envelope"]
    assert env["request"]["scenario"] == {"temp_delta_c": 1.0, "precip_factor": 0.8}
    assert any("What-if scenario" in w for w in env["result"]["meta"]["warnings"])
    assert env["result"]["site"]["climate_summary"]["annual_rain_mm"] < saved("chakwal")["site"]["climate_summary"]["annual_rain_mm"]
    assert any(p["kind"] == "scenario" for p in env["result"]["provenance"])


def test_options_reach_the_engine():
    strict = run(body_for("chakwal", options__failure_threshold=0.7, options__top_n=3))["envelope"]["result"]
    assert len(strict["rotations"]) == 4
    assert by_id(strict)["current"]["hindcast"]["failure_freq"] > by_id(saved("chakwal"))["current"]["hindcast"]["failure_freq"]
    no_legume = run(body_for("ames_iowa", options__apply_legume_effect=False))["envelope"]["result"]
    for r in no_legume["rotations"]:
        assert r["scores"]["rank_range"] == [r["scores"]["rank"], r["scores"]["rank"]]
    assert by_id(no_legume)["current"]["hindcast"]["median"] < by_id(saved("ames_iowa"))["current"]["hindcast"]["median"]


def test_water_mode_changes_irrigation():
    full = by_id(saved("sheikhupura"))["current"]["hindcast"]["irrigation_mm_per_year"]
    limited = run(body_for("sheikhupura", water__mode="limited", water__seasonal_cap_mm=150))["envelope"]["result"]
    rainfed = run(body_for("sheikhupura", water__mode="rainfed"))["envelope"]["result"]
    assert 0 < by_id(limited)["current"]["hindcast"]["irrigation_mm_per_year"] < full
    assert by_id(rainfed)["current"]["hindcast"]["irrigation_mm_per_year"] == 0
    assert by_id(rainfed)["current"]["hindcast"]["p10"] < 1.0


def test_constraints_reach_the_engine():
    no_peas = run(body_for("chakwal", constraints__excluded_crops=["peas"]))["envelope"]["result"]
    assert all(s["crop_id"] != "peas" for r in no_peas["rotations"] for s in r["slots"])
    one_year = run(body_for("chakwal", constraints__max_cycle_years=1))["envelope"]["result"]
    assert all(r["cycle_years"] == 1 for r in one_year["rotations"])
    rated = run(body_for("chakwal", constraints__market_rating={"wheat": 5}))["envelope"]["result"]
    assert by_id(rated)["current"]["indicators"]["market_mean"] == 5.0
    assert by_id(saved("chakwal"))["current"]["indicators"]["market_mean"] == 2.0  # the engine's default rating


def test_accepted_soilgrids_profile_is_what_the_engine_uses():
    env = run(body_for("ames_iowa", soil_source="soilgrids", soil__depth_cm=120))["envelope"]
    assert env["result"]["site"]["soil_used"]["source"] == "soilgrids"
    assert env["request"]["soil"] == {"texture_class": None, "organic_matter_level": None, "depth_cm": 120}
    assert env["inputs"]["soil"]["profile"]["sand_pct"] == 15.2 and env["inputs"]["soil"]["soilgrids"] == "profile"
    assert [p for p in env["result"]["provenance"] if p["item"] == "Soil texture and depth"][0]["kind"] == "satellite_estimate"
    # the profile's own sand/clay/organic matter give different water limits than the texture-class default
    assert env["result"]["site"]["soil_used"] != saved("ames_iowa")["site"]["soil_used"]


def test_missing_soilgrids_profile_falls_back_to_farmer_values_and_says_so():
    env = run(body_for("chakwal", soil_source="soilgrids"))["envelope"]
    assert env["result"]["site"]["soil_used"]["source"] == "farmer"
    assert env["inputs"]["soil"]["soilgrids"] == "no_data" and any("SoilGrids" in n for n in env["notes"])
    assert env["result"] == saved("chakwal")


def _fake_power(monkeypatch, calls):
    series = json.load(open(ROOT / "backend/data/cache/power_32.93_72.86.json", encoding="utf-8"))

    def fake(lat, lon, *a, **k):
        calls.append((lat, lon))
        return dict(series, lat=lat, lon=lon)
    monkeypatch.setattr(api.power, "get_daily_climate", fake)


def test_custom_location_downloads_weather_and_skips_ndvi(monkeypatch):
    calls = []
    _fake_power(monkeypatch, calls)
    b = body_for("chakwal")
    b["location"] = {"lat": 30.1234, "lon": 71.4567, "name": "My field", "preset_id": None}
    state = run(b)
    env = state["envelope"]
    assert calls == [(30.12, 71.46)] and env["preset_id"] is None
    assert env["inputs"]["climate"]["from_cache"] is False and "Downloading" in state["stages"][1]["detail"]
    assert env["result"]["site"]["name"] == "My field" and env["result"]["site"]["lat"] == 30.12
    assert env["result"]["validation"]["ndvi_check"] is None and "No MODIS NDVI series" in env["inputs"]["ndvi"]["reason"]
    assert env["result"]["rotations"][0]["is_current"] and len(env["result"]["rotations"]) >= 3
    # no regional library rotations for a custom point
    assert not any(r["id"].startswith("chk_") for r in env["result"]["rotations"])


def test_moved_marker_turns_a_demo_farm_into_a_custom_field(monkeypatch):
    calls = []
    _fake_power(monkeypatch, calls)
    env = run(body_for("chakwal", location__lat=33.5))["envelope"]
    assert env["preset_id"] is None and env["request"]["location"]["preset_id"] is None
    assert any("custom field" in n for n in env["notes"]) and calls == [(33.5, 72.86)]


def test_weather_failure_is_a_clear_job_error(monkeypatch):
    def boom(lat, lon, *a, **k):
        raise DataSourceError("nasa_power", "request failed: HTTP 503")
    monkeypatch.setattr(api.power, "get_daily_climate", boom)
    b = body_for("chakwal")
    b["location"] = {"lat": 12.0, "lon": 12.0, "preset_id": None}
    state = run(b, expect="error")
    assert state["error"]["code"] == "weather_unavailable" and "HTTP 503" in state["error"]["detail"]
    assert state["envelope"] is None and state["stages"][1]["state"] == "error"
    assert "Traceback" not in json.dumps(state)


def test_unexpected_engine_failure_never_leaks_a_traceback(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("secret internals")
    monkeypatch.setattr(api, "run_analysis", boom)
    custom = run(body_for("chakwal", options__top_n=4), expect="error")
    assert custom["error"]["code"] == "internal_error" and "secret internals" not in json.dumps(custom)
    untouched = run(body_for("chakwal"))  # an untouched demo farm still has its saved result
    assert untouched["envelope"]["source"] == "saved" and "RuntimeError" in untouched["envelope"]["fallback_reason"]


@pytest.mark.parametrize("change,code,needle", [
    ({"location__lat": 95}, "invalid_request", "Latitude"),
    ({"location__lon": -200}, "invalid_request", "Longitude"),
    ({"soil__texture_class": "mud"}, "invalid_request", "Soil texture"),
    ({"soil__depth_cm": 5}, "invalid_request", "Soil depth"),
    ({"water__mode": "limited"}, "invalid_request", "seasonal allowance"),
    ({"water__mode": "flood"}, "invalid_request", "Water mode"),
    ({"priorities__stability": 9}, "invalid_request", "between 0 and 5"),
    ({"scenario__precip_factor": 3}, "invalid_request", "Rainfall adjustment"),
    ({"options__failure_threshold": 2}, "invalid_request", "Failure threshold"),
    ({"constraints__market_rating": {"wheat": 9}}, "invalid_request", "between 1 and 5"),
    ({"constraints__excluded_crops": ["rice"]}, "unknown_crop", "rice"),
    ({"current_rotation__cycle_years": 4}, "invalid_request", "Rotation cycle length"),
    ({"current_rotation__slots": []}, "invalid_request", "Crop rotation"),
    ({"current_rotation__slots": [{"year_offset": 1, "plant_doy": 100, "crop_id": "wheat"}]}, "invalid_request", "year 2"),
    ({"current_rotation__slots": [{"year_offset": 0, "plant_doy": 100, "crop_id": "rice"}]}, "unsupported_crop", "Rice"),
    ({"current_rotation__slots": [{"year_offset": 0, "plant_doy": 100, "crop_id": "kale"}]}, "unknown_crop", "kale"),
    ({"current_rotation__slots": [{"year_offset": 0, "plant_doy": 305, "crop_id": "wheat"},
                                  {"year_offset": 0, "plant_doy": 320, "crop_id": "potato"}]}, "rotation_overlap", "overlap"),
])
def test_invalid_input_is_rejected_with_a_readable_message(change, code, needle):
    r = client.post("/api/analyze", json=body_for("chakwal", **change))
    assert r.status_code == 422, r.text
    assert r.json()["error"] == code and needle in r.json()["detail"], r.json()


def test_unknown_ids_are_404():
    assert client.post("/api/analyze", json=body_for("chakwal", location__preset_id="nowhere")).status_code == 404
    r = client.get("/api/analysis/doesnotexist")
    assert r.status_code == 404 and r.json()["error"] == "unknown_analysis"


def test_geocode_failure_is_graceful(monkeypatch):
    def boom(*a, **k):
        raise api.requests.exceptions.ConnectionError("offline")
    monkeypatch.setattr(api.requests, "get", boom)
    r = client.get("/api/geocode", params={"q": "Chakwal test offline"})
    assert r.status_code == 502 and r.json()["error"] == "geocode_unavailable"
    assert client.get("/api/geocode", params={"q": "x"}).status_code == 422
