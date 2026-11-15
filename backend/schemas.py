"""Request models for the HindSight API. They validate farmer input before it reaches the engine;
the engine stays the final validator (crop overlap, schedule rules)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.engine.ranking import KEYS as PRIORITY_KEYS
from backend.engine.soil import OM_LEVELS, TEXTURE_DEFAULTS

TEXTURES = list(TEXTURE_DEFAULTS)
OM_LEVEL_NAMES = list(OM_LEVELS)

# Limits for farmer input. They bound the form, not the science: the engine accepts any number.
DEPTH_CM = (20, 300)
CAP_MM = (10, 2000)
TEMP_DELTA_C = (-5.0, 5.0)
PRECIP_FACTOR = (0.5, 1.5)
FAILURE_THRESHOLD = (0.1, 0.9)
TOP_N = (2, 8)
MAX_SLOTS = 9
MAX_VARIANTS = 6  # engine runs in one comparison

FIELD_LABELS = {
    "location.lat": "Latitude", "location.lon": "Longitude", "location.name": "Field name",
    "soil.texture_class": "Soil texture", "soil.organic_matter_level": "Organic matter level",
    "soil.depth_cm": "Soil depth", "water.mode": "Water mode", "water.seasonal_cap_mm": "Seasonal irrigation allowance",
    "current_rotation.cycle_years": "Rotation cycle length", "current_rotation.slots": "Crop rotation",
    "constraints.max_cycle_years": "Maximum rotation cycle", "constraints.market_rating": "Market rating",
    "constraints.excluded_crops": "Excluded crops", "scenario.temp_delta_c": "Temperature adjustment",
    "scenario.precip_factor": "Rainfall adjustment", "options.failure_threshold": "Failure threshold",
    "options.top_n": "Number of alternatives", "lat": "Latitude", "lon": "Longitude",
    "variants": "Scenarios to compare",
}


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore")


def _check_weights(priorities: dict[str, float]):
    for key, weight in priorities.items():
        if key not in PRIORITY_KEYS:
            raise ValueError(f"Unknown priority '{key}'.")
        if not 0 <= weight <= 5:
            raise ValueError(f"The weight for '{key}' must be between 0 and 5.")


class Location(_Model):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    name: str | None = Field(default=None, max_length=120)
    preset_id: str | None = None


class Soil(_Model):
    texture_class: Literal[tuple(TEXTURES)] | None = "loam"  # type: ignore[valid-type]
    organic_matter_level: Literal[tuple(OM_LEVEL_NAMES)] | None = "low"  # type: ignore[valid-type]
    depth_cm: float = Field(default=100, ge=DEPTH_CM[0], le=DEPTH_CM[1])


class Water(_Model):
    mode: Literal["rainfed", "full", "limited"] = "rainfed"
    seasonal_cap_mm: float | None = Field(default=None, ge=CAP_MM[0], le=CAP_MM[1])

    @model_validator(mode="after")
    def _cap_only_when_limited(self):
        if self.mode == "limited" and self.seasonal_cap_mm is None:
            raise ValueError("Limited irrigation needs a seasonal allowance in millimetres.")
        if self.mode != "limited":
            self.seasonal_cap_mm = None
        return self


class Slot(_Model):
    year_offset: int = Field(ge=0, le=2)
    plant_doy: int = Field(ge=1, le=365)
    crop_id: str


class Rotation(_Model):
    cycle_years: int = Field(ge=1, le=3)
    slots: list[Slot] = Field(min_length=1, max_length=MAX_SLOTS)

    @model_validator(mode="after")
    def _years_inside_cycle(self):
        for s in self.slots:
            if s.year_offset >= self.cycle_years:
                raise ValueError(f"A crop is placed in year {s.year_offset + 1}, but the cycle is {self.cycle_years} "
                                 f"year{'s' if self.cycle_years > 1 else ''} long.")
        return self


class Constraints(_Model):
    excluded_crops: list[str] = Field(default_factory=list)
    market_rating: dict[str, float] = Field(default_factory=dict)
    max_cycle_years: int = Field(default=3, ge=1, le=3)

    @model_validator(mode="after")
    def _ratings_in_range(self):
        for crop, rating in self.market_rating.items():
            if not 1 <= rating <= 5:
                raise ValueError(f"The market rating for '{crop}' must be between 1 and 5.")
        return self


class Scenario(_Model):
    temp_delta_c: float = Field(default=0.0, ge=TEMP_DELTA_C[0], le=TEMP_DELTA_C[1])
    precip_factor: float = Field(default=1.0, ge=PRECIP_FACTOR[0], le=PRECIP_FACTOR[1])


class Options(_Model):
    apply_legume_effect: bool = True
    failure_threshold: float = Field(default=0.5, ge=FAILURE_THRESHOLD[0], le=FAILURE_THRESHOLD[1])
    top_n: int = Field(default=5, ge=TOP_N[0], le=TOP_N[1])


class AnalyzeBody(_Model):
    location: Location
    soil: Soil = Field(default_factory=Soil)
    soil_source: Literal["farmer", "soilgrids"] = "farmer"
    water: Water = Field(default_factory=Water)
    current_rotation: Rotation
    priorities: dict[str, float] = Field(default_factory=dict)
    constraints: Constraints = Field(default_factory=Constraints)
    scenario: Scenario = Field(default_factory=Scenario)
    options: Options = Field(default_factory=Options)

    @model_validator(mode="after")
    def _priority_weights(self):
        _check_weights(self.priorities)
        return self


class Variant(_Model):
    """One run in a comparison: the base request with a different scenario and/or priorities."""
    id: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    label: str = Field(min_length=1, max_length=80)
    scenario: Scenario | None = None
    priorities: dict[str, float] | None = None

    @model_validator(mode="after")
    def _priority_weights(self):
        _check_weights(self.priorities or {})
        return self


class CompareBody(_Model):
    base: AnalyzeBody
    variants: list[Variant] = Field(min_length=1, max_length=MAX_VARIANTS)

    @model_validator(mode="after")
    def _unique_ids(self):
        ids = [v.id for v in self.variants]
        if len(set(ids)) != len(ids):
            raise ValueError("Each run in a comparison needs its own id.")
        return self


class PointBody(_Model):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class SoilResolveBody(PointBody):
    soil: Soil = Field(default_factory=Soil)
    soil_source: Literal["farmer", "soilgrids"] = "farmer"


def friendly_errors(errors: list[dict]) -> tuple[str, list[dict]]:
    """Turn pydantic's error list into one readable sentence plus per-field details."""
    fields = []
    for e in errors:
        loc = [str(p) for p in e.get("loc", []) if p != "body"]
        path = ".".join(loc)
        label = FIELD_LABELS.get(path) or FIELD_LABELS.get(".".join(p for p in loc if not p.isdigit()))
        msg = str(e.get("msg", "Invalid value")).removeprefix("Value error, ")
        if e.get("type") != "value_error":  # pydantic's own wording: prefix it with the field's name
            msg = f"{label or path or 'Request'}: {msg[:1].lower()}{msg[1:]}"
        fields.append({"field": path, "message": msg})
    return " ".join(f["message"].rstrip(".") + "." for f in fields) or "The request is not valid.", fields
