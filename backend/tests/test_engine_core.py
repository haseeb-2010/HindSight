import json, sys, time, copy
from pathlib import Path
import numpy as np
import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND)); sys.path.insert(0, str(BACKEND / "tests"))
from engine import run_analysis, EngineError
from engine.et0 import et0_pm
from engine.soil import saxton_rawls, resolve_soil
from engine.climate import prepare
from engine.rotation import schedule, _sim_inputs, simulate
from synthetic import synthetic_climate

CROPS = json.load(open(BACKEND / "data/crops.json"))
LIB = json.load(open(BACKEND / "data/rotations_library.json"))
CBY = {c["id"]: c for c in CROPS}
CLIM = synthetic_climate()
REQ = {"location": {"lat": 32.93, "lon": 72.86, "name": "Chakwal", "preset_id": "chakwal"},
       "soil": {"texture_class": "loam", "organic_matter_level": "low", "depth_cm": 100},
       "water": {"mode": "rainfed", "seasonal_cap_mm": None},
       "current_rotation": {"cycle_years": 1, "slots": [{"year_offset": 0, "plant_doy": 305, "crop_id": "wheat"}]},
       "priorities": {"stability": 4, "water_use": 3, "forage": 1, "nitrogen": 3, "erosion": 2, "organic_matter": 2, "market": 3},
       "constraints": {"excluded_crops": [], "market_rating": {"wheat": 3}, "max_cycle_years": 2},
       "scenario": {"temp_delta_c": 0.0, "precip_factor": 1.0},
       "options": {"apply_legume_effect": True, "failure_threshold": 0.5, "top_n": 5}}


def run(req=REQ, clim=CLIM):
    return run_analysis(req, clim, None, CROPS, LIB, allow_unverified=False)


def test_et0_fao56_example18():
    # FAO-56 Example 18 (Brussels, 6 July): ET0 = 3.9 mm/day. ea=1.409 kPa -> mean RH ~70.6 %.
    v = et0_pm(np.array([21.5]), np.array([12.3]), np.array([70.56]), np.array([2.078]),
               np.array([22.07]), 50.8, np.array([187]), 100.0)[0]
    assert abs(v - 3.9) / 3.9 < 0.05


def test_saxton_rawls_loam_plausible():
    fc, wp = saxton_rawls(0.40, 0.20, 1.5)
    assert 0.24 < fc < 0.30 and 0.10 < wp < 0.15


def _sim(mode="rainfed", clim=CLIM, rot=REQ["current_rotation"]):
    c = prepare(clim); soil = resolve_soil(REQ["soil"], None)
    s = schedule(dict(rot), CBY)
    out = simulate([_sim_inputs(s, 0, c, soil)], c, soil, {"mode": mode, "seasonal_cap_mm": 150})
    return c, soil, out


@pytest.mark.parametrize("mode", ["rainfed", "full", "limited"])
def test_mass_balance_and_bounds(mode):
    c, soil, o = _sim(mode)
    res = c["precip"].sum() + o["irr"].sum() - o["eta"].sum() - o["exc"].sum() - (o["w_end"][0] - o["w_start"][0])
    assert abs(res) < 0.1
    assert (o["eta"] <= o["etc"] + 1e-9).all() and (o["eta"] >= 0).all()


def test_full_irrigation_removes_water_stress():
    c, soil, o = _sim("full")
    crop = o["crop"][0]
    assert o["eta"][0][crop].sum() / o["etc"][0][crop].sum() > 0.999


def test_no_rain_gives_zero_index():
    dry = copy.deepcopy(CLIM); dry["precip_mm"] = [0.0] * len(dry["precip_mm"])
    r = run(clim=dry)["rotations"][0]
    assert r["hindcast"]["median"] == 0.0


def test_overlap_raises():
    rot = {"cycle_years": 1, "slots": [{"year_offset": 0, "plant_doy": 300, "crop_id": "wheat"},
                                       {"year_offset": 0, "plant_doy": 320, "crop_id": "peas"}]}
    with pytest.raises(EngineError) as e:
        schedule(rot, CBY)
    assert e.value.code == "ROTATION_OVERLAP"


def test_shape_determinism_speed():
    t = time.time(); a = run(); dt = time.time() - t
    b = run()
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    assert dt < 10, dt
    for k in ["meta", "site", "climate_shift", "rotations", "validation", "provenance"]:
        assert k in a
    r0 = a["rotations"][0]
    assert r0["is_current"] and len(r0["hindcast"]["annual_index"]) == 40
    assert len(a["rotations"]) >= 3
    for r in a["rotations"]:
        assert set(r["explanation"]) == {"summary", "reasons", "evidence", "benefits", "gaps", "local_review"}
        assert 0 <= r["scores"]["total"] <= 1
        assert len(r["calendar"]) == 12 * r["cycle_years"]


def test_worst_years_and_robustness_fields():
    a = run()
    cur = a["rotations"][0]
    assert len(cur["hindcast"]["worst_years"]["years"]) == 5
    for r in a["rotations"]:
        for key in ("rank_range", "rank_range_rain"):
            lo, hi = r["scores"][key]
            assert 1 <= lo <= r["scores"]["rank"] <= hi <= len(a["rotations"])


def test_response_is_strict_json():
    json.dumps(run(), allow_nan=False)
    full = copy.deepcopy(REQ); full["water"] = {"mode": "full", "seasonal_cap_mm": None}
    json.dumps(run(full), allow_nan=False)
