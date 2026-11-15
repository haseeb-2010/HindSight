"""Run the engine on cached NASA data for one preset and save the response (also the fallback rung).
Usage: python scripts/run_site.py chakwal        (reads backend/data/cache/power_<lat>_<lon>.json)
Uses ndvi_<lat>_<lon>.json if present, else converts ndvi_partial_<lat>_<lon>.json."""
import json, sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from engine import run_analysis

DATA = ROOT / "backend/data"
PRIORITIES = {"stability": 4, "water_use": 3, "forage": 1, "nitrogen": 3, "erosion": 2, "organic_matter": 2, "market": 3}


def load_ndvi(lat, lon, point=None):
    """Use the preset's optional ndvi_point (a cropland pixel) when given."""
    if point:
        lat, lon = point["lat"], point["lon"]
    key = f"{lat:.2f}_{lon:.2f}"
    full, part = DATA / f"cache/ndvi_{key}.json", DATA / f"cache/ndvi_partial_{key}.json"
    if full.exists():
        return json.load(open(full))
    if not part.exists():
        return None
    raw = json.load(open(part))["raw"]
    nd, rel = raw["250m_16_days_NDVI"], raw["250m_16_days_pixel_reliability"]
    codes = sorted(c for c in nd if c in rel)
    to_date = lambda c: (date(int(c[1:5]), 1, 1) + timedelta(int(c[5:]) - 1)).isoformat()
    return {"source": "MODIS MOD13Q1 v061 via ORNL DAAC subset API (partial download)", "lat": lat, "lon": lon,
            "dates": [to_date(c) for c in codes], "ndvi": [None if nd[c] is None else nd[c] * 0.0001 for c in codes],
            "good_quality": [rel[c] == 0 for c in codes]}


def build_request(p):
    return {"location": {"lat": p["lat"], "lon": p["lon"], "name": p["name"], "preset_id": p["id"]},
            "soil": p["soil"], "water": p["water"], "current_rotation": p["current_rotation"],
            "priorities": PRIORITIES, "constraints": {"excluded_crops": [], "market_rating": {}, "max_cycle_years": 3},
            "scenario": {"temp_delta_c": 0.0, "precip_factor": 1.0},
            "options": {"apply_legume_effect": True, "failure_threshold": 0.5, "top_n": 5}}


def run_preset(pid):
    p = {x["id"]: x for x in json.load(open(DATA / "presets.json", encoding="utf-8-sig"))}[pid]
    clim = json.load(open(DATA / f"cache/power_{p['lat']:.2f}_{p['lon']:.2f}.json"))
    return run_analysis(build_request(p), clim, None, json.load(open(DATA / "crops.json")),
                        json.load(open(DATA / "rotations_library.json")), ndvi=load_ndvi(p["lat"], p["lon"], p.get("ndvi_point")))


if __name__ == "__main__":
    pid = sys.argv[1]
    res = run_preset(pid)
    out = DATA / f"saved/{pid}_response.json"
    out.parent.mkdir(exist_ok=True)
    json.dump(res, open(out, "w"), indent=1, allow_nan=False)  # NaN is invalid JSON
    print(res["site"]["climate_summary"], res["meta"]["warnings"], res["validation"])
    for r in res["rotations"]:
        h = r["hindcast"]
        print(f"#{r['scores']['rank']} {r['name'][:50]:50} median {h['median']} bad-year {h['p10']} "
              f"fail {h['failure_freq']} water {h['water_demand_mm_per_year']} irr {h['irrigation_mm_per_year']}")
    print("saved", out)
