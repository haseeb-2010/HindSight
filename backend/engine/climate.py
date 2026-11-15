"""Turn a ClimateSeries dict into clean numpy arrays (gap fill, scenario, ET0)."""
import numpy as np
from .et0 import et0_pm, extraterrestrial_radiation, hargreaves_rs

_CUM = np.cumsum([0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30])  # non-leap calendar


def _doy(date_str):
    m, d = int(date_str[5:7]), int(date_str[8:10])
    return int(_CUM[m - 1] + d)


def _fill_by_doy(x, doy):
    """Fill remaining nulls with the day-of-year mean of the record."""
    x = np.array([np.nan if v is None else v for v in x], dtype=float)
    bad = np.isnan(x)
    if bad.any():
        clim = np.array([np.nanmean(x[doy == d]) if np.any(~np.isnan(x[doy == d])) else np.nanmean(x)
                         for d in range(1, 366)])
        x[bad] = clim[doy[bad] - 1]
    return x, int(bad.sum())


def prepare(climate: dict, scenario: dict | None = None):
    dates = [d for d in climate["dates"] if d[5:10] != "02-29"]
    keep = [i for i, d in enumerate(climate["dates"]) if d[5:10] != "02-29"]
    doy = np.array([_doy(d) for d in dates])
    year = np.array([int(d[:4]) for d in dates])
    arr, filled = {}, {}
    for k in ("tmax_c", "tmin_c", "precip_mm", "rh_pct", "wind_ms"):
        arr[k], filled[k] = _fill_by_doy([climate[k][i] for i in keep], doy)
    lat = float(climate["lat"])
    elev = float(climate.get("elevation_m") or 0.0)
    ra = extraterrestrial_radiation(lat, doy)
    srad = np.array([np.nan if climate["srad_mj_m2"][i] is None else climate["srad_mj_m2"][i] for i in keep], float)
    miss = np.isnan(srad)
    srad[miss] = hargreaves_rs(arr["tmax_c"][miss], arr["tmin_c"][miss], ra[miss])
    filled["srad_mj_m2"] = int(miss.sum())
    sc = scenario or {}
    dt = float(sc.get("temp_delta_c") or 0.0)
    pf = float(sc.get("precip_factor") if sc.get("precip_factor") is not None else 1.0)
    tmax, tmin = arr["tmax_c"] + dt, arr["tmin_c"] + dt
    precip = np.maximum(arr["precip_mm"] * pf, 0)
    et0 = et0_pm(tmax, tmin, np.clip(arr["rh_pct"], 1, 100), np.maximum(arr["wind_ms"], 0.5), srad, lat, doy, elev)
    return {
        "doy": doy, "year": year, "tmax": tmax, "tmin": tmin, "tmean": (tmax + tmin) / 2,
        "precip": precip, "et0": et0, "lat": lat, "lon": float(climate["lon"]),
        "engine_filled": filled, "scenario_applied": dt != 0.0 or pf != 1.0,
    }
