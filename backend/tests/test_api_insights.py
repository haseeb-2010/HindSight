"""Phase 03 API checks: yearly climate context and multi-run scenario comparison.
No test touches the network: the three demonstration farms run from the cached NASA record."""
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
pytestmark = pytest.mark.skipif(not (ROOT / "backend/data/cache/power_32.93_72.86.json").exists(), reason="no NASA cache")

from fastapi.testclient import TestClient  # noqa: E402
from backend import api  # noqa: E402
from backend.context import climate_context, ndvi_coverage  # noqa: E402
from backend.tests.test_api_workspace import IDS, body_for, run, saved  # noqa: E402

client = TestClient(api.app)
BASELINE = {"id": "baseline", "label": "Historical baseline", "scenario": {"temp_delta_c": 0.0, "precip_factor": 1.0}}
DRIER = {"id": "drier", "label": "Lower rainfall", "scenario": {"temp_delta_c": 0.0, "precip_factor": 0.8}}
WARMER = {"id": "warmer", "label": "Higher warming test", "scenario": {"temp_delta_c": 2.0, "precip_factor": 1.0}}


def compare(base, variants, expect="done"):
    r = client.post("/api/scenarios/compare", json={"base": base, "variants": variants})
    assert r.status_code == 202, r.text
    job_id = r.json()["analysis_id"]
    for _ in range(1200):
        state = client.get(f"/api/analysis/{job_id}").json()
        if state["status"] in ("done", "error"):
            assert state["status"] == expect, state.get("error")
            return state
        time.sleep(0.05)
    raise AssertionError("comparison did not finish")


def window_mean(ctx, key, window):
    vals = [v for y, v in zip(ctx["years"], ctx["annual"][key]) if window[0] <= y <= window[1]]
    return sum(vals) / len(vals)


# ---------------------------------------------------------------- climate context

@pytest.mark.parametrize("pid", IDS)
def test_yearly_series_reproduce_the_engines_period_means(pid):
    """The chart values are the numbers behind the engine's climate_shift, not a second calculation."""
    env = client.get(f"/api/demo/{pid}").json()
    ctx = env["context"]["climate"]
    result = env["result"]
    assert ctx["years"] == list(range(1985, 2025))
    assert ctx["record"] == result["meta"]["record"]
    assert ctx["scenario_applied"] is False
    assert {s["id"] for s in result["climate_shift"]} == set(ctx["annual"])
    for shift in result["climate_shift"]:
        series = ctx["annual"][shift["id"]]
        assert len(series) == 40
        for name in ("early", "late"):
            assert window_mean(ctx, shift["id"], result["meta"]["windows"][name]) == pytest.approx(shift[name], abs=0.06)


@pytest.mark.parametrize("pid", IDS)
def test_monthly_climatology_adds_up_to_the_engines_annual_summary(pid):
    env = client.get(f"/api/demo/{pid}").json()
    ctx = env["context"]["climate"]
    summary = env["result"]["site"]["climate_summary"]
    assert [m["month"] for m in ctx["monthly"]] == list(range(1, 13))
    assert sum(m["rain_mm"] for m in ctx["monthly"]) == pytest.approx(summary["annual_rain_mm"], abs=1.0)
    assert sum(m["et0_mm"] for m in ctx["monthly"]) == pytest.approx(summary["annual_et0_mm"], abs=1.0)
    heavy = next(s for s in env["result"]["climate_shift"] if s["id"] == "heavy_rain_days")
    yearly_mean = sum(ctx["annual"]["heavy_rain_days"]) / 40
    assert sum(m["heavy_rain_days"] for m in ctx["monthly"]) == pytest.approx(yearly_mean, abs=0.1)
    assert (heavy["early"] + heavy["late"]) / 2 == pytest.approx(yearly_mean, abs=0.1)
    assert ctx["thresholds"] == {"hot_day_c": 35.0, "frost_day_c": 0.0, "heavy_rain_mm": 12.7}


def test_southern_hemisphere_swaps_the_warm_half_year():
    climate = api.power.get_daily_climate(32.93, 72.86)
    north = climate_context(climate)
    south = climate_context({**climate, "lat": -32.93})
    assert north["warm_half_year_months"] == [4, 5, 6, 7, 8, 9]
    assert south["warm_half_year_months"] == [10, 11, 12, 1, 2, 3]
    assert south["annual"]["warm_season_rain_mm"] == north["annual"]["cool_season_rain_mm"]


def test_context_follows_the_scenario_of_a_live_run():
    state = run(body_for("chakwal", scenario__precip_factor=0.8, scenario__temp_delta_c=1.0))
    env = state["envelope"]
    ctx = env["context"]["climate"]
    assert ctx["scenario_applied"] is True
    for shift in env["result"]["climate_shift"]:
        assert window_mean(ctx, shift["id"], [1985, 2004]) == pytest.approx(shift["early"], abs=0.06)
    base = client.get("/api/demo/chakwal").json()["context"]["climate"]
    wet = sum(base["annual"]["warm_season_rain_mm"])
    assert sum(ctx["annual"]["warm_season_rain_mm"]) == pytest.approx(wet * 0.8, rel=0.001)
    assert sum(ctx["annual"]["hot_days"]) > sum(base["annual"]["hot_days"])


def test_saved_envelope_reports_the_cached_inputs_it_came_from():
    env = client.get("/api/demo/chakwal").json()
    assert env["source"] == "saved" and env["result"] == saved("chakwal")
    inputs = env["inputs"]
    assert inputs["climate"]["start"] == "1984-01-01" and inputs["climate"]["end"] == "2024-12-31"
    assert inputs["climate"]["from_cache"] is True and inputs["climate"]["days"] > 14000
    assert inputs["ndvi"]["used"] is True
    assert inputs["ndvi"]["first_date"].startswith("2001") and inputs["ndvi"]["last_date"].startswith("2024")
    assert inputs["ndvi"]["observations"] == 552
    assert 0 < inputs["ndvi"]["good_quality_observations"] <= 552
    assert inputs["soil"]["used"] == env["result"]["site"]["soil_used"]["source"]


def test_ndvi_coverage_is_empty_without_a_series():
    assert ndvi_coverage(None) == {}
    assert ndvi_coverage({"dates": []}) == {}


def test_live_analysis_carries_context_and_ndvi_coverage():
    env = run(body_for("ames_iowa"))["envelope"]
    assert env["source"] == "live" and env["result"] == saved("ames_iowa")
    assert len(env["context"]["climate"]["annual"]["annual_et0_mm"]) == 40
    assert env["inputs"]["climate"]["days"] > 14000


# ---------------------------------------------------------------- scenario comparison

def test_comparison_baseline_matches_a_single_analysis_and_reads_weather_once(monkeypatch):
    calls = []
    real = api.power.get_daily_climate

    def counting(lat, lon, *a, **k):
        calls.append((lat, lon))
        return real(lat, lon, *a, **k)

    monkeypatch.setattr(api.power, "get_daily_climate", counting)
    state = compare(body_for("chakwal"), [BASELINE, DRIER, WARMER])
    assert len(calls) == 1  # three engine runs, one read of the weather record
    assert state["envelope"] is None
    cmp = state["comparison"]
    assert cmp["kind"] == "comparison" and cmp["weather_from_cache"] is True
    assert [v["id"] for v in cmp["variants"]] == ["baseline", "drier", "warmer"]
    assert [v["label"] for v in cmp["variants"]] == ["Historical baseline", "Lower rainfall", "Higher warming test"]
    base, drier, warmer = (v["envelope"] for v in cmp["variants"])
    assert base["result"] == saved("chakwal")  # the baseline run is the ordinary analysis
    assert base["source"] == drier["source"] == "live"
    assert base["analysis_id"] == f"{state['analysis_id']}-baseline"
    assert drier["request"]["scenario"] == {"temp_delta_c": 0.0, "precip_factor": 0.8}
    assert warmer["request"]["scenario"] == {"temp_delta_c": 2.0, "precip_factor": 1.0}
    assert any("What-if scenario" in w for w in drier["result"]["meta"]["warnings"])
    assert base["result"]["meta"]["warnings"] == []

    def cur(env):
        return next(r for r in env["result"]["rotations"] if r["is_current"])

    assert cur(drier)["hindcast"]["median"] < cur(base)["hindcast"]["median"]  # rainfed wheat with 20% less rain
    assert cur(warmer)["hindcast"]["water_demand_mm_per_year"] > cur(base)["hindcast"]["water_demand_mm_per_year"]
    assert drier["context"]["climate"]["scenario_applied"] is True


def test_comparison_can_vary_priorities_without_touching_the_simulation():
    water_first = {"id": "water", "label": "Water conservation first", "priorities": {"water_use": 5, "stability": 1}}
    state = compare(body_for("sheikhupura"), [{"id": "base", "label": "Your weights"}, water_first])
    base, water = (v["envelope"] for v in state["comparison"]["variants"])
    assert base["result"] == saved("sheikhupura")
    assert water["request"]["priorities"] == {**api.PRIORITIES, "water_use": 5, "stability": 1}
    assert water["request"]["scenario"] == base["request"]["scenario"]

    def hindcasts(env):
        return {r["name"]: r["hindcast"] for r in env["result"]["rotations"]}

    shared = set(hindcasts(base)) & set(hindcasts(water))
    assert shared  # the same rotation simulates identically whatever the weights
    for name in shared:
        assert hindcasts(base)[name]["annual_index"] == hindcasts(water)[name]["annual_index"]


def test_comparison_state_reports_which_run_is_in_progress():
    state = compare(body_for("ames_iowa"), [BASELINE, DRIER])
    stage = next(s for s in state["stages"] if s["id"] == "simulate")
    assert stage["state"] == "done" and stage["detail"] == "Run 2 of 2: Lower rainfall"


@pytest.mark.parametrize("variants, fragment", [
    ([], "Scenarios to compare"),
    ([BASELINE] * 2, "own id"),
    ([{**BASELINE, "id": f"v{i}"} for i in range(7)], "Scenarios to compare"),
    ([{"id": "x", "label": "Too dry", "scenario": {"precip_factor": 0.2}}], "greater than or equal to 0.5"),
    ([{"id": "x", "label": "Bad weight", "priorities": {"water_use": 9}}], "between 0 and 5"),
    ([{"id": "x", "label": "Unknown", "priorities": {"yield": 3}}], "Unknown priority"),
    ([{"id": "bad id!", "label": "x"}], "id"),
])
def test_comparison_rejects_invalid_requests(variants, fragment):
    r = client.post("/api/scenarios/compare", json={"base": body_for("chakwal"), "variants": variants})
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["error"] == "invalid_request" and fragment in body["detail"]
    assert "Traceback" not in r.text


def test_comparison_applies_the_same_base_checks_as_an_analysis():
    r = client.post("/api/scenarios/compare", json={"base": body_for("chakwal", location__preset_id="nowhere"), "variants": [BASELINE]})
    assert r.status_code == 404 and r.json()["error"] == "unknown_preset"
    bad_crop = body_for("chakwal")
    bad_crop["current_rotation"]["slots"][0]["crop_id"] = "rice"
    r = client.post("/api/scenarios/compare", json={"base": bad_crop, "variants": [BASELINE]})
    assert r.status_code == 422 and r.json()["error"] == "unsupported_crop"


def test_comparison_reports_a_weather_failure_without_a_stack_trace(monkeypatch):
    from backend.data_sources.errors import DataSourceError

    def down(lat, lon, *a, **k):
        raise DataSourceError("NASA POWER", "service timed out")

    monkeypatch.setattr(api.power, "get_daily_climate", down)
    body = body_for("chakwal", location__lat=10.5, location__lon=20.5, location__preset_id=None)
    state = compare(body, [BASELINE, DRIER], expect="error")
    assert state["error"]["code"] == "weather_unavailable" and state["comparison"] is None
    assert "Traceback" not in state["error"]["detail"]


def test_limits_expose_the_comparison_size():
    assert client.get("/api/crops").json()["limits"]["max_compare_runs"] == 6
    assert client.get("/api/health").json()["api_version"] == "3.0.0"
