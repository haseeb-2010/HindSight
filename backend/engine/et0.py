"""FAO-56 reference evapotranspiration (Allen et al. 1998), daily step. Vectorised."""
import numpy as np


def svp(t):
    """Saturation vapour pressure, kPa (FAO-56 eq. 11)."""
    return 0.6108 * np.exp(17.27 * t / (t + 237.3))


def extraterrestrial_radiation(lat, doy):
    """Ra, MJ m-2 day-1 (FAO-56 eq. 21-25)."""
    phi = np.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    return 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))


def hargreaves_rs(tmax, tmin, ra, krs=0.16):
    """Solar radiation from temperature range (FAO-56 eq. 50); used only to fill missing days."""
    return krs * np.sqrt(np.maximum(tmax - tmin, 0)) * ra


def et0_pm(tmax, tmin, rh_pct, u2, rs, lat, doy, elev_m):
    """FAO-56 Penman-Monteith (eq. 6). ea from mean RH (FAO-56 eq. 19 simplified to mean RH)."""
    t = (tmax + tmin) / 2
    es = (svp(tmax) + svp(tmin)) / 2
    ea = rh_pct / 100 * es
    delta = 4098 * svp(t) / (t + 237.3) ** 2
    pres = 101.3 * ((293 - 0.0065 * elev_m) / 293) ** 5.26
    gamma = 0.000665 * pres
    ra = extraterrestrial_radiation(lat, doy)
    rso = (0.75 + 2e-5 * elev_m) * ra
    rns = 0.77 * rs
    ratio = np.clip(rs / np.maximum(rso, 1e-6), 0.3, 1.0)
    rnl = 4.903e-9 * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 \
        * (0.34 - 0.14 * np.sqrt(np.maximum(ea, 0))) * (1.35 * ratio - 0.35)
    rn = rns - rnl
    et0 = (0.408 * delta * rn + gamma * 900 / (t + 273) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2))
    return np.maximum(et0, 0.0)
