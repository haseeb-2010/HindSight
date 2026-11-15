"""Transparent ranking: min-max normalisation, farmer weights, and a weight-free Pareto mark."""
import numpy as np

KEYS = ["stability", "water_use", "forage", "nitrogen", "erosion", "organic_matter", "market"]


def _norm(vals, higher_better=True):
    v = np.array([np.nan if x is None else x for x in vals], float)
    lo, hi = np.nanmin(v), np.nanmax(v)
    if not np.isfinite(lo) or hi - lo < 1e-9:
        return [0.5] * len(vals)
    n = (v - lo) / (hi - lo)
    n = n if higher_better else 1 - n
    return [0.0 if np.isnan(x) else float(x) for x in n]


def normalise(inds, stability=None):
    st = stability if stability is not None else [i["stability"] for i in inds]
    cols = {
        "stability": _norm(st),
        "water_use": _norm([i["water_use_mm"] for i in inds], False),
        "forage": _norm([i["forage_share"] for i in inds]),
        "nitrogen": _norm([i["legume_share"] for i in inds]),
        "erosion": _norm([i["erosive_rain_on_bare_frac"] for i in inds], False),
        "organic_matter": [(a + b) / 2 for a, b in zip(_norm([i["cover_frac"] for i in inds]),
                                                       _norm([i["residue_class_mean"] for i in inds]))],
        "market": _norm([i["market_mean"] for i in inds]),
    }
    return [{k: round(cols[k][r], 3) for k in KEYS} for r in range(len(inds))]


def totals(normed, priorities):
    w = {k: float((priorities or {}).get(k, 0) or 0) for k in KEYS}
    if sum(w.values()) == 0:
        w = {k: 1.0 for k in KEYS}
    s = sum(w.values())
    return [round(sum(w[k] * n[k] for k in KEYS) / s, 3) for n in normed]


def ranks(tot):
    order = sorted(range(len(tot)), key=lambda r: -tot[r])
    rk = [0] * len(tot)
    for pos, r in enumerate(order):
        rk[r] = pos + 1
    return rk


def pareto(normed):
    out = []
    for a in normed:
        dominated = any(all(b[k] >= a[k] for k in KEYS) and any(b[k] > a[k] for k in KEYS) for b in normed if b is not a)
        out.append(not dominated)
    return out
