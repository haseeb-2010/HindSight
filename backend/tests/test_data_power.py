"""Checks on the cached NASA POWER files. No internet is used: offline mode is
forced, so a missing cache file fails the test instead of downloading."""

import pytest

from backend.data_sources.errors import DataSourceError
from backend.data_sources.power import _fill_gaps, get_daily_climate

# (lat, lon) of the three demo sites
SITES = [(32.93, 72.86), (31.71, 73.98), (42.03, -93.63)]

REQUIRED_KEYS = [
    "source", "lat", "lon", "elevation_m", "grid_note", "start", "end", "dates",
    "tmax_c", "tmin_c", "precip_mm", "srad_mj_m2", "rh_pct", "wind_ms",
    "gwetroot_frac", "filled_counts", "fetched_at",
]
ARRAY_KEYS = [
    "tmax_c", "tmin_c", "precip_mm", "srad_mj_m2", "rh_pct", "wind_ms", "gwetroot_frac",
]


@pytest.fixture(params=SITES, ids=["chakwal", "sheikhupura", "ames"])
def series(request, monkeypatch):
    monkeypatch.setenv("HINDSIGHT_OFFLINE", "1")
    lat, lon = request.param
    return get_daily_climate(lat, lon)


def test_required_keys(series):
    for key in REQUIRED_KEYS:
        assert key in series, f"missing key {key}"


def test_arrays_match_dates(series):
    n = len(series["dates"])
    for key in ARRAY_KEYS:
        assert len(series[key]) == n, f"{key} has a different length"


def test_date_count_and_format(series):
    dates = series["dates"]
    assert len(dates) == 14965
    assert dates[0] == "1984-01-01" and dates[-1] == "2024-12-31"
    assert series["start"] == dates[0] and series["end"] == dates[-1]
    assert dates == sorted(set(dates)), "dates must be unique and in order"
    assert not any(d.endswith("-02-29") for d in dates), "29 February must be removed"


def test_no_minus_999(series):
    for key in ARRAY_KEYS:
        assert -999 not in series[key], f"{key} still contains -999"


def test_tmax_not_below_tmin(series):
    for day, hi, lo in zip(series["dates"], series["tmax_c"], series["tmin_c"]):
        if hi is not None and lo is not None:
            assert hi >= lo, f"tmax below tmin on {day}"


def test_precip_not_negative(series):
    assert all(v >= 0 for v in series["precip_mm"] if v is not None)


def test_gwetroot_between_0_and_1(series):
    assert all(0 <= v <= 1 for v in series["gwetroot_frac"] if v is not None)


def test_offline_without_cache_fails_cleanly(monkeypatch, tmp_path):
    monkeypatch.setenv("HINDSIGHT_OFFLINE", "1")
    monkeypatch.setenv("HINDSIGHT_CACHE_DIR", str(tmp_path))
    with pytest.raises(DataSourceError):
        get_daily_climate(32.93, 72.86)


def test_fill_gaps_short_gap_is_interpolated():
    values, filled = _fill_gaps([1.0, None, None, 4.0])
    assert values == [1.0, 2.0, 3.0, 4.0]
    assert filled == 2


def test_fill_gaps_long_gap_and_edges_stay_null():
    long_gap = [1.0] + [None] * 6 + [8.0]
    values, filled = _fill_gaps(long_gap)
    assert values == long_gap and filled == 0
    values, filled = _fill_gaps([None, 2.0, 3.0, None])
    assert values == [None, 2.0, 3.0, None] and filled == 0
