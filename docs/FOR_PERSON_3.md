# For Person 3: what is in this package (Sun 15 Nov, 10:30)

This is the merged work of Person 1 and Person 2, cleaned and tested (`pytest backend/tests`: 49 pass). Tab 10 of the project doc still describes the layout and files; this note lists only what changed since then.

## Drop-in steps

1. Copy everything into the repo root, keeping paths. Person 1's files go on `p1/engine`; Person 2's on `p2/data` (or merge both at once if you prefer, since nothing overlaps your folders).
2. Do not commit: `__pycache__/`, `.pytest_cache/`, `desktop.ini`, `test_cache/`, `try_cache.py`, `backend/data/cache/ndvi_partial_*.json`. They are already removed here; add them to `.gitignore`.
3. Engine call in `service.py`:

```python
from backend.engine import run_analysis, EngineError
ndvi_pt = preset.get("ndvi_point") or {"lat": lat, "lon": lon}   # presets only; None for custom points is fine
result = run_analysis(request_dict, get_daily_climate(lat, lon), get_soil(lat, lon),
                      CROPS, LIBRARY, ndvi=get_ndvi_series(ndvi_pt["lat"], ndvi_pt["lon"]))
```

`get_ndvi_series` is slow when not cached, so call it only for the three presets (all are cached).

## Changes that touch you

| What | Action |
| --- | --- |
| Engine 0.3.0 adds `scores.rank_range`, `scores.rank_range_rain`, `hindcast.worst_years`, `ndvi_check.p_value` | Optional to display; Pydantic models must allow extra keys |
| `ndvi_check` can be `null` (irrigated sites) | Hide the NDVI panel when null |
| `presets.json`: `_note` gone; `rotation_note` (Sheikhupura) and `ndvi_point` (Chakwal) added | Allow extra keys; you may show `rotation_note` as a small caption |
| `presets.json` is now UTF-8 without BOM | Plain `json.load` works |
| Mock and `backend/data/saved/*.json` regenerated with 0.3.0, real NASA data | Use the mock for building; saved files are the fallback |

## Suggested badges on each rotation card (all from existing keys)

- **Robust** when `rank_range` min == max and `rank_range_rain` min == max.
- **Worst years:** "In your worst years (1998–2002): 0.28 vs 0.22" from `hindcast.worst_years.mean_index` of this card and of the current rotation.

## Numbers that are safe to show (also for Person 4)

- Worst simulated years match the 2012 US drought and Pakistan's 1998–2002 drought.
- Chakwal NDVI check: r = 0.59 over 24 years (p = 0.003).
- Chakwal: wheat then fallow fell below the failure line in 14 of 40 seasons; field pea then fallow in 8 of 40.
- The top Chakwal rotation stays #1 even if NASA rainfall is 30% off.
