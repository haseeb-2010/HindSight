"""Optional soil lookup from the SoilGrids v2.0 REST API (SoilProfile, spec 4.2).

get_soil never raises: any failure, timeout, or "no data at this point" gives
None, and the app then uses the farmer's soil instead.
"""

import requests

from . import cache

URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
TIMEOUT_S = 15
PROPERTIES = ["clay", "sand", "soc", "phh2o"]
# (depth label, thickness in cm)
DEPTHS = [("0-5cm", 5), ("5-15cm", 10), ("15-30cm", 15)]
OC_TO_OM = 1.724  # organic carbon % x 1.724 = organic matter %


def _round_coord(value):
    return round(float(value), 2) + 0.0


def cache_file_name(lat, lon):
    return f"soil_{_round_coord(lat):.2f}_{_round_coord(lon):.2f}.json"


def texture_class(sand_pct, clay_pct):
    """USDA texture class (lower case, underscores) from sand and clay percent."""
    sand = float(sand_pct)
    clay = float(clay_pct)
    silt = 100.0 - sand - clay
    if silt + 1.5 * clay < 15:
        return "sand"
    if silt + 1.5 * clay >= 15 and silt + 2 * clay < 30:
        return "loamy_sand"
    if (7 <= clay < 20 and sand > 52 and silt + 2 * clay >= 30) or (
        clay < 7 and silt < 50 and silt + 2 * clay >= 30
    ):
        return "sandy_loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "silt_loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "sandy_clay_loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "clay_loam"
    if 27 <= clay < 40 and sand <= 20:
        return "silty_clay_loam"
    if clay >= 35 and sand > 45:
        return "sandy_clay"
    if clay >= 40 and silt >= 40:
        return "silty_clay"
    if clay >= 40 and sand <= 45 and silt < 40:
        return "clay"
    raise ValueError("no texture class for this sand and clay")


def _layer_mean(layer):
    """Thickness-weighted mean of one property over 0-30 cm, in target units
    (value / d_factor). Returns None if any depth is missing."""
    d_factor = layer["unit_measure"]["d_factor"]
    by_label = {d["label"]: d["values"].get("mean") for d in layer["depths"]}
    total = 0.0
    weight = 0
    for label, thickness in DEPTHS:
        value = by_label.get(label)
        if value is None:
            return None
        total += (value / d_factor) * thickness
        weight += thickness
    return total / weight


def _profile_from_reply(data):
    """Build a SoilProfile from the SoilGrids reply, or None if data is missing."""
    layers = {layer["name"]: layer for layer in data["properties"]["layers"]}
    means = {name: _layer_mean(layers[name]) for name in PROPERTIES if name in layers}
    sand = means.get("sand")
    clay = means.get("clay")
    if sand is None or clay is None:
        return None
    soc = means.get("soc")   # g/kg organic carbon
    ph = means.get("phh2o")  # pH (value / 10)
    om = None if soc is None else soc / 10.0 * OC_TO_OM  # g/kg -> % -> organic matter %
    return {
        "source": "soilgrids",
        "texture_class": texture_class(sand, clay),
        "sand_pct": round(sand, 1),
        "clay_pct": round(clay, 1),
        "organic_matter_pct": None if om is None else round(om, 2),
        "ph": None if ph is None else round(ph, 1),
        "depth_cm": None,  # SoilGrids was read for 0-30 cm only; it says nothing about profile depth
    }


def _query(lat, lon):
    params = [("lon", lon), ("lat", lat)]
    params += [("property", p) for p in PROPERTIES]
    params += [("depth", label) for label, _ in DEPTHS]
    params.append(("value", "mean"))
    reply = requests.get(URL, params=params, timeout=TIMEOUT_S)
    if reply.status_code != 200:
        raise RuntimeError(f"HTTP {reply.status_code}")
    return reply.json()


def get_soil(lat: float, lon: float) -> dict | None:
    """SoilProfile (spec 4.2) or None. Never raises."""
    try:
        file_name = cache_file_name(lat, lon)
        cached = cache.read_cache(file_name)
        if isinstance(cached, dict) and "profile" in cached:
            return cached["profile"]
        if cache.is_offline():
            return None

        data = _query(_round_coord(lat), _round_coord(lon))
        profile = _profile_from_reply(data)
        # The service answered, so "no data here" (None) is a real answer and
        # is cached too. Failures above are not cached, so they can be retried.
        try:
            cache.write_cache(file_name, {"profile": profile})
        except Exception:
            pass
        return profile
    except Exception:
        return None
