"""Checks on soilgrids.py. No internet is used: offline mode is forced or the
network call is replaced, so these tests run anywhere."""

import requests

from backend.data_sources import soilgrids
from backend.data_sources.soilgrids import get_soil, texture_class

PROFILE_KEYS = ["source", "texture_class", "sand_pct", "clay_pct", "organic_matter_pct", "ph", "depth_cm"]
USDA_CLASSES = {
    "sand", "loamy_sand", "sandy_loam", "loam", "silt_loam", "silt",
    "sandy_clay_loam", "clay_loam", "silty_clay_loam", "sandy_clay", "silty_clay", "clay",
}


def test_texture_class_known_points():
    assert texture_class(40, 20) == "loam"
    assert texture_class(90, 5) == "sand"
    assert texture_class(10, 60) == "clay"
    assert texture_class(15.2, 33.3) == "silty_clay_loam"


def test_texture_class_covers_whole_triangle():
    found = set()
    for sand in range(0, 101):
        for clay in range(0, 101 - sand):
            found.add(texture_class(sand, clay))
    assert found == USDA_CLASSES


def test_ames_cached_profile(monkeypatch):
    monkeypatch.setenv("HINDSIGHT_OFFLINE", "1")
    profile = get_soil(42.03, -93.63)
    assert profile is not None, "soil_42.03_-93.63.json missing from the cache"
    assert list(profile.keys()) == PROFILE_KEYS
    assert profile["source"] == "soilgrids"
    assert profile["texture_class"] in USDA_CLASSES
    assert 0 <= profile["sand_pct"] <= 100 and 0 <= profile["clay_pct"] <= 100
    assert profile["depth_cm"] is None


def test_chakwal_cached_no_data_is_none(monkeypatch):
    monkeypatch.setenv("HINDSIGHT_OFFLINE", "1")
    assert get_soil(32.93, 72.86) is None


def test_offline_without_cache_returns_none(monkeypatch, tmp_path):
    monkeypatch.setenv("HINDSIGHT_OFFLINE", "1")
    monkeypatch.setenv("HINDSIGHT_CACHE_DIR", str(tmp_path))
    assert get_soil(10.0, 10.0) is None


def test_timeout_returns_none_and_is_not_cached(monkeypatch, tmp_path):
    monkeypatch.delenv("HINDSIGHT_OFFLINE", raising=False)
    monkeypatch.setenv("HINDSIGHT_CACHE_DIR", str(tmp_path))

    def fake_get(*args, **kwargs):
        raise requests.exceptions.ReadTimeout("simulated timeout")

    monkeypatch.setattr(soilgrids.requests, "get", fake_get)
    assert get_soil(10.0, 10.0) is None
    assert list(tmp_path.iterdir()) == []
