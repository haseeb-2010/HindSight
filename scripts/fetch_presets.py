"""Download (or read from cache) the climate series for the three demo sites
and print a quick sanity summary.

Run from the repo root:  py -3.11 scripts\\fetch_presets.py
It does NOT create presets.json (soil, water and rotation come from Person 1).
"""

import sys
import time
from pathlib import Path

# make "backend" importable when this file is run as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.data_sources import cache  # noqa: E402
from backend.data_sources.errors import DataSourceError  # noqa: E402
from backend.data_sources.power import cache_file_name, get_daily_climate  # noqa: E402

START_YEAR = 1984
END_YEAR = 2024

# (name, lat, lon): latitude first, then longitude
SITES = [
    ("Chakwal, Pakistan", 32.93, 72.86),
    ("Sheikhupura, Pakistan", 31.71, 73.98),
    ("Ames, Iowa, USA", 42.03, -93.63),
]


def mean(values):
    good = [v for v in values if v is not None]
    return sum(good) / len(good) if good else None


def summarise(series):
    years = END_YEAR - START_YEAR + 1
    rain = [v for v in series["precip_mm"] if v is not None]
    annual_rain = sum(rain) / years
    daily_mean_temp = [
        (hi + lo) / 2
        for hi, lo in zip(series["tmax_c"], series["tmin_c"])
        if hi is not None and lo is not None
    ]
    return annual_rain, mean(daily_mean_temp), max(rain)


def main():
    failures = 0
    for name, lat, lon in SITES:
        print("-" * 60)
        print(f"{name} (lat {lat}, lon {lon})")
        started = time.time()
        try:
            series = get_daily_climate(lat, lon, START_YEAR, END_YEAR)
        except DataSourceError as exc:
            print("  FAILED:", exc)
            failures += 1
            continue
        seconds = time.time() - started
        annual_rain, temp, max_rain = summarise(series)
        print(f"  days: {len(series['dates'])}  ({series['start']} to {series['end']})  took {seconds:.1f} s")
        print(f"  elevation_m: {series['elevation_m']}")
        print(f"  mean yearly rainfall: {annual_rain:.0f} mm")
        print(f"  mean temperature: {temp:.1f} C")
        print(f"  wettest day: {max_rain:.1f} mm")
        print(f"  filled_counts: {series['filled_counts']}")
        print(f"  cache file: {cache_file_name(lat, lon)}")
    print("-" * 60)
    print("Cache folder:", cache.get_cache_dir())
    if failures:
        print(f"{failures} site(s) failed.")
        return 1
    print("All sites done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
