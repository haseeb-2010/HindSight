# CHANGELOG_FIXES.md

Log of every fix, workaround or deviation from the original plan made by Person 2 (data). Newest entries go at the bottom.

## 1. No `__init__.py` in `backend/data_sources/` (Sat 2026-11-14)
- **Problem:** The spec's repo layout lists no `__init__.py` for `data_sources/`, so it was unclear whether `backend.data_sources` would import.
- **Resolution:** Left it out. Python 3.11 treats the folder as a namespace package, and imports worked in every test. The modules use relative imports (`from . import cache`), so they must be imported as part of the package (`backend.data_sources.power`) and run from the repo root.
- **Files changed:** none added; affects `backend/data_sources/power.py`, `backend/data_sources/soilgrids.py`.

## 2. `scripts/fetch_presets.py` could not import `backend` (Sat 2026-11-14)
- **Problem:** Running `py -3.11 scripts\fetch_presets.py` puts `scripts/` on the import path, not the repo root, so `import backend...` would fail.
- **Resolution:** The script inserts the repo root (the parent of `scripts/`) into `sys.path` before importing.
- **Files changed:** `scripts/fetch_presets.py`.

## 3. `filled_counts` lists only variables that were actually filled (Sat 2026-11-14)
- **Problem:** The spec shows `"filled_counts": {"srad_mj_m2": 3}` but does not say whether unfilled variables appear with 0.
- **Resolution:** Follow the spec example: only variables with at least one filled day appear. For all three demo sites this is `{}` because NASA POWER returned no missing values. Consumers should use `.get(key, 0)`.
- **Files changed:** `backend/data_sources/power.py`.

## 4. ClimateSeries cache is keyed by lat/lon only (Sat 2026-11-14)
- **Problem:** The spec fixes the cache name as `power_<lat>_<lon>.json` (no years), but `get_daily_climate` accepts `start_year` and `end_year`.
- **Resolution:** A cache file is reused only if its first and last year match the requested years exactly; otherwise it is treated as a miss (downloaded again when online, a clean `DataSourceError` when offline). All demo sites use the default 1984-2024, so they always hit the cache.
- **Files changed:** `backend/data_sources/power.py`.

## 5. pytest missing on Person 2's PC (Sat 2026-11-14)
- **Problem:** `py -3.11 -m pytest` failed with `No module named pytest`.
- **Resolution:** Installed pytest locally with `py -3.11 -m pip install pytest`. pytest is already in the project's package list, so `requirements.txt` was not touched.
- **Files changed:** none in the repo.

## 6. SoilGrids returns no data at some demo points and times out (Sat 2026-11-14)
- **Problem:** The real SoilGrids response for Chakwal (32.93, 72.86) has `null` in every layer and depth. Sheikhupura (31.71, 73.98) gave all-null in one probe and a 15 s timeout in another. About 2 of 5 probe requests timed out. A point about 9 km east of Chakwal and Ames returned real values.
- **Resolution:** `get_soil` returns `None` for all-null, timeouts, HTTP errors and malformed replies, and never raises. A genuine "no data" answer is cached as `{"profile": null}` so demos are repeatable offline; failures are not cached so they can be retried. The demo points were NOT moved to nearby pixels, because that would change what the data means. Per spec section 7, the service falls back to the farmer's texture and adds a warning.
- **Files changed:** `backend/data_sources/soilgrids.py`; cache files `backend/data/cache/soil_*.json`.

## 7. SoilProfile fields SoilGrids cannot supply (Sat 2026-11-14)
- **Problem:** SoilGrids was read for 0-30 cm only, so it says nothing about total soil depth. `organic_matter_pct` and `ph` may also be missing while sand and clay are present.
- **Resolution:** A SoilGrids profile has `"depth_cm": null` (spec: missing = null, never invented). `organic_matter_pct` and `ph` are null if their layers are missing. If sand or clay is missing the whole result is `None`, since the texture class cannot be worked out. `service.py` should take depth from the farmer's input.
- **Files changed:** `backend/data_sources/soilgrids.py`.

## 8. presets.json kept exactly as Person 1 supplied it, including the `_note` field (Sat 2026-11-14)
- **Problem:** Person 1's Sheikhupura preset has an extra `_note` key that the spec's preset format does not list. Its text also says the crop pair may change from cotton-wheat to rice-wheat if Person 1 finds a sourced Ky by Sat 23:00.
- **Resolution:** Saved Person 1's JSON unchanged, with no values added, inferred or removed, because soil, water and rotation values are Person 1's. Person 3's schema must ignore or allow the extra `_note` key. If Person 1 switches to rice-wheat, only the Sheikhupura rotation slots in `presets.json` need to be replaced.
- **Files changed:** `backend/data/presets.json`.

## 9. UTF-8 BOM broke JSON loading of presets.json (Sat 2026-11-14)
- **Problem:** `presets.json` written with PowerShell 5.1 `Set-Content -Encoding utf8` starts with a byte-order mark, and `json.load` failed with "Unexpected UTF-8 BOM (decode using utf-8-sig)". Strict JSON readers (Python, Node, browsers) can fail the same way.
- **Resolution:** Re-saved the file as UTF-8 without BOM using `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))`. Any JSON file created from now on is written the same way. Python source files and Markdown files written with `-Encoding utf8` still have a BOM, which Python accepts in source files, so they were left alone.
- **Files changed:** `backend/data/presets.json`.

## 10. MODIS service is slow and sometimes returns 503 (Sat 2026-11-14)
- **Problem:** The ORNL MODIS service took 30-50 s per request and returned HTTP 503 on some requests, including the date list. One year (6 data requests) took 419 s, so a full 2001-2024 series (about 112 requests per site) takes over an hour, and the first version lost all progress on any failure.
- **Resolution:** `get_ndvi_series` now saves progress to `ndvi_partial_<lat>_<lon>.json` after every request and resumes from it on the next call; the partial file is deleted once the final `ndvi_<lat>_<lon>.json` is written. Request timeout raised from 60 s to 120 s and retry wait from 2 s to 5 s. If the date list cannot be fetched, the standard 16-day composite calendar (day of year 1, 17, ... 353) is used instead. The full run is started in separate PowerShell windows (one per site) with a loop that resumes after failures.
- **Files changed:** `backend/data_sources/modis_ndvi.py`; cache files `backend/data/cache/ndvi_*.json`.

## 11. NASA POWER rainfall differs from published normals at both Pakistan sites (Sat 2026-11-14)
- **Problem:** Chakwal's NASA POWER mean (804 mm) is about 48 % above the WorldClim reference (544 mm); Sheikhupura (483 mm) is about 36 % below the Lahore station normal (758.8 mm). Ames agrees within about 9 %. No official PMD station normal for Chakwal was found.
- **Resolution:** Kept the data unchanged (adjusting it would be inventing values). Documented the comparison and its meaning in DATA_SOURCES.md so results are read as relative comparisons between rotations. Person 1 should mention this in VALIDATION.md and METHODOLOGY.md.
- **Files changed:** `docs/DATA_SOURCES.md`.

## 12. Chakwal NDVI pixel looks like town, not cropland (Sun 2026-11-15)
- **Problem:** The MODIS NDVI series at the Chakwal demo point (32.93, 72.86) ranges only 0.10-0.25 over 2001-2024 (552 dates, none missing, 145 rated good quality). Cropland normally peaks around 0.5-0.7, so the 250 m pixel is probably mostly built-up or bare ground (the point lies on Chakwal town). SoilGrids also returns no data at this point. This is an interpretation, not stated by the service.
- **Resolution:** Kept and delivered the file unchanged (`ndvi_32.93_72.86.json`). Flagged to Person 1 that the NDVI check at this exact point may be weak for reasons unrelated to the model. Offered an optional extra download at a nearby cropland point if the team decides to use one; that point would need to be agreed and stated in VALIDATION.md.
- **Files changed:** `backend/data/cache/ndvi_32.93_72.86.json` (new).

## 14. NDVI progress files were not removed automatically (Sun 2026-11-15)
- **Problem:** After all four NDVI downloads finished, their `ndvi_partial_*.json` progress files were still in the cache. The final files were complete (552 dates each); the automatic delete apparently failed silently on Windows.
- **Resolution:** Deleted the four partial files by hand. They must never be committed. DATA_SOURCES.md section 3 updated from "in progress" to "used", with a table of the four NDVI files; the Chakwal farm point (max NDVI 0.63) confirms it is cropland.
- **Files changed:** `docs/DATA_SOURCES.md`; removed `backend/data/cache/ndvi_partial_*.json`.
