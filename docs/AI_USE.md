# AI use

Every AI-assisted file, by owner. Person 3 and Person 4 add their own sections.

## Person 1 (engine and science)

| File | Tool | What it did |
|---|---|---|
| backend/engine/*.py | Claude (Anthropic) | drafted the engine; Person 1 reviewed and ran the tests |
| backend/tests/test_engine_core.py, test_engine_real.py, synthetic.py | Claude (Anthropic) | wrote engine tests and the synthetic test-weather generator |
| backend/data/crops.json | Claude (Anthropic) | transcribed values from FAO-56 Tables 11, 12, 22, FAO-66 Table 1 (FAO-33 Ky) and the EcoCrop database; Person 1 spot-checked |
| backend/data/rotations_library.json, presets values | Claude (Anthropic) | proposed rotations and preset settings; Person 1 approved |
| backend/data/mock/, backend/data/saved/ | Hindsight engine | real engine output on NASA POWER data (not AI-written) |
| scripts/run_site.py | Claude (Anthropic) | wrote the script that runs a preset and saves the response |
| docs/METHODOLOGY.md, VALIDATION.md, ENGINE_CHANGELOG.md | Claude (Anthropic) | drafted; Person 1 checked every claim |
| Project blueprint, contract and team prompts | Claude (Anthropic) | drafted the plan in the shared project doc |

## Person 2 (data fetching and caching)

| File | Tool | What it did |
|---|---|---|
| backend/data_sources/errors.py | Claude (Anthropic) | wrote the DataSourceError exception class |
| backend/data_sources/cache.py | Claude (Anthropic) | wrote cache folder lookup, offline check, and atomic JSON read/write |
| backend/data_sources/power.py | Claude (Anthropic) | wrote the NASA POWER fetch, gap filling, Feb 29 removal and cache logic |
| scripts/check_power.py | Claude (Anthropic) | wrote a one-request NASA POWER check that prints parameters, units, date counts and elevation |
| scripts/fetch_presets.py | Claude (Anthropic) | wrote the script that fetches the three demo sites and prints rainfall and temperature summaries |
| backend/tests/test_data_power.py | Claude (Anthropic) | wrote offline tests for the cached POWER files and the gap-filling logic |
| backend/data_sources/soilgrids.py | Claude (Anthropic) | wrote the SoilGrids lookup, unit conversion, USDA texture class and fail-safe caching |
| CHANGELOG_FIXES.md | Claude (Anthropic) | drafted the log of fixes and deviations |
| backend/data/presets.json | Claude (Anthropic) | saved Person 1's three preset entries unchanged and checked their format and cache files |
| backend/data_sources/modis_ndvi.py | Claude (Anthropic) | wrote the MODIS NDVI download with scaling, quality flags, caching and resumable progress |
| docs/DATA_SOURCES.md | Claude (Anthropic) | drafted dataset descriptions, limitations, demo-site summary and citations |
| backend/tests/test_data_soil.py | Claude (Anthropic) | wrote offline tests for the soil lookup, texture classes and failure handling |
| backend/tests/test_data_ndvi.py | Claude (Anthropic) | wrote offline tests for NDVI scaling, quality flags, grouping, resume and offline mode |
