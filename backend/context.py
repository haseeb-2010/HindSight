"""Descriptive context read from the weather record an analysis used.

The engine reports each climate indicator as two period means, a slope and a p-value
(backend/engine/trends.py). The charts in the app also need the yearly values behind those
numbers and a month-by-month picture of the record. This module reads them from the same
prepared record (engine.climate.prepare, including any what-if scenario) using the same
definitions and thresholds as the engine. It adds no model and changes no engine value:
backend/tests/test_api_insights.py checks that these yearly values reproduce the engine's
own period means.
"""
from __future__ import annotations

import numpy as np

from backend.engine.climate import prepare
from backend.engine.rotation import EROSIVE_MM, Y_END, Y_START

HOT_DAY_C = 35.0   # engine.trends: tmax > 35
FROST_DAY_C = 0.0  # engine.trends: tmin < 0
_MONTH_ENDS = np.cumsum([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])  # the engine's 365-day year


def climate_context(climate: dict, scenario: dict | None = None) -> dict:
    """Yearly indicator values and a monthly climatology for Y_START..Y_END."""
    clim = prepare(climate, scenario)
    years = list(range(Y_START, Y_END + 1))
    month = np.searchsorted(_MONTH_ENDS, clim["doy"], side="left") + 1
    in_warm_months = (month >= 4) & (month <= 9)
    warm = in_warm_months if clim["lat"] >= 0 else ~in_warm_months  # warm half-year flips south of the equator
    heavy = (clim["precip"] >= EROSIVE_MM).astype(float)
    hot = (clim["tmax"] > HOT_DAY_C).astype(float)
    frost = (clim["tmin"] < FROST_DAY_C).astype(float)

    daily = {  # ids match engine.trends.climate_shift
        "cool_season_rain_mm": clim["precip"] * ~warm,
        "warm_season_rain_mm": clim["precip"] * warm,
        "annual_et0_mm": clim["et0"],
        "hot_days": hot,
        "frost_days": frost,
        "heavy_rain_days": heavy,
    }
    year_masks = [clim["year"] == y for y in years]
    annual = {key: [round(float(series[m].sum()), 1) for m in year_masks] for key, series in daily.items()}

    in_record = (clim["year"] >= Y_START) & (clim["year"] <= Y_END)
    n_years = len(years)
    monthly = []
    for m in range(1, 13):
        sel = in_record & (month == m)
        monthly.append({
            "month": m,
            "rain_mm": round(float(clim["precip"][sel].sum() / n_years), 1),
            "et0_mm": round(float(clim["et0"][sel].sum() / n_years), 1),
            "heavy_rain_days": round(float(heavy[sel].sum() / n_years), 2),
            "hot_days": round(float(hot[sel].sum() / n_years), 2),
            "frost_days": round(float(frost[sel].sum() / n_years), 2),
            "mean_temp_c": round(float(clim["tmean"][sel].mean()), 1),
        })

    return {
        "record": {"start_year": Y_START, "end_year": Y_END},
        "scenario_applied": bool(clim["scenario_applied"]),
        "years": years,
        "annual": annual,
        "monthly": monthly,
        "thresholds": {"hot_day_c": HOT_DAY_C, "frost_day_c": FROST_DAY_C, "heavy_rain_mm": EROSIVE_MM},
        "warm_half_year_months": [4, 5, 6, 7, 8, 9] if clim["lat"] >= 0 else [10, 11, 12, 1, 2, 3],
        "note": ("Yearly totals and monthly averages of the NASA POWER record used for this analysis, "
                 "with the engine's own thresholds. Descriptive values, not model output."),
    }


def ndvi_coverage(ndvi: dict | None) -> dict:
    """What a stored MODIS NDVI series covers. Empty when there is none."""
    if not ndvi or not ndvi.get("dates"):
        return {}
    good = ndvi.get("good_quality") or []
    return {
        "source": ndvi.get("source"),
        "first_date": ndvi["dates"][0],
        "last_date": ndvi["dates"][-1],
        "observations": len(ndvi["dates"]),
        "good_quality_observations": int(sum(1 for g in good if g)),
    }
