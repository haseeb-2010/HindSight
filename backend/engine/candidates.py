"""Generate alternative rotations from the farmer's current one (section 4.8 of the P1 brief)."""
import numpy as np
from .rotation import schedule, bare_gaps, crop_len, EngineError, Y_START
from .season import f_temp


def usable(c, excluded, allow_unverified):
    return (c["id"] != "fallow_bare" and c["id"] not in excluded and c.get("ky") is not None
            and (c.get("verified") or allow_unverified))


def clim_fit(crop, start, tclim):
    idx = (start + np.arange(crop_len(crop))) % 365
    return float(f_temp(tclim[idx].mean(), crop["temp_c"]))


def _sig(rot):
    # same crops in the same order = same rotation, even if sowing dates differ by a few days
    sl = sorted(rot["slots"], key=lambda s: s["year_offset"] * 365 + s["plant_doy"])
    return (rot["cycle_years"], tuple((s["year_offset"], s["crop_id"]) for s in sl))


def generate(request, crops, library, clim, max_n=25, allow_unverified=False):
    cur = dict(request["current_rotation"]); cur["id"] = "current"
    cur.setdefault("cycle_years", 1)
    excluded = set((request.get("constraints") or {}).get("excluded_crops") or [])
    max_c = (request.get("constraints") or {}).get("max_cycle_years") or 3
    pool = [c for c in crops.values() if usable(c, excluded, allow_unverified)]
    yr = clim["year"] >= Y_START
    tclim = np.array([clim["tmean"][yr & (clim["doy"] == d)].mean() for d in range(1, 366)])
    sch = schedule(cur, crops)
    out, seen = [cur], {_sig(cur)}

    def add(rot):
        s = _sig(rot)
        if s in seen or len(out) >= max_n:
            return
        try:
            schedule(rot, crops)
        except EngineError:
            return
        seen.add(s); out.append(rot)

    preset = (request.get("location") or {}).get("preset_id")
    for lib in library:
        if preset in lib.get("preset_ids", []) and lib["cycle_years"] <= max_c and \
                all(s["crop_id"] in crops and usable(crops[s["crop_id"]], excluded, allow_unverified) for s in lib["slots"]):
            add({"id": lib["id"], "cycle_years": lib["cycle_years"], "slots": lib["slots"]})
    # fallow fills: legume or forage in a bare gap of 75+ days, with 15 days to spare
    k = 0
    for g0, g in bare_gaps(sch["occ"]):
        if g < 75:
            continue
        for c in pool:
            if not (c.get("is_legume") or c.get("is_forage")) or crop_len(c) + 15 > g:
                continue
            pos = (g0 + 7) % sch["N"]
            if clim_fit(c, pos % 365, tclim) < 0.5:
                continue
            k += 1
            add({"id": f"fill_{k}", "cycle_years": cur["cycle_years"],
                 "slots": cur["slots"] + [{"year_offset": pos // 365, "plant_doy": pos % 365 + 1, "crop_id": c["id"]}]})
    # substitutions: same season type, must fit and suit the climate
    for j, s in enumerate(sch["slots"]):
        for c in pool:
            if c["id"] == s["crop_id"] or c.get("season_type") != crops[s["crop_id"]].get("season_type"):
                continue
            if clim_fit(c, s["plant_doy"] - 1, tclim) < 0.5:
                continue
            k += 1
            slots = [dict(x) for x in sch["slots"]]; slots[j] = dict(s, crop_id=c["id"])
            add({"id": f"swap_{k}", "cycle_years": cur["cycle_years"], "slots": slots})
    return out
