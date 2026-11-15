"""Checks on modis_ndvi.py using a fake MODIS service. No internet is used."""

import pytest

from backend.data_sources import modis_ndvi
from backend.data_sources.modis_ndvi import _computed_dates, _ndvi_value, get_ndvi_series


class FakeReply:
    def __init__(self, data, status=200):
        self._data = data
        self.status_code = status

    def json(self):
        return self._data


def make_fake_service(fail_after=None):
    """A fake MODIS service. NDVI raw value = 1000 + day of year, except day 17
    which is the fill value. Reliability is 0 (good) on odd days of year."""
    calls = {"n": 0}

    def fake_get(url, params=None, headers=None, timeout=None):
        calls["n"] += 1
        assert headers == {"Accept": "application/json"}
        if fail_after is not None and calls["n"] > fail_after:
            return FakeReply({}, 503)
        if url.endswith("/dates"):
            return FakeReply({"dates": [
                {"modis_date": m, "calendar_date": c} for m, c in _computed_dates(2001, 2002)
            ]})
        wanted = [m for m, _ in _computed_dates(2001, 2002)
                  if params["startDate"] <= m <= params["endDate"]]
        assert len(wanted) <= 10, "more than ten dates in one request"
        subset = []
        for m in wanted:
            doy = int(m[5:])
            if params["band"] == modis_ndvi.NDVI_BAND:
                value = -3000 if doy == 17 else 1000 + doy
            else:
                value = 0 if doy % 2 else 1
            subset.append({"modis_date": m, "data": [value]})
        return FakeReply({"subset": subset})

    return fake_get, calls


@pytest.fixture
def quiet(monkeypatch, tmp_path):
    monkeypatch.delenv("HINDSIGHT_OFFLINE", raising=False)
    monkeypatch.setenv("HINDSIGHT_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(modis_ndvi, "PAUSE_S", 0)
    monkeypatch.setattr(modis_ndvi, "RETRY_WAIT_S", 0)
    return tmp_path


def test_ndvi_scaling_and_fill():
    assert _ndvi_value(1209) == 0.1209
    assert _ndvi_value(-3000) is None
    assert _ndvi_value(None) is None
    assert _ndvi_value(20000) is None


def test_computed_calendar_has_23_dates_per_year():
    dates = _computed_dates(2001, 2001)
    assert len(dates) == 23
    assert dates[0] == ("A2001001", "2001-01-01")
    assert dates[-1] == ("A2001353", "2001-12-19")


def test_full_series_shape_and_values(quiet, monkeypatch):
    fake_get, _ = make_fake_service()
    monkeypatch.setattr(modis_ndvi.requests, "get", fake_get)
    s = get_ndvi_series(32.93, 72.86, 2001, 2002)
    assert s is not None, modis_ndvi.LAST_ERROR
    assert list(s.keys()) == ["source", "lat", "lon", "dates", "ndvi", "good_quality"]
    assert len(s["dates"]) == len(s["ndvi"]) == len(s["good_quality"]) == 46
    assert s["dates"][0] == "2001-01-01"
    assert s["ndvi"][0] == 0.1001 and s["good_quality"][0] is True
    assert s["ndvi"][1] is None and s["good_quality"][1] is False   # fill value
    assert s["good_quality"][2] is True                              # day 33, odd
    assert (quiet / "ndvi_32.93_72.86.json").exists()
    assert not (quiet / "ndvi_partial_32.93_72.86.json").exists()


def test_resumes_after_failure(quiet, monkeypatch):
    failing, _ = make_fake_service(fail_after=4)
    monkeypatch.setattr(modis_ndvi.requests, "get", failing)
    assert get_ndvi_series(32.93, 72.86, 2001, 2002) is None
    assert (quiet / "ndvi_partial_32.93_72.86.json").exists()

    working, calls = make_fake_service()
    monkeypatch.setattr(modis_ndvi.requests, "get", working)
    s = get_ndvi_series(32.93, 72.86, 2001, 2002)
    assert s is not None and len(s["dates"]) == 46
    # 5 groups x 2 bands = 10 data requests in total; some were saved before the failure
    assert calls["n"] < 1 + 10


def test_offline_without_cache_returns_none(monkeypatch, tmp_path):
    monkeypatch.setenv("HINDSIGHT_OFFLINE", "1")
    monkeypatch.setenv("HINDSIGHT_CACHE_DIR", str(tmp_path))

    def must_not_call(*args, **kwargs):
        raise AssertionError("network used in offline mode")

    monkeypatch.setattr(modis_ndvi.requests, "get", must_not_call)
    assert get_ndvi_series(32.93, 72.86) is None
