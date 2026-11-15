"""HTTP API checks. The live runs must reproduce the saved responses exactly: same request
(scripts/run_site.py), same cached NASA data, deterministic engine."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
pytestmark = pytest.mark.skipif(not (ROOT / "backend/data/cache/power_32.93_72.86.json").exists(), reason="no NASA cache")

from fastapi.testclient import TestClient  # noqa: E402
from backend import api  # noqa: E402
from backend.data_sources.errors import DataSourceError  # noqa: E402
from backend.engine import EngineError  # noqa: E402

client = TestClient(api.app)
IDS = ["chakwal", "sheikhupura", "ames_iowa"]


def saved(pid):
    return json.load(open(ROOT / f"backend/data/saved/{pid}_response.json", encoding="utf-8"))


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok" and r.json()["engine_version"] == "0.3.0"


def test_presets_come_from_presets_json():
    body = client.get("/api/presets").json()
    raw = json.load(open(ROOT / "backend/data/presets.json", encoding="utf-8-sig"))
    assert [p["id"] for p in body["presets"]] == [p["id"] for p in raw]
    for got, src in zip(body["presets"], raw):
        assert {k: got[k] for k in src} == src  # every original key passes through unchanged
        assert got["data_status"]["nasa_power_cached"] and got["data_status"]["saved_response"]
    by = {p["id"]: p for p in body["presets"]}
    assert by["chakwal"]["rotation_name"] == "Wheat then bare fallow"
    assert by["chakwal"]["rotation_crops"][0]["plant_date"] == "1 Nov"
    assert by["chakwal"]["water_label"] == "Rainfed" and by["sheikhupura"]["water_label"] == "Irrigated"
    assert by["sheikhupura"]["data_status"]["soilgrids"] == "not_cached"
    assert by["ames_iowa"]["data_status"]["soilgrids"] == "profile"
    assert body["default_priorities"]["stability"] == 4


def test_unknown_preset_is_404():
    for r in (client.get("/api/demo/nowhere"), client.post("/api/analyze/preset/nowhere")):
        assert r.status_code == 404
        assert r.json()["error"] == "unknown_preset" and r.json()["valid_ids"] == sorted(IDS)


@pytest.mark.parametrize("pid", IDS)
def test_demo_returns_the_saved_file_labelled_as_saved(pid):
    body = client.get(f"/api/demo/{pid}").json()
    assert body["source"] == "saved" and body["fallback_reason"] is None
    assert body["result"] == saved(pid)


@pytest.mark.parametrize("pid", IDS)
def test_live_analysis_matches_saved_engine_output(pid):
    api._live_cache.pop(pid, None)
    body = client.post(f"/api/analyze/preset/{pid}").json()
    assert body["source"] == "live", body.get("fallback_reason")
    assert body["result"] == saved(pid)
    assert body["request"] == api.build_request(api.PRESETS_BY_ID[pid])
    assert body["request"]["options"]["failure_threshold"] == 0.5
    assert body["inputs"]["soil"]["used"] == "farmer"
    assert body["inputs"]["ndvi"]["used"] is True  # all three presets have a cached MODIS series
    json.dumps(body, allow_nan=False)


def test_ndvi_check_is_null_for_irrigated_site_and_optional_fields_survive():
    api._live_cache.pop("sheikhupura", None)
    res = client.post("/api/analyze/preset/sheikhupura").json()["result"]
    assert res["validation"]["ndvi_check"] is None
    for r in res["rotations"]:
        assert len(r["scores"]["rank_range"]) == 2 and len(r["scores"]["rank_range_rain"]) == 2
        assert set(r["hindcast"]["worst_years"]) == {"years", "mean_index"}


def test_data_failure_falls_back_to_saved_and_says_so(monkeypatch):
    def boom(lat, lon):
        raise DataSourceError("nasa_power", "no cached NASA POWER series (test)")
    monkeypatch.setattr(api, "_climate_cached", boom)
    monkeypatch.setattr(api, "_live_cache", {})
    body = client.post("/api/analyze/preset/chakwal").json()
    assert body["source"] == "saved" and "no cached NASA POWER series" in body["fallback_reason"]
    assert body["result"] == saved("chakwal")


def test_engine_error_falls_back_to_saved(monkeypatch):
    def boom(*a, **k):
        raise EngineError("UNKNOWN_CROP", "Crop 'x' has no sourced Ky yet.")
    monkeypatch.setattr(api, "run_analysis", boom)
    monkeypatch.setattr(api, "_live_cache", {})
    body = client.post("/api/analyze/preset/ames_iowa").json()
    assert body["source"] == "saved" and "UNKNOWN_CROP" in body["fallback_reason"]


def test_no_saved_file_and_failed_run_gives_503(monkeypatch, tmp_path):
    def boom(*a, **k):
        raise RuntimeError("disk on fire")
    monkeypatch.setattr(api, "run_analysis", boom)
    monkeypatch.setattr(api, "_live_cache", {})
    monkeypatch.setattr(api, "DATA", tmp_path)
    r = client.post("/api/analyze/preset/chakwal")
    assert r.status_code == 503 and r.json()["error"] == "analysis_unavailable"
