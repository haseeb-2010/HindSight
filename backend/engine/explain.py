"""Plain-language explanations built only from computed numbers. No language model."""

LIMIT_WORDS = {"water": "dry spells", "temperature": "temperatures outside the crop's range",
               "frost": "frost", "none": "no single cause"}


def explain(rot, cur, best, crops, request):
    h, ind = rot["hindcast"], rot["indicators"]
    lims = [b["main_limit"] for b in h["by_slot"] if b["main_limit"] != "none"]
    lim = max(set(lims), key=lims.count) if lims else "none"
    n_s = sum(b["n_seasons"] for b in h["by_slot"]); n_f = sum(b["n_failed"] for b in h["by_slot"])
    yrs = [(v, y) for y, v in zip(h["years"], h["annual_index"]) if v is not None]
    worst_y = min(yrs)[1] if yrs else None
    if n_f == 0:
        summary = f"No crop season fell below the failure line in {n_s} seasons of NASA weather, 1985-2024."
    else:
        summary = (f"Would have fallen below the failure line in {n_f} of {n_s} crop seasons ({round(100 * n_f / n_s)}%), "
                   f"mostly from {LIMIT_WORDS[lim]}. Worst year: {worst_y}.")
    reasons = []
    for b in h["by_slot"]:
        nm = crops[b["crop_id"]]["name"]
        reasons.append(f"{nm} fell below the failure line in {b['n_failed']} of {b['n_seasons']} seasons"
                       + (f"; the main limit was {LIMIT_WORDS[b['main_limit']]}." if b["main_limit"] != "none" else "."))
    if not rot["is_current"]:
        ci = cur["indicators"]
        d = ind["stability"] - ci["stability"]
        reasons.append(f"Bad-year index {ind['stability']:.2f}, against {ci['stability']:.2f} for your current rotation"
                       + (" (better)." if d > 0.02 else " (worse)." if d < -0.02 else " (about the same)."))
        dw = ind["water_use_mm"] - ci["water_use_mm"]
        reasons.append(f"Crop water demand {ind['water_use_mm']} mm a year, {abs(dw)} mm {'more' if dw > 0 else 'less'} than your current rotation.")
    wy, cw = h.get("worst_years") or {}, (cur["hindcast"].get("worst_years") or {})
    if wy.get("years") and wy.get("mean_index") is not None:
        yl = ", ".join(str(y) for y in wy["years"])
        if rot["is_current"]:
            reasons.append(f"Your 5 worst years in the record were {yl} (average index {wy['mean_index']:.2f}).")
        elif cw.get("mean_index") is not None:
            reasons.append(f"In your 5 worst years ({yl}) this rotation would have averaged {wy['mean_index']:.2f}, "
                           f"against {cw['mean_index']:.2f} for your current rotation.")
    rr = rot["scores"].get("rank_range")
    if rr and (request.get("options") or {}).get("apply_legume_effect", True):
        if rr[0] == rr[1]:
            reasons.append(f"Stays ranked #{rr[0]} whether the legume effect is 0%, 7%, 20% or 32%.")
        else:
            reasons.append(f"Ranks between #{rr[0]} and #{rr[1]} depending on how strong the legume effect is (0-32%).")
    rr2 = rot["scores"].get("rank_range_rain")
    if rr2:
        if rr2[0] == rr2[1]:
            reasons.append(f"Stays ranked #{rr2[0]} even if NASA rainfall here is 30% too high or too low.")
        else:
            reasons.append(f"Ranks between #{rr2[0]} and #{rr2[1]} if NASA rainfall here is 30% too high or too low.")
    evidence = [
        "Daily soil-water balance (FAO-56) run on NASA POWER daily weather, 1985-2024.",
        "Season index from the FAO-33 water-production function and EcoCrop temperature ranges.",
        f"Heavy-rain days (12.7 mm or more) counted against the bare months of this rotation: "
        f"{round(ind['erosive_rain_on_bare_frac'] * 100)}% fell on bare soil.",
    ]
    benefits = []
    if best.get("stability") == rot["id"]:
        benefits.append("Most stable in bad years of the rotations compared.")
    if best.get("water") == rot["id"]:
        benefits.append("Lowest crop water demand of the rotations compared.")
    if best.get("erosion") == rot["id"]:
        benefits.append("Least heavy rain on bare soil of the rotations compared.")
    if ind["legume_share"] > 0:
        benefits.append("Includes a legume, which fixes nitrogen for the following crop.")
    if ind["forage_share"] > 0:
        benefits.append("Includes a forage or dual-purpose crop.")
    if not rot["is_current"] and ind["cover_frac"] > cur["indicators"]["cover_frac"] + 0.05:
        benefits.append(f"Keeps the soil covered for {round(ind['cover_frac'] * 100)}% of the year, against "
                        f"{round(cur['indicators']['cover_frac'] * 100)}% now.")
    gaps = ["Weather is a NASA POWER grid-cell estimate about 50 km wide; your field may differ, especially in rainfall.",
            "Crop values are generic FAO figures, not your local varieties.",
            "Pests, disease, nutrients and management are not in the model."]
    if any(b["crop_id"] == "rice" for b in h["by_slot"]):
        gaps.append("Flooded-rice percolation is not modelled, so rice water use is understated.")
    if (request.get("water") or {}).get("mode", "rainfed") != "rainfed":
        gaps.append("Irrigation is assumed to refill the root zone whenever the crop starts to stress.")
    if (request.get("options") or {}).get("apply_legume_effect", True) and ind["legume_share"] > 0:
        gaps.append("The legume effect is a flat +20% on the next crop; field studies range from +7% to +32%.")
    local = ["Confirm sowing dates and varieties with your local extension office.",
             "Check that you can sell each crop and get seed in time.",
             "Ask about pests and diseases that carry over between these crops."]
    return {"summary": summary, "reasons": reasons, "evidence": evidence, "benefits": benefits,
            "gaps": gaps, "local_review": local}
