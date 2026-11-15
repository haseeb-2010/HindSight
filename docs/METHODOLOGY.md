# Hindsight methodology (engine v0.1.0)

Hindsight replays a crop rotation day by day through NASA POWER daily weather (1984–2024; 1984 is spin-up) and reports how it would have performed in each real year. It is not a forecast and reports no yield in tonnes.

## Pipeline (code in `backend/engine/`)

| Step | Method | Source | File |
| --- | --- | --- | --- |
| 1. Clean weather | Drop 29 Feb; fill leftover nulls with the record's day-of-year mean; fill missing solar radiation with the Hargreaves radiation formula | FAO-56 eq. 50 | `climate.py` |
| 2. Reference ET | FAO Penman-Monteith, daily; ea from mean RH | FAO-56 eq. 6 | `et0.py` |
| 3. Soil water | Field capacity and wilting point from sand, clay, organic matter | Saxton & Rawls 2006, Table 1 | `soil.py` |
| 4. Daily balance | One profile bucket (AWC × depth). Root-zone TAW = AWC × min(root depth, soil depth); depletion = (1 − fill) × TAW; Ks from RAW = p × TAW; ETa = Ks × Kc × ET0. Rain first, excess above capacity drains. | FAO-56 ch. 8 | `rotation.py` |
| 5. Crop curves | Four-stage Kc curve; roots grow 0.3 m → max by mid-season | FAO-56 ch. 6 | `season.py` |
| 6. Season index | S = max(0, 1 − Ky(1 − ΣETa/ΣETc)) × f_T × m_legume; S = 0 if any day is below the crop's kill temperature | FAO-33/66; EcoCrop; Zhao et al. 2022 | `season.py`, `rotation.py` |
| 7. Hindcast | One run per starting phase; annual index = mean of seasons ending that year | — | `rotation.py` |
| 8. Indicators and ranking | Min-max normalised, farmer weights 0–5, Pareto mark | — | `ranking.py` |
| 9. Climate shift | 1985–2004 vs 2005–2024; Theil-Sen slope; Kendall p-value | scipy | `trends.py` |
| 10. Explanations | Fixed templates filled from the numbers above | — | `explain.py` |

## Labelled assumptions

1. Soil water carries between crops as one evenly wet profile.
2. Bare fallow evaporates with Kc 0.2, root depth 0.3 m.
3. Legume effect: flat ×1.20 on the next non-legume crop (field range +7% to +32%); can be switched off.
4. A season fails when S < 0.5 (user-adjustable).
5. f_T uses the season's mean temperature.
6. Irrigation ("full") applies exactly the root-zone depletion whenever it exceeds RAW; "limited" stops at the seasonal cap.
7. Heat-day thresholds per crop are assumptions, reported only, never multiplied into S.

## Not modelled

Pests, disease, nutrients, salinity, variety, management, flooded-rice percolation, runoff by slope. Weather is a ~50 km grid-cell estimate.

## Crop parameters

`backend/data/crops.json`. Every value was first recalled from memory and is `verified: false` until checked against the cited table. Crops without a sourced Ky (rice, chickpea, mung bean, pearl millet, mustard) cannot run. The API shows only verified crops.

## Sowing dates used for presets

TO FILL: cite a Pakistani (PARC / Punjab Agriculture Department) and a US (ISU Extension) source for each date in `presets.json`.

## Checks (see VALIDATION.md)

- Water mass balance closes within 0.1 mm over 41 years (tested for rainfed, full, limited).
- ET0 matches FAO-56 Example 18 (3.9 mm/day) within 5%.
- With full irrigation, ΣETa/ΣETc > 0.999 on crop days; with no rain the index is 0.
- Deterministic; one analysis takes ~0.3 s.
- To run on real data: MODIS NDVI correlation with the annual index, reported whatever it is.

## Added in engine 0.2.0

- **Worst-years test.** The 5 years with the lowest index for the farmer's current rotation are identified from the record. Every alternative's mean index in those same years is reported, which answers "would this have protected me when it mattered most?"
- **Rank robustness.** The legume effect is the least certain parameter (+7% to +32% in Zhao et al. 2022). Each rotation is re-ranked with the effect at 0%, 7%, 20% and 32%, and its rank range is reported. A rotation whose rank does not move is robust to that uncertainty.

## Added in engine 0.3.0

- **Rainfall robustness.** NASA POWER rainfall differs from published normals by +48% (Chakwal) and −36% (Sheikhupura) (see DATA_SOURCES.md). The engine re-simulates each shown rotation with rainfall ×0.7 and ×1.3 and reports its rank range. The data itself is never adjusted.
- **NDVI check point.** A preset may name an `ndvi_point` (a cropland pixel inside the same weather cell) for the satellite check. Chakwal uses 32.93, 72.95, because the weather point's pixel is mostly town.
- **NDVI check** now reports a p-value and returns `null` when the index never varies (full irrigation).
