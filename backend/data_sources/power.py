"""NASA POWER daily climate for one point (ClimateSeries, spec section 4.1)."""

import time
from datetime import datetime, timezone

import requests

from . import cache
from .errors import DataSourceError

SOURCE_NAME = "nasa_power"
POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
TIMEOUT_S = 60       # spec section 7
MAX_RETRIES = 2      # so at most 3 attempts in total
RETRY_WAIT_S = 3
MAX_GAP_DAYS = 5     # spec section 4.1: gaps up to 5 days are interpolated

# (POWER name, ClimateSeries key) in the order the spec lists them
PARAMETERS = [
    ("T2M_MAX", "tmax_c"),
    ("T2M_MIN", "tmin_c"),
    ("PRECTOTCORR", "precip_mm"),
    ("ALLSKY_SFC_SW_DWN", "srad_mj_m2"),
    ("RH2M", "rh_pct"),
    ("WS2M", "wind_ms"),
    ("GWETROOT", "gwetroot_frac"),
]

SOURCE_TEXT = "NASA POWER daily point API, AG community (MERRA-2 meteorology, CERES solar)"
GRID_NOTE = "0.5 x 0.625 degree cell estimate; not a field measurement"


def _round_coord(value):
    # + 0.0 turns -0.0 into 0.0 so the file name never contains "-0.00"
    return round(float(value), 2) + 0.0


def cache_file_name(lat, lon):
    return f"power_{_round_coord(lat):.2f}_{_round_coord(lon):.2f}.json"


def _download(lat, lon, start_year, end_year):
    """Ask POWER for the data. Up to two retries. Raises DataSourceError."""
    params = {
        "parameters": ",".join(name for name, _ in PARAMETERS),
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": f"{start_year}0101",
        "end": f"{end_year}1231",
        "format": "JSON",
    }
    problem = "unknown error"
    for attempt in range(MAX_RETRIES + 1):
        if attempt > 0:
            time.sleep(RETRY_WAIT_S)
        try:
            reply = requests.get(POWER_URL, params=params, timeout=TIMEOUT_S)
        except requests.exceptions.RequestException as exc:
            problem = f"network error: {exc}"
            continue
        if reply.status_code == 200:
            try:
                return reply.json()
            except ValueError:
                problem = "reply was not valid JSON"
                continue
        problem = f"HTTP {reply.status_code}"
        if reply.status_code < 500 and reply.status_code != 429:
            break  # our request is wrong; retrying will not help
    raise DataSourceError(SOURCE_NAME, f"request failed: {problem}")


def _fill_gaps(values, max_gap=MAX_GAP_DAYS):
    """Linear interpolation of runs of None that are max_gap long or shorter.

    A run needs a real value on both sides. Runs at the very start or end,
    and longer runs, stay None. Returns (new_list, number_of_days_filled).
    """
    out = list(values)
    filled = 0
    n = len(out)
    i = 0
    while i < n:
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < n and out[j] is None:
            j += 1
        length = j - i
        if i > 0 and j < n and length <= max_gap:
            left = out[i - 1]
            right = out[j]
            span = j - (i - 1)
            for k in range(i, j):
                out[k] = round(left + (right - left) * (k - (i - 1)) / span, 2)
            filled += length
        i = j
    return out, filled


def _build_series(raw, lat, lon):
    """Turn the raw POWER reply into a ClimateSeries dict."""
    try:
        table = raw["properties"]["parameter"]
        elevation = raw["geometry"]["coordinates"][2]  # [lon, lat, elevation]
        day_keys = table[PARAMETERS[0][0]].keys()
    except (KeyError, IndexError, TypeError):
        raise DataSourceError(SOURCE_NAME, "reply does not have the expected layout")
    for name, _ in PARAMETERS:
        if name not in table:
            raise DataSourceError(SOURCE_NAME, f"reply is missing parameter {name}")

    # keys look like "19840101"; drop 29 February
    keys = sorted(k for k in day_keys if not (k[4:6] == "02" and k[6:8] == "29"))
    if not keys:
        raise DataSourceError(SOURCE_NAME, "reply contains no days")

    dates = [f"{k[0:4]}-{k[4:6]}-{k[6:8]}" for k in keys]
    series = {
        "source": SOURCE_TEXT,
        "lat": lat,
        "lon": lon,
        "elevation_m": None if elevation is None else round(float(elevation), 2),
        "grid_note": GRID_NOTE,
        "start": dates[0],
        "end": dates[-1],
        "dates": dates,
    }
    filled_counts = {}
    for name, key in PARAMETERS:
        raw_values = table[name]
        values = []
        for k in keys:
            v = raw_values.get(k)
            values.append(None if v is None or v == -999 else v)
        values, filled = _fill_gaps(values)
        series[key] = values
        if filled > 0:
            filled_counts[key] = filled
    series["filled_counts"] = filled_counts
    series["fetched_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return series


def _cache_matches(cached, start_year, end_year):
    try:
        return (
            isinstance(cached, dict)
            and int(cached["start"][:4]) == start_year
            and int(cached["end"][:4]) == end_year
            and len(cached["dates"]) > 0
        )
    except (KeyError, TypeError, ValueError):
        return False


def get_daily_climate(lat: float, lon: float, start_year: int = 1984, end_year: int = 2024) -> dict:
    """Return a ClimateSeries (spec 4.1). Reads the cache first; the network
    is used only when there is no matching cache file and we are not offline."""
    if start_year > end_year:
        raise DataSourceError(SOURCE_NAME, "start_year is after end_year")
    lat = _round_coord(lat)
    lon = _round_coord(lon)
    file_name = cache_file_name(lat, lon)

    cached = cache.read_cache(file_name)
    if _cache_matches(cached, start_year, end_year):
        return cached

    if cache.is_offline():
        raise DataSourceError(SOURCE_NAME, f"offline mode and no usable cache file {file_name}")

    raw = _download(lat, lon, start_year, end_year)
    series = _build_series(raw, lat, lon)
    cache.write_cache(file_name, series)
    return series
