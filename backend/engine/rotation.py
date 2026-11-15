"""Rotation schedules, the batched daily water balance, and the 40-year hindcast."""
import numpy as np
from .season import FALLOW, kc_curve, root_curve, f_temp, water_index

YEAR0, Y_START, Y_END = 1984, 1985, 2024  # 1984 is spin-up
EROSIVE_MM = 12.7  # Wischmeier & Smith (1978) erosive storm threshold
LEGUME_EFFECT = 1.20  # Zhao et al. 2022: +20% mean (7-32%)


class EngineError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message


def crop_len(c):
    return int(sum(c["stage_days"]))


def schedule(rot, crops):
    C = int(rot.get("cycle_years", 1))
    if C not in (1, 2, 3):
        raise EngineError("INVALID_REQUEST", "cycle_years must be 1, 2 or 3.")
    N = 365 * C
    occ, sd = np.full(N, -1), np.zeros(N, int)
    slots = sorted(rot["slots"], key=lambda s: s["year_offset"] * 365 + s["plant_doy"])
    if not slots:
        raise EngineError("INVALID_REQUEST", "A rotation needs at least one crop.")
    cl = []
    for j, s in enumerate(slots):
        c = crops.get(s["crop_id"])
        if c is None or s["crop_id"] == "fallow_bare":
            raise EngineError("UNKNOWN_CROP", f"Unknown crop '{s['crop_id']}'.")
        if c.get("ky") is None:
            raise EngineError("UNKNOWN_CROP", f"Crop '{s['crop_id']}' has no sourced Ky yet.")
        if not (0 <= s["year_offset"] < C and 1 <= s["plant_doy"] <= 365):
            raise EngineError("INVALID_REQUEST", "Slot year_offset or plant_doy out of range.")
        L = crop_len(c)
        idx = (s["year_offset"] * 365 + s["plant_doy"] - 1 + np.arange(L)) % N
        if L > N or (occ[idx] >= 0).any():
            raise EngineError("ROTATION_OVERLAP", f"Two crops overlap in year {s['year_offset'] + 1}.")
        occ[idx], sd[idx] = j, np.arange(L)
        cl.append(c)
    return {"C": C, "N": N, "occ": occ, "sd": sd, "slots": slots, "crops": cl}


def _sim_inputs(sched, phase, clim, soil):
    yr = clim["year"] - YEAR0
    c = ((yr + phase) % sched["C"]) * 365 + clim["doy"] - 1
    slot, sday = sched["occ"][c], sched["sd"][c]
    n = len(c)
    kc = np.full(n, FALLOW["kc"]["mid"]); zr = np.full(n, FALLOW["root_depth_m"]); p = np.full(n, FALLOW["p_depletion"])
    heat = np.full(n, np.inf); kill = np.full(n, -np.inf); length = np.zeros(n, int)
    for j, cr in enumerate(sched["crops"]):
        m = slot == j
        kc[m], zr[m], p[m] = kc_curve(cr, sday[m]), root_curve(cr, sday[m]), cr["p_depletion"]
        heat[m] = cr.get("heat_day_c") or np.inf
        k = cr["temp_c"].get("kill")
        kill[m] = -np.inf if k is None else k
        length[m] = crop_len(cr)
    taw = soil["_awc"] * np.minimum(zr, soil["_depth_m"])
    return dict(slot=slot, sday=sday, kc=kc, taw=taw, p=p, heat=heat, kill=kill, length=length)


def simulate(sims, clim, soil, water):
    """Daily root-zone balance (FAO-56 ch. 8) for many (schedule, phase) pairs at once."""
    S = len(sims)
    stack = {k: np.stack([s[k] for s in sims]) for k in sims[0]}
    crop = stack["slot"] >= 0
    new_season = crop & (stack["sday"] == 0)
    pmax = soil["_awc"] * soil["_depth_m"]
    mode = (water or {}).get("mode", "rainfed")
    cap = (water or {}).get("seasonal_cap_mm") or 0.0
    n = len(clim["precip"])
    eta, etc, irr, exc = (np.zeros((S, n)) for _ in range(4))
    W = np.full(S, 0.5 * pmax); used = np.zeros(S)
    w_start = W.copy()
    P, E0 = clim["precip"], clim["et0"]
    for i in range(n):
        tw, p = stack["taw"][:, i], stack["p"][:, i]
        rw = p * tw
        W = W + P[i]
        ex = np.maximum(W - pmax, 0.0); W -= ex; exc[:, i] = ex
        D = (1 - W / pmax) * tw
        if mode != "rainfed":
            used[new_season[:, i]] = 0.0
            I = np.where(crop[:, i] & (D > rw), D, 0.0)
            if mode == "limited":
                I = np.minimum(I, np.maximum(cap - used, 0.0)); used += I
            W += I; irr[:, i] = I
            D = (1 - W / pmax) * tw
        ks = np.where(D <= rw, 1.0, np.maximum(0.0, (tw - D) / np.maximum((1 - p) * tw, 1e-9)))
        e_c = stack["kc"][:, i] * E0[i]
        e_a = np.minimum(ks * e_c, W)
        W -= e_a; eta[:, i] = e_a; etc[:, i] = e_c
    return dict(stack=stack, crop=crop, eta=eta, etc=etc, irr=irr, exc=exc, w_start=w_start, w_end=W)


def seasons_from(sim_out, r, sched, clim, apply_legume, thr, legume_factor=LEGUME_EFFECT):
    """Season records for simulation row r."""
    st = sim_out["stack"]
    slot, sday, crop = st["slot"][r], st["sday"][r], sim_out["crop"][r]
    sid = np.cumsum(crop & (sday == 0)) - 1
    sid[~crop] = -1
    m = sid >= 0
    if not m.any():
        return []
    ids = sid[m]; ns = ids.max() + 1
    b = lambda w: np.bincount(ids, weights=w[m], minlength=ns)
    cnt = np.bincount(ids, minlength=ns)
    eta_s, etc_s, tm_s = b(sim_out["eta"][r]), b(sim_out["etc"][r]), b(clim["tmean"]) / np.maximum(cnt, 1)
    heat_s = b((clim["tmax"] > st["heat"][r]).astype(float))
    frost_s = b((clim["tmin"] < 0).astype(float))
    kill_s = b((clim["tmin"] < st["kill"][r]).astype(float)) > 0
    slot_s = np.zeros(ns, int); slot_s[ids] = slot[m]
    endm = m & (sday == st["length"][r] - 1)
    end_year = np.zeros(ns, int); end_year[sid[endm]] = clim["year"][endm]
    complete = np.zeros(ns, bool); complete[sid[endm]] = True
    out = []
    for k in range(ns):
        if not complete[k] or not (Y_START <= end_year[k] <= Y_END):
            continue
        j = slot_s[k]; cr = sched["crops"][j]
        prev = sched["crops"][(j - 1) % len(sched["crops"])]
        mleg = legume_factor if apply_legume and prev.get("is_legume") and not cr.get("is_legume") else 1.0
        yw = float(water_index(cr["ky"], eta_s[k], etc_s[k]))
        ft = float(f_temp(tm_s[k], cr["temp_c"]))
        killed = bool(kill_s[k])
        s_idx = 0.0 if killed else yw * ft * mleg
        if killed:
            lim = "frost"
        elif max(1 - yw, 1 - ft) < 0.1:
            lim = "none"
        else:
            lim = "water" if (1 - yw) >= (1 - ft) else "temperature"
        out.append(dict(slot=int(j), crop_id=cr["id"], year=int(end_year[k]), S=s_idx, failed=s_idx < thr,
                        limit=lim, heat=float(heat_s[k]), frost=float(frost_s[k])))
    return out


def _pct(a, q):
    a = [x for x in a if x is not None]
    return float(np.percentile(a, q)) if a else None


def hindcast(sched, sim_out, rows, clim, apply_legume, thr, windows, legume_factor=LEGUME_EFFECT):
    seas = [s for r in rows for s in seasons_from(sim_out, r, sched, clim, apply_legume, thr, legume_factor)]
    years = list(range(Y_START, Y_END + 1))
    annual = []
    for y in years:
        v = [s["S"] for s in seas if s["year"] == y]
        annual.append(round(float(np.mean(v)), 3) if v else None)

    def stats(ylo, yhi):
        a = [annual[y - Y_START] for y in range(ylo, yhi + 1)]
        ss = [s for s in seas if ylo <= s["year"] <= yhi]
        ff = sum(s["failed"] for s in ss) / len(ss) if ss else None
        r3 = lambda x: None if x is None else round(x, 3)
        return {"median": r3(_pct(a, 50)), "p10": r3(_pct(a, 10)), "failure_freq": r3(ff)}

    by_slot = []
    for j, cr in enumerate(sched["crops"]):
        ss = [s for s in seas if s["slot"] == j]
        vals = [s["S"] for s in ss]
        lims = [s["limit"] for s in ss if s["failed"] and s["limit"] != "none"] or \
               [s["limit"] for s in ss if s["limit"] != "none"]
        by_slot.append({
            "crop_id": cr["id"],
            "median": round(_pct(vals, 50), 3) if vals else None,
            "p10": round(_pct(vals, 10), 3) if vals else None,
            "failure_freq": round(sum(s["failed"] for s in ss) / len(ss), 3) if ss else None,
            "main_limit": max(set(lims), key=lims.count) if lims else "none",
            "heat_days_mean": round(float(np.mean([s["heat"] for s in ss])), 1) if ss else None,
            "frost_days_mean": round(float(np.mean([s["frost"] for s in ss])), 1) if ss else None,
            "n_seasons": len(ss), "n_failed": int(sum(s["failed"] for s in ss)),
        })
    # water and erosion, 1985-2024, averaged across phases
    yi = (clim["year"] >= Y_START)
    nyears = Y_END - Y_START + 1
    crop_days = sim_out["crop"][rows][:, yi]
    water = float((sim_out["etc"][rows][:, yi] * crop_days).sum(axis=1).mean() / nyears)
    irr = float(sim_out["irr"][rows][:, yi].sum(axis=1).mean() / nyears)
    heavy = clim["precip"][yi] >= EROSIVE_MM
    bare_heavy = (~crop_days & heavy).sum()
    erosive = float(bare_heavy / (heavy.sum() * len(rows))) if heavy.sum() else 0.0
    out = stats(Y_START, Y_END)
    out.update({
        "years": years, "annual_index": annual,
        "by_window": {k: stats(*v) for k, v in windows.items()},
        "by_slot": by_slot,
        "water_demand_mm_per_year": round(water), "irrigation_mm_per_year": round(irr),
    })
    return out, erosive, seas


def structure(sched):
    """Calendar and structural soil-care facts that do not depend on weather."""
    occ, C = sched["occ"], sched["C"]
    cum = np.cumsum([0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
    cal = []
    for y in range(C):
        for mth in range(12):
            seg = occ[y * 365 + cum[mth]: y * 365 + cum[mth + 1]]
            bare = float((seg < 0).mean())
            crops_in = seg[seg >= 0]
            cid = sched["crops"][np.bincount(crops_in).argmax()]["id"] if len(crops_in) else "fallow_bare"
            cal.append({"year_offset": y, "month": mth + 1, "crop_id": cid, "bare_frac": round(bare, 2)})
    cl = sched["crops"]; n = len(cl)
    fam_rep = sum(1 for j in range(n) if cl[j]["family"] == cl[(j + 1) % n]["family"]) if n > 1 else 1
    return cal, {
        "forage_share": round(sum(bool(c.get("is_forage")) for c in cl) / n, 3),
        "legume_share": round(sum(bool(c.get("is_legume")) for c in cl) / n, 3),
        "cover_frac": round(float((occ >= 0).mean()), 3),
        "residue_class_mean": round(float(np.mean([c.get("residue_class", 2) for c in cl])), 2),
        "family_repeats": int(fam_rep),
    }


def bare_gaps(occ):
    """Maximal bare runs on the cyclic calendar: list of (start, length)."""
    N = len(occ)
    if (occ < 0).all():
        return [(0, N)]
    if (occ >= 0).all():
        return []
    s0 = int(np.argmax(occ >= 0))  # rotate so we start on a crop day
    r = np.roll(occ, -s0)
    gaps, i = [], 0
    while i < N:
        if r[i] < 0:
            j = i
            while j < N and r[j] < 0:
                j += 1
            gaps.append(((i + s0) % N, j - i)); i = j
        else:
            i += 1
    return gaps


def rotation_name(sched, crops):
    years = {}
    for s in sched["slots"]:
        years.setdefault(s["year_offset"], []).append(crops[s["crop_id"]]["name"])
    fallow = any(g >= 60 for _, g in bare_gaps(sched["occ"]))
    if sched["C"] == 1:
        nm = " then ".join(years[0])
        return nm + (" then bare fallow" if fallow else "")
    parts = [f"Y{y + 1}: " + (" then ".join(years[y]) if y in years else "fallow") for y in range(sched["C"])]
    return " · ".join(parts)
