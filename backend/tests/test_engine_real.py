"""Checks on real NASA POWER cache files. Skipped if Person 2's cache is not present."""
import json, sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend")); sys.path.insert(0, str(ROOT / "scripts"))
CACHE = ROOT / "backend/data/cache"
pytestmark = pytest.mark.skipif(not (CACHE / "power_32.93_72.86.json").exists(), reason="no NASA cache")


def worst_years(res, k=4):
    h = res["rotations"][0]["hindcast"]
    return [y for _, y in sorted((v, y) for y, v in zip(h["years"], h["annual_index"]) if v is not None)[:k]]


def test_chakwal_worst_years_are_the_1998_2002_drought():
    from run_site import run_preset
    assert set(worst_years(run_preset("chakwal"))) <= {1998, 1999, 2000, 2001, 2002}


def test_ames_worst_year_is_2012_drought():
    from run_site import run_preset
    assert worst_years(run_preset("ames_iowa"), 1) == [2012]


def test_mass_balance_on_real_weather():
    from engine.climate import prepare
    from engine.soil import resolve_soil
    from engine.rotation import schedule, _sim_inputs, simulate
    crops = {c["id"]: c for c in json.load(open(ROOT / "backend/data/crops.json"))}
    c = prepare(json.load(open(CACHE / "power_32.93_72.86.json")))
    soil = resolve_soil({"texture_class": "loam", "organic_matter_level": "low", "depth_cm": 100}, None)
    s = schedule({"cycle_years": 1, "slots": [{"year_offset": 0, "plant_doy": 305, "crop_id": "wheat"}]}, crops)
    o = simulate([_sim_inputs(s, 0, c, soil)], c, soil, {"mode": "full"})
    res = c["precip"].sum() + o["irr"].sum() - o["eta"].sum() - o["exc"].sum() - (o["w_end"][0] - o["w_start"][0])
    assert abs(res) < 0.1
