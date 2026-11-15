"""SYNTHETIC weather for tests and the mock only. Not NASA data. Shaped loosely like a semi-arid monsoon site."""
import numpy as np
from datetime import date, timedelta


def synthetic_climate(lat=32.93, lon=72.86, seed=7, start=1984, end=2024, dry_trend=0.0):
    rng = np.random.default_rng(seed)
    days = [date(start, 1, 1) + timedelta(i) for i in range((date(end, 12, 31) - date(start, 1, 1)).days + 1)]
    days = [d for d in days if not (d.month == 2 and d.day == 29)]
    n = len(days)
    doy = np.array([(d - date(d.year, 1, 1)).days + 1 - (1 if d.month > 2 and d.year % 4 == 0 else 0) for d in days])
    yr = np.array([d.year for d in days])
    ph = 2 * np.pi * (doy - 15) / 365
    tmax = 29 - 11 * np.cos(ph) + rng.normal(0, 2.5, n)
    tmin = tmax - 13 + 2 * np.cos(ph) + rng.normal(0, 2, n)
    year_wet = dict(zip(range(start, end + 1), rng.lognormal(0, 0.3, end - start + 1)))
    wet = np.array([year_wet[y] for y in yr]) * (1 - dry_trend * (yr - start) / (end - start))
    monsoon = np.exp(-((doy - 210) / 25) ** 2)
    winter = 0.35 * (np.exp(-((doy - 50) / 30) ** 2) + np.exp(-((doy - 355) / 20) ** 2))
    p_rain = 0.06 + 0.35 * monsoon + 0.12 * winter
    rain = (rng.random(n) < p_rain) * rng.gamma(0.8, 14, n) * wet
    rh = np.clip(45 + 30 * monsoon + 10 * winter + rng.normal(0, 8, n), 10, 98)
    srad = np.clip(18 - 6 * np.cos(ph) - 6 * (rain > 2) + rng.normal(0, 1.5, n), 3, 30)
    wind = np.clip(rng.normal(2.0, 0.6, n), 0.3, 6)
    r = lambda a: [round(float(x), 2) for x in a]
    return {"source": "SYNTHETIC TEST WEATHER - not NASA data", "lat": lat, "lon": lon, "elevation_m": 500.0,
            "grid_note": "synthetic", "start": f"{start}-01-01", "end": f"{end}-12-31",
            "dates": [d.isoformat() for d in days], "tmax_c": r(tmax), "tmin_c": r(tmin), "precip_mm": r(rain),
            "srad_mj_m2": r(srad), "rh_pct": r(rh), "wind_ms": r(wind), "gwetroot_frac": [0.4] * n,
            "filled_counts": {}, "fetched_at": "synthetic"}
