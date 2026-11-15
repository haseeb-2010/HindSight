"""Climate shift between the two windows, with Theil-Sen slope and Mann-Kendall (Kendall tau) p-value."""
import numpy as np
from scipy.stats import theilslopes, kendalltau
from .rotation import Y_START, Y_END, EROSIVE_MM


def climate_shift(clim, windows):
    yrs = np.arange(Y_START, Y_END + 1)
    north = clim["lat"] >= 0
    month = np.searchsorted(np.cumsum([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]), clim["doy"], side="left") + 1
    warm = (month >= 4) & (month <= 9) if north else ~((month >= 4) & (month <= 9))
    defs = [
        ("cool_season_rain_mm", "Rain in the cool half-year", "mm", clim["precip"] * ~warm),
        ("warm_season_rain_mm", "Rain in the warm half-year", "mm", clim["precip"] * warm),
        ("annual_et0_mm", "Reference evapotranspiration", "mm", clim["et0"]),
        ("hot_days", "Days above 35 °C", "days", (clim["tmax"] > 35).astype(float)),
        ("frost_days", "Days below 0 °C", "days", (clim["tmin"] < 0).astype(float)),
        ("heavy_rain_days", "Days with 12.7 mm of rain or more", "days", (clim["precip"] >= EROSIVE_MM).astype(float)),
    ]
    out = []
    for key, label, unit, daily in defs:
        series = np.array([daily[clim["year"] == y].sum() for y in yrs])
        e = series[(yrs >= windows["early"][0]) & (yrs <= windows["early"][1])].mean()
        l = series[(yrs >= windows["late"][0]) & (yrs <= windows["late"][1])].mean()
        slope = theilslopes(series, yrs)[0] * 10
        p = kendalltau(yrs, series).pvalue
        out.append({"id": key, "label": label, "unit": unit, "early": round(float(e), 1), "late": round(float(l), 1),
                    "change": round(float(l - e), 1), "slope_per_decade": round(float(slope), 2),
                    "p_value": None if np.isnan(p) else round(float(p), 3)})
    return out
