"""MODIS NDVI time series (NdviSeries, spec 4.3) from the ORNL DAAC MODIS web service.

get_ndvi_series never raises: any failure gives None, and the app then
leaves validation.ndvi_check empty and adds a warning.

The service can be slow (30-60 s per request), so progress is saved to a
partial file after every request and a later call resumes where it stopped.
LAST_ERROR holds the reason for the most recent failure (for debugging).
Set VERBOSE = True to print progress.
"""

import os
import time
from datetime import date, timedelta

import requests

from . import cache

BASE_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
HEADERS = {"Accept": "application/json"}
NDVI_BAND = "250m_16_days_NDVI"
RELIABILITY_BAND = "250m_16_days_pixel_reliability"
TIMEOUT_S = 120
MAX_RETRIES = 2
RETRY_WAIT_S = 5
PAUSE_S = 0.5        # wait between requests
GROUP_SIZE = 10      # the service allows at most ten dates per subset request
SCALE = 0.0001       # NDVI scale factor reported by the service
FILL_VALUE = -3000   # NDVI fill value reported by the service
VALID_MIN, VALID_MAX = -2000, 10000   # NDVI valid range reported by the service
GOOD_RELIABILITY = 0                  # pixel reliability 0 = good data
SOURCE_TEXT = "MODIS MOD13Q1 v061 via ORNL DAAC subset API"

LAST_ERROR = None
VERBOSE = False


def _say(message):
    if VERBOSE:
        print(message, flush=True)


def _round_coord(value):
    return round(float(value), 2) + 0.0


def cache_file_name(lat, lon):
    return f"ndvi_{_round_coord(lat):.2f}_{_round_coord(lon):.2f}.json"


def partial_file_name(lat, lon):
    return f"ndvi_partial_{_round_coord(lat):.2f}_{_round_coord(lon):.2f}.json"


def _get_json(path, params):
    """GET one URL with retries; pause afterwards. Raises RuntimeError on failure."""
    problem = "unknown error"
    for attempt in range(MAX_RETRIES + 1):
        if attempt > 0:
            time.sleep(RETRY_WAIT_S)
        try:
            reply = requests.get(BASE_URL + path, params=params, headers=HEADERS, timeout=TIMEOUT_S)
        except requests.exceptions.RequestException as exc:
            problem = f"network error: {exc}"
            continue
        if reply.status_code == 200:
            try:
                data = reply.json()
            except ValueError:
                problem = "reply was not valid JSON"
                continue
            time.sleep(PAUSE_S)
            return data
        problem = f"HTTP {reply.status_code}"
        if reply.status_code < 500 and reply.status_code != 429:
            break
    raise RuntimeError(f"{path}: {problem}")


def _computed_dates(start_year, end_year):
    """The 16-day composite dates (day of year 1, 17, 33, ... 353 every year),
    used only if the service's date list cannot be fetched."""
    out = []
    for year in range(start_year, end_year + 1):
        for doy in range(1, 366, 16):
            calendar = (date(year, 1, 1) + timedelta(days=doy - 1)).isoformat()
            out.append((f"A{year}{doy:03d}", calendar))
    return out


def _list_dates(lat, lon, start_year, end_year):
    """[(modis_date, calendar_date)] inside the year range, in order, no 29 February."""
    try:
        data = _get_json("/dates", {"latitude": lat, "longitude": lon})
        pairs = [(item["modis_date"], item["calendar_date"]) for item in data["dates"]]
    except (RuntimeError, KeyError, TypeError):
        _say("date list unavailable; using the computed 16-day calendar")
        pairs = _computed_dates(start_year, end_year)
    out = [
        (m, c) for m, c in pairs
        if start_year <= int(c[:4]) <= end_year and not c.endswith("-02-29")
    ]
    out.sort(key=lambda pair: pair[1])
    return out


def _fetch_band(lat, lon, band, group):
    """{modis_date: raw value or None} for one group of at most ten dates."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "band": band,
        "startDate": group[0][0],
        "endDate": group[-1][0],
        "kmAboveBelow": 0,
        "kmLeftRight": 0,
    }
    data = _get_json("/subset", params)
    found = {entry["modis_date"]: entry["data"][0] for entry in data["subset"]}
    return {modis_date: found.get(modis_date) for modis_date, _ in group}


def _ndvi_value(raw):
    if raw is None or raw == FILL_VALUE or raw < VALID_MIN or raw > VALID_MAX:
        return None
    return round(raw * SCALE, 4)


def _cache_matches(cached, start_year, end_year):
    try:
        dates = cached["dates"]
        return (
            len(dates) > 0
            and int(dates[0][:4]) == start_year
            and int(dates[-1][:4]) == end_year
            and len(cached["ndvi"]) == len(dates) == len(cached["good_quality"])
        )
    except (KeyError, TypeError, ValueError):
        return False


def _load_partial(name, start_year, end_year):
    data = cache.read_cache(name)
    try:
        if data["start_year"] == start_year and data["end_year"] == end_year:
            data["raw"].setdefault(NDVI_BAND, {})
            data["raw"].setdefault(RELIABILITY_BAND, {})
            return data
    except (KeyError, TypeError, AttributeError):
        pass
    return {"start_year": start_year, "end_year": end_year,
            "raw": {NDVI_BAND: {}, RELIABILITY_BAND: {}}}


def _save_partial(name, partial):
    try:
        cache.write_cache(name, partial)
    except Exception:
        pass


def get_ndvi_series(lat: float, lon: float, start_year: int = 2001, end_year: int = 2024) -> dict | None:
    """NdviSeries (spec 4.3) or None. Never raises. Call again to resume."""
    global LAST_ERROR
    LAST_ERROR = None
    try:
        lat = _round_coord(lat)
        lon = _round_coord(lon)
        file_name = cache_file_name(lat, lon)
        partial_name = partial_file_name(lat, lon)

        cached = cache.read_cache(file_name)
        if _cache_matches(cached, start_year, end_year):
            return cached
        if cache.is_offline():
            LAST_ERROR = f"offline mode and no usable cache file {file_name}"
            return None

        dates = _list_dates(lat, lon, start_year, end_year)
        if not dates:
            LAST_ERROR = "no MODIS dates in the requested years"
            return None

        partial = _load_partial(partial_name, start_year, end_year)
        groups = [dates[i:i + GROUP_SIZE] for i in range(0, len(dates), GROUP_SIZE)]
        for number, group in enumerate(groups, start=1):
            for band in (NDVI_BAND, RELIABILITY_BAND):
                have = partial["raw"][band]
                if all(modis_date in have for modis_date, _ in group):
                    continue
                have.update(_fetch_band(lat, lon, band, group))
                _save_partial(partial_name, partial)
                _say(f"group {number}/{len(groups)} {band} saved")

        out_dates, out_ndvi, out_good = [], [], []
        for modis_date, calendar in dates:
            value = _ndvi_value(partial["raw"][NDVI_BAND].get(modis_date))
            quality = partial["raw"][RELIABILITY_BAND].get(modis_date)
            out_dates.append(calendar)
            out_ndvi.append(value)
            out_good.append(value is not None and quality == GOOD_RELIABILITY)

        series = {
            "source": SOURCE_TEXT,
            "lat": lat,
            "lon": lon,
            "dates": out_dates,
            "ndvi": out_ndvi,
            "good_quality": out_good,
        }
        cache.write_cache(file_name, series)
        try:
            os.remove(os.path.join(cache.get_cache_dir(), partial_name))
        except OSError:
            pass
        return series
    except Exception as exc:
        LAST_ERROR = f"{type(exc).__name__}: {exc}"
        return None
