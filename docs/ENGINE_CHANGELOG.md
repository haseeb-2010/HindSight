# Engine changelog (for Person 3 and Person 4)

## 0.3.0 (Sun 15 Nov, 10:30)
Additive only, plus one bug fix. Nothing existing was renamed or removed.

| Change | Detail |
| --- | --- |
| New `rotations[].scores.rank_range_rain` | `[min, max]` rank with NASA rainfall 30% lower and 30% higher. Show as "Robust to rainfall error" when min == max. |
| New `validation.ndvi_check.p_value` | Significance of the NDVI correlation. |
| **Bug fix:** `validation.ndvi_check` | Was `{"r": NaN}` at irrigated sites, which is invalid JSON and would crash `JSON.parse`. It is now `null` when a correlation is undefined. |
| `presets.json`: `_note` removed | Replaced by `rotation_note` on Sheikhupura (text only). |
| `presets.json`: new optional `ndvi_point` on Chakwal | `{"lat": 32.93, "lon": 72.95, "why": ...}`. When calling `get_ndvi_series`, use `ndvi_point` if present, else the preset's lat/lon. The weather call always uses the preset's lat/lon. |
| Explanation text | `reasons` gains a rainfall-robustness sentence; the first `gaps` line now mentions rainfall. |

Mock and saved responses are regenerated with 0.3.0.

## 0.2.0 (Sat 14 Nov, 19:00)
Additive only. No existing key was renamed or removed, so nothing breaks if you ignore the new keys.

| New key | Type | Meaning | Suggested display |
| --- | --- | --- | --- |
| `rotations[].hindcast.worst_years` | `{"years": [int x5], "mean_index": float}` | The current rotation's 5 worst years, and this rotation's average index in those same years | Card line: "In your worst years (1998-2002): 0.28 vs 0.22" |
| `rotations[].scores.rank_range` | `[min, max]` | This rotation's rank with the legume effect at 0%, 7%, 20% and 32% | Badge "Robust" when min == max; otherwise "#1-#3" |

Text changes: `explanation.summary` now gives exact counts and the worst year, for example "Would have fallen below the failure line in 14 of 40 crop seasons (35%), mostly from dry spells. Worst year: 2001." `explanation.reasons` gains the worst-years and robustness sentences.

The mock file `backend/data/mock/analyze_response.json` is the real Chakwal output with these fields.

## 0.1.0
First version matching CONTRACT.md.
