# Hindsight validation (engine v0.3.0, 15 Nov 2026)

Every number below comes from the engine run on real NASA POWER daily data (1984–2024) and real MODIS NDVI (2001–2024), all cached in `backend/data/cache/`. Reproduce with `python scripts/run_site.py <preset>` and `pytest backend/tests` (49 tests pass).

## 1. The engine finds known droughts it was never told about

No yield or drought records go into the engine: only weather, soil and crop parameters. Its worst simulated years still match documented droughts.

| Site and current rotation | Worst simulated years (annual index) | Documented drought |
| --- | --- | --- |
| Ames, Iowa: maize, soybean | **2012** (0.54), 2013 (0.58), **1988** (0.60) | 2012: worst US drought since the 1950s; USDA cut the national corn yield forecast by 22.6 bu/acre to 123.4, the lowest since 1995/96 ([USDA ERS, Aug 2012](https://ers.usda.gov/data-products/charts-of-note/76002); [Westcott & Jewison 2013, USDA ERS FDS-13g-01](https://primary.ers.usda.gov/webdocs/outlooks/36651/39297_fds-13g-01.pdf)). Iowa's corn yield fell to 137 bu/acre from 172 in 2011. |
| Chakwal, rainfed: wheat then fallow | **2001** (0.03), **1998** (0.21), **2000** (0.25), **2002** (0.30) | 1998–2002: the most severe drought in Pakistan's recorded history ([Pakistan Meteorological Department report](https://www.pmd.gov.pk/journal/historyworstdrought2001report.htm); [Ahmad et al. 2004, IWMI Working Paper 85](http://www.iwmi.cgiar.org/Publications/Working_Papers/working/WOR85.pdf)) |

These are qualitative matches of timing, not a yield validation. Both are automated tests in `backend/tests/test_engine_real.py`.

## 2. Independent satellite check (MODIS NDVI, 2001–2024)

Pearson correlation between the current rotation's annual index and the peak NDVI in months when that rotation has a crop in the field (good-quality pixels only).

| Site | NDVI pixel | r | Years | p-value | Reading |
| --- | --- | --- | --- | --- | --- |
| Chakwal | 32.93, 72.95 (cropland, 9 km east of the weather point) | **0.59** | 24 | **0.003** | Clear agreement |
| Ames | 42.03, −93.63 | 0.39 | 24 | 0.06 | Weak, borderline |
| Sheikhupura | 31.71, 73.98 | n/a | — | — | Full irrigation keeps the index at 1.0 every year, so a correlation is undefined |

**Why a different Chakwal pixel.** At the weather point (32.93, 72.86) NDVI never exceeds 0.25 over 24 years, while cropland usually peaks around 0.5–0.7. That 250 m pixel is mostly Chakwal town. There, r = 0.27 (n = 20). Person 2 downloaded a cropland pixel 9 km east (NDVI up to 0.63), which lies in the same NASA POWER weather cell. It is set as `ndvi_point` in `presets.json`. We report both numbers.

Limits: one pixel may mix fields; NDVI measures greenness, not grain; the check covers only the current rotation.

## 3. NASA rainfall bias, and why the rankings survive it

Person 2 compared NASA POWER with published normals (`docs/DATA_SOURCES.md`): rainfall is about 48% higher than WorldClim at Chakwal, about 36% lower than the Lahore station at Sheikhupura, and within about 9% at Ames. Temperatures agree within about 2 °C.

We do not adjust the data. Instead the engine re-runs every shown rotation with rainfall 30% lower and 30% higher and reports each rotation's rank range (`scores.rank_range_rain`).

| Site | Top rotation | Rank with rain −30% / +30% |
| --- | --- | --- |
| Chakwal | Field pea then fallow | #1 in both; #2 also unchanged; the current rotation stays last (#6) |
| Ames | Sorghum, soybean (2-year) | #1 in both |
| Sheikhupura (irrigated) | Soybean then wheat | #1–#2 |

So absolute index values should be read as relative, but which rotation comes out ahead is robust to the known rainfall error.

## 4. Robustness to the legume effect

The legume boost is the least certain parameter (+7% to +32%, Zhao et al. 2022). Re-ranking with it at 0%, 7%, 20% and 32% leaves every Chakwal rank unchanged. At Ames and Sheikhupura, ranks move by at most two places (`scores.rank_range`).

## 5. Worst-years test

In Chakwal's five worst years for the current rotation (1994, 1998, 2000, 2001, 2002), wheat-then-fallow averaged an index of 0.22. Every alternative shown averaged higher (0.28–0.33).

## 6. Numerical checks (`pytest backend/tests`)

| Check | Result |
| --- | --- |
| Water mass balance over 41 years (synthetic: rainfed, full, limited; real Chakwal: full) | Closes within 0.1 mm |
| FAO-56 Example 18 | 3.9 mm/day reproduced within 5% |
| Full irrigation | ΣETa/ΣETc > 0.999 on crop days |
| No rain | Index 0 |
| Determinism | Identical JSON on repeat |
| Output is strict JSON (no NaN) | Pass, including the irrigated case |
| Person 2 data tests (power, soil, NDVI) | 35 pass |

## 7. Cautions

- **Climate-shift numbers at Chakwal** (warm-season rain 427 → 760 mm; hot days 145 → 100) are very large. Given the rainfall bias above, they may partly be reanalysis artefacts. Show them with their p-values; do not make them the headline.
- **Irrigated Sheikhupura:** every rotation scores about 1.0 because water stress is removed. The useful comparison there is irrigation demand (about 680–990 mm a year).
- **Rice:** no sourced Ky, so it is not scored. Sheikhupura uses cotton then wheat.
- **One extreme day:** NASA POWER shows 329.6 mm on one day at Chakwal. It is kept as delivered.
