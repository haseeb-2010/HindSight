"""Crop curves and the season index (FAO-56 Kc curve, FAO-33 Ky, EcoCrop temperature trapezoid)."""
import numpy as np

FALLOW = {"id": "fallow_bare", "kc": {"ini": 0.2, "mid": 0.2, "end": 0.2}, "root_depth_m": 0.3,
          "p_depletion": 0.5}  # Assumption 2: bare fallow evaporation coefficient


def kc_curve(crop, sday):
    """Kc for each stage-day index (FAO-56 single crop coefficient curve)."""
    l1, l2, l3, l4 = crop["stage_days"]
    k = crop["kc"]
    s = np.asarray(sday, float)
    out = np.full(s.shape, k["ini"])
    m2 = (s >= l1) & (s < l1 + l2)
    out[m2] = k["ini"] + (k["mid"] - k["ini"]) * (s[m2] - l1) / l2
    out[(s >= l1 + l2) & (s < l1 + l2 + l3)] = k["mid"]
    m4 = s >= l1 + l2 + l3
    out[m4] = k["mid"] + (k["end"] - k["mid"]) * (s[m4] - l1 - l2 - l3) / l4
    return out


def root_curve(crop, sday):
    """Root depth grows linearly from 0.3 m to max by the start of mid-season."""
    l1, l2 = crop["stage_days"][:2]
    zmax = crop["root_depth_m"]
    z0 = min(0.3, zmax)
    return np.clip(z0 + (zmax - z0) * np.asarray(sday, float) / (l1 + l2), z0, zmax)


def f_temp(t_mean, tc):
    """EcoCrop trapezoid: 0 outside [min, max], 1 inside [opt_min, opt_max], linear between."""
    lo, olo, ohi, hi = tc["min"], tc["opt_min"], tc["opt_max"], tc["max"]
    t = np.asarray(t_mean, float)
    out = np.where((t >= olo) & (t <= ohi), 1.0, 0.0)
    out = np.where((t > lo) & (t < olo), (t - lo) / (olo - lo), out)
    out = np.where((t > ohi) & (t < hi), (hi - t) / (hi - ohi), out)
    return out


def water_index(ky, eta_sum, etc_sum):
    """FAO-33 water production function, relative: Yw = 1 - Ky (1 - ETa/ETc), floored at 0."""
    ratio = np.where(etc_sum > 0, eta_sum / np.maximum(etc_sum, 1e-9), 1.0)
    return np.maximum(0.0, 1 - ky * (1 - ratio))
