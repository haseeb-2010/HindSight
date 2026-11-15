"""Soil water limits from texture and organic matter (Saxton & Rawls 2006, Table 1)."""

# Typical sand/clay % at the centre of each USDA texture class (approximate; used only when % are missing).
TEXTURE_DEFAULTS = {
    "sand": (92, 3), "loamy_sand": (82, 6), "sandy_loam": (65, 10), "loam": (40, 20),
    "silt_loam": (20, 15), "silt": (7, 5), "sandy_clay_loam": (60, 27), "clay_loam": (32, 34),
    "silty_clay_loam": (10, 34), "sandy_clay": (52, 42), "silty_clay": (7, 47), "clay": (20, 60),
}
OM_LEVELS = {"low": 0.7, "medium": 1.5, "high": 3.0}


def saxton_rawls(sand_frac, clay_frac, om_pct):
    """Return (field_capacity, wilting_point) as volumetric fractions."""
    S, C, OM = sand_frac, clay_frac, om_pct
    t1500 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031
    wp = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299
    fc = t33 + (1.283 * t33 ** 2 - 0.374 * t33 - 0.015)
    return fc, wp


def resolve_soil(req_soil: dict, soil_profile: dict | None):
    """Merge the farmer's request soil with an optional SoilProfile. Farmer input wins."""
    req_soil = req_soil or {}
    prof = soil_profile or {}
    tex = req_soil.get("texture_class") or prof.get("texture_class") or "loam"
    if tex not in TEXTURE_DEFAULTS:
        tex = "loam"
    source = "farmer" if req_soil.get("texture_class") else (prof.get("source") or "default")
    sand, clay = prof.get("sand_pct"), prof.get("clay_pct")
    if req_soil.get("texture_class") or sand is None or clay is None:
        sand, clay = TEXTURE_DEFAULTS[tex]
    om = OM_LEVELS.get(req_soil.get("organic_matter_level"))
    if om is None:
        om = prof.get("organic_matter_pct") or OM_LEVELS["low"]
    depth_cm = req_soil.get("depth_cm") or prof.get("depth_cm") or 100
    fc, wp = saxton_rawls(sand / 100, clay / 100, om)
    awc = 1000 * max(fc - wp, 0.02)  # mm per m
    return {
        "source": source, "texture_class": tex,
        "field_capacity_frac": round(fc, 3), "wilting_point_frac": round(wp, 3),
        "available_water_mm_per_m": round(awc, 1),
        "_depth_m": depth_cm / 100, "_awc": awc,
    }
