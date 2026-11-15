"""Small helpers for reading and writing cache files.

Cache folder: HINDSIGHT_CACHE_DIR if set, otherwise backend/data/cache.
Offline mode: HINDSIGHT_OFFLINE=1 means the data sources must not use the network.
This file never touches the network.
"""
import json
import os
from pathlib import Path

DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"


def get_cache_dir() -> Path:
    value = os.environ.get("HINDSIGHT_CACHE_DIR", "").strip()
    return Path(value) if value else DEFAULT_CACHE_DIR


def is_offline() -> bool:
    return os.environ.get("HINDSIGHT_OFFLINE", "0").strip() == "1"


def read_cache(file_name: str):
    """Return the saved data, or None if the file is missing or unreadable."""
    path = get_cache_dir() / file_name
    if not path.is_file():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write_cache(file_name: str, data) -> Path:
    """Save data as JSON. NaN is refused so bad values cannot be saved."""
    folder = get_cache_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / file_name
    temp_path = path.with_name(path.name + ".tmp")
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, allow_nan=False)
    os.replace(temp_path, path)
    return path
