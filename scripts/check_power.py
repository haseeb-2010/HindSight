"""Make ONE request to NASA POWER for Chakwal and print what came back.

Run from the repo root:  py -3.11 scripts\\check_power.py
This script only looks; it does not write any files.
"""

import sys

import requests

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = {
    "parameters": "T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M,GWETROOT",
    "community": "AG",
    "longitude": 72.86,   # POWER wants longitude and latitude in the request
    "latitude": 32.93,
    "start": "19840101",
    "end": "20241231",
    "format": "JSON",
}
TIMEOUT_S = 60


def main():
    print("Asking NASA POWER for Chakwal (lat 32.93, lon 72.86), 1984-2024 ...")
    try:
        reply = requests.get(URL, params=PARAMS, timeout=TIMEOUT_S)
    except requests.exceptions.RequestException as exc:
        print("FAILED: could not reach NASA POWER:", exc)
        return 1
    if reply.status_code != 200:
        print("FAILED: HTTP status", reply.status_code)
        print(reply.text[:500])
        return 1
    try:
        raw = reply.json()
        table = raw["properties"]["parameter"]
        elevation = raw["geometry"]["coordinates"][2]  # order is [lon, lat, elevation]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        print("FAILED: reply did not have the expected layout:", repr(exc))
        return 1

    units = raw.get("parameters", {})
    print()
    print(f"{'parameter':<20}{'units':<16}{'dates':>8}{'-999 values':>14}")
    for name in PARAMS["parameters"].split(","):
        if name not in table:
            print(f"{name:<20}MISSING FROM REPLY")
            continue
        unit = units.get(name, {}).get("units", "unknown")
        values = table[name]
        missing = sum(1 for v in values.values() if v == -999)
        print(f"{name:<20}{unit:<16}{len(values):>8}{missing:>14}")
    print()
    print("Site elevation (m):", elevation)
    return 0


if __name__ == "__main__":
    sys.exit(main())
