"""LabResult shape for the Shopper Lab (as agreed in the team spec).

Lives here because shared/ is frozen; A and C can move it into shared/contracts.py.
lab_analyst may add extra fields only under analyst_* keys.
"""
from __future__ import annotations

from typing import Literal, TypedDict


class Winner(TypedDict):
    variant_id: int
    label: str
    lift_pct: float
    call: Literal["clear", "too_close"]


class LabVariant(TypedDict):
    variant_id: int
    label: str
    image_url: str
    features: list[str]
    score: float
    ci: list[float]  # [low, high], 90% bootstrap interval
    rank: int
    by_segment: dict[str, float]  # all 5 segments


class Theme(TypedDict):
    variant_id: int
    text: str
    share: float


class Comment(TypedDict):
    persona: str  # "Maya, 30s, At risk"
    variant_id: int
    text: str


class Calibration(TypedDict):
    mean_abs_error_pct: float
    n_observed: int


class LabCosts(TypedDict):
    sie_usd: float
    tinfoil_usd: float
    darkbloom_usd: float
    frontier_equiv_usd: float


class LabResult(TypedDict):
    lab_run_id: str
    variant_set_id: str
    product: str
    winner: Winner
    variants: list[LabVariant]
    reasons: list[Theme]
    objections: list[Theme]
    comments: list[Comment]
    lessons_used: list[str]
    lessons_learned: list[str]
    calibration: Calibration
    working: list[str]
    fix: list[str]
    costs: LabCosts
