"""Hindsight engine. Pure functions: no network, no file writes, deterministic."""
import numpy as np
from .climate import prepare
from .soil import resolve_soil
from .rotation import (schedule, _sim_inputs, simulate, hindcast, structure, rotation_name,
                       EngineError, Y_START, Y_END)
from .candidates import generate
from .ranking import normalise, totals, ranks, pareto
from .trends import climate_shift
from .explain import explain

ENGINE_VERSION = "0.3.0"
WINDOWS = {"early": [1985, 2004], "late": [2005, 2024]}
__all__ = ["run_analysis", "ENGINE_VERSION", "EngineError"]


def _ndvi_check(ndvi, current):
    if not ndvi:
        return None
    # Peak greenness only in months the current rotation has a crop in the ground (bare_frac < 0.5),
    # so monsoon weeds on a bare field do not count as crop growth.
    crop_months = {c["month"] for c in current["calendar"] if c["bare_frac"] < 0.5}
    by_year = {}
    for d, v, ok in zip(ndvi["dates"], ndvi["ndvi"], ndvi["good_quality"]):
        if ok and v is not None and int(d[5:7]) in crop_months:
            by_year[int(d[:4])] = max(by_year.get(int(d[:4]), -1), v)
    h = current["hindcast"]
    pairs = [(by_year[y], a) for y, a in zip(h["years"], h["annual_index"]) if y in by_year and a is not None]
    if len(pairs) < 8:
        return None
    x, y = np.array(pairs).T
    if np.std(x) < 1e-9 or np.std(y) < 1e-9:
        return None  # e.g. full irrigation: the index never varies, so a correlation is undefined
    from scipy.stats import pearsonr
    r, pv = pearsonr(x, y)
    return {"r": round(float(r), 2), "n_years": len(pairs), "p_value": round(float(pv), 4),
            "note": "Pearson correlation between peak MODIS NDVI in crop months (good-quality pixels only) and the "
                    "current rotation's annual index. One 250 m pixel that may not be a crop field. "
                    "An independent check, not a calibration."}


def run_analysis(request: dict, climate: dict, soil: dict | None, crops: list[dict], library: list[dict],
                 ndvi: dict | None = None, allow_unverified: bool = False) -> dict:
    crops_by = {c["id"]: c for c in crops}
    opts = request.get("options") or {}
    thr = float(opts.get("failure_threshold", 0.5))
    legume = bool(opts.get("apply_legume_effect", True))
    top_n = int(opts.get("top_n", 5))
    clim = prepare(climate, request.get("scenario"))
    soil_used = resolve_soil(request.get("soil"), soil)
    warnings = []
    if clim["scenario_applied"]:
        warnings.append("What-if scenario applied to the past record. Not a forecast.")
    if sum(clim["engine_filled"].values()):
        warnings.append(f"Engine filled {sum(clim['engine_filled'].values())} missing daily values from the record's own averages.")

    cands = generate(request, crops_by, library, clim, allow_unverified=allow_unverified)
    scheds = [schedule(c, crops_by) for c in cands]
    sims, rows = [], []
    for s in scheds:
        rows.append(list(range(len(sims), len(sims) + s["C"])))
        sims += [_sim_inputs(s, ph, clim, soil_used) for ph in range(s["C"])]
    out = simulate(sims, clim, soil_used, request.get("water"))

    market = (request.get("constraints") or {}).get("market_rating") or {}
    rots = []
    for cand, s, rw in zip(cands, scheds, rows):
        h, erosive, _ = hindcast(s, out, rw, clim, legume, thr, WINDOWS)
        cal, struct = structure(s)
        ind = {"stability": h["p10"], "water_use_mm": h["water_demand_mm_per_year"], **struct,
               "erosive_rain_on_bare_frac": round(erosive, 3),
               "market_mean": round(float(np.mean([market.get(c["id"], 2) for c in s["crops"]])), 2)}
        ind = {k: ind[k] for k in ["stability", "water_use_mm", "forage_share", "legume_share",
                                   "erosive_rain_on_bare_frac", "cover_frac", "residue_class_mean",
                                   "market_mean", "family_repeats"]}
        rots.append({"id": cand["id"], "name": rotation_name(s, crops_by), "is_current": cand["id"] == "current",
                     "cycle_years": s["C"], "slots": s["slots"], "calendar": cal, "hindcast": h, "indicators": ind,
                     "_sched": s, "_rows": rw})

    # Worst-years test: how each rotation would have done in the current rotation's 5 worst years.
    cur_h = rots[0]["hindcast"]
    worst = [y for _, y in sorted((v, y) for y, v in zip(cur_h["years"], cur_h["annual_index"]) if v is not None)[:5]]
    for r in rots:
        d = dict(zip(r["hindcast"]["years"], r["hindcast"]["annual_index"]))
        v = [d[y] for y in worst if d.get(y) is not None]
        r["hindcast"]["worst_years"] = {"years": sorted(worst), "mean_index": round(float(np.mean(v)), 3) if v else None}

    pri = request.get("priorities")
    # pick the best top_n alternatives on all candidates, then rank within the shown set
    tot_all = totals(normalise([r["indicators"] for r in rots]), pri)
    others = sorted(range(1, len(rots)), key=lambda i: -tot_all[i])[:top_n]
    shown = [rots[0]] + [rots[i] for i in others]
    inds = [r["indicators"] for r in shown]
    nm = normalise(inds)
    tot = totals(nm, pri)
    rk, par = ranks(tot), pareto(nm)
    rk_e = ranks(totals(normalise(inds, [r["hindcast"]["by_window"]["early"]["p10"] for r in shown]), pri))
    rk_l = ranks(totals(normalise(inds, [r["hindcast"]["by_window"]["late"]["p10"] for r in shown]), pri))
    # Robustness: re-rank with the legume effect off and at the low, mean and high values of Zhao et al. 2022.
    variants = [[rk[i]] for i in range(len(shown))]
    if legume:
        for f in (1.0, 1.07, 1.32):
            st = [hindcast(r["_sched"], out, r["_rows"], clim, True, thr, WINDOWS, legume_factor=f)[0]["p10"] for r in shown]
            for i, v in enumerate(ranks(totals(normalise(inds, st), pri))):
                variants[i].append(v)
    # Rainfall robustness: NASA POWER rain differs from station normals by 36-48% at our Pakistan sites,
    # so every shown rotation is re-simulated with rain 30% lower and 30% higher and re-ranked.
    rain_var = [[rk[i]] for i in range(len(shown))]
    base_sc = dict(request.get("scenario") or {})
    base_pf = float(base_sc.get("precip_factor") if base_sc.get("precip_factor") is not None else 1.0)
    for f in (0.7, 1.3):
        c2 = prepare(climate, dict(base_sc, precip_factor=base_pf * f))
        sims2, rows2 = [], []
        for r in shown:
            s = r["_sched"]
            rows2.append(list(range(len(sims2), len(sims2) + s["C"])))
            sims2 += [_sim_inputs(s, ph, c2, soil_used) for ph in range(s["C"])]
        o2 = simulate(sims2, c2, soil_used, request.get("water"))
        inds2 = []
        for r, rw in zip(shown, rows2):
            h2, ero2, _ = hindcast(r["_sched"], o2, rw, c2, legume, thr, WINDOWS)
            inds2.append(dict(r["indicators"], stability=h2["p10"], water_use_mm=h2["water_demand_mm_per_year"],
                              erosive_rain_on_bare_frac=round(ero2, 3)))
        for i, v in enumerate(ranks(totals(normalise(inds2), pri))):
            rain_var[i].append(v)
    for i, r in enumerate(shown):
        r["scores"] = {"normalised": nm[i], "total": tot[i], "rank": rk[i], "pareto": par[i],
                       "rank_early": rk_e[i], "rank_late": rk_l[i],
                       "rank_range": [min(variants[i]), max(variants[i])],
                       "rank_range_rain": [min(rain_var[i]), max(rain_var[i])]}
    best = {"stability": max(shown, key=lambda r: r["indicators"]["stability"] or 0)["id"],
            "water": min(shown, key=lambda r: r["indicators"]["water_use_mm"])["id"],
            "erosion": min(shown, key=lambda r: r["indicators"]["erosive_rain_on_bare_frac"])["id"]}
    for r in shown:
        r["explanation"] = explain(r, shown[0], best, crops_by, request)
        if r["is_current"]:
            r["name"] += " (current)"
    shown.sort(key=lambda r: (not r["is_current"], r["scores"]["rank"]))
    for r in rots:
        r.pop("_sched", None); r.pop("_rows", None)

    yi = clim["year"] >= Y_START
    ny = Y_END - Y_START + 1
    loc = request.get("location") or {}
    unverified = sorted({c["id"] for r in shown for c in (crops_by[s["crop_id"]] for s in r["slots"]) if not c.get("verified")})
    if unverified:
        warnings.append("Development only: unverified crop values used for " + ", ".join(unverified) + ".")
    return {
        "meta": {"engine_version": ENGINE_VERSION, "record": {"start_year": Y_START, "end_year": Y_END},
                 "windows": WINDOWS, "warnings": warnings},
        "site": {"name": loc.get("name") or f"{clim['lat']:.2f}, {clim['lon']:.2f}", "lat": clim["lat"], "lon": clim["lon"],
                 "soil_used": {k: v for k, v in soil_used.items() if not k.startswith("_")},
                 "climate_summary": {"annual_rain_mm": round(float(clim["precip"][yi].sum() / ny)),
                                     "annual_et0_mm": round(float(clim["et0"][yi].sum() / ny)),
                                     "mean_temp_c": round(float(clim["tmean"][yi].mean()), 1)}},
        "climate_shift": climate_shift(clim, WINDOWS),
        "rotations": shown,
        "validation": {"ndvi_check": _ndvi_check(ndvi, shown[0])},
        "provenance": [
            {"item": "Daily weather", "kind": "reanalysis_estimate", "source": climate.get("source", "NASA POWER (MERRA-2, CERES)")},
            {"item": "Reference evapotranspiration", "kind": "model_output", "source": "FAO-56 Penman-Monteith on NASA POWER inputs"},
            {"item": "Soil texture and depth", "kind": "farmer_input" if soil_used["source"] == "farmer" else "satellite_estimate",
             "source": soil_used["source"]},
            {"item": "Field capacity and wilting point", "kind": "model_output", "source": "Saxton and Rawls (2006)"},
            {"item": "Crop coefficients, root depth, Ky, temperature ranges", "kind": "literature_parameter",
             "source": "FAO-56, FAO-33, FAO EcoCrop"},
            {"item": "Season index, failure frequency, water demand", "kind": "scenario" if clim["scenario_applied"] else "model_output",
             "source": "Hindsight engine"},
            {"item": "Priorities, market ratings, current rotation", "kind": "farmer_input", "source": "farmer"},
        ],
    }
