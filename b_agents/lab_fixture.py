"""Shopper Lab dev fixture, used until A's seed_lab.py lands.

One product with 4 photo variants (hand-written features, caption, price), plus
segment stats computed by the insights code on the existing fixture DB.
"""
from __future__ import annotations

from pathlib import Path

from b_agents import insights
from b_agents.fixture import make_fixture

FIXTURE_DB = Path(__file__).resolve().parent / ".dev" / "fixture.db"

PRODUCT = {"name": "Linen wrap dress", "price_usd": 88.0, "category": "dresses"}
VARIANT_SET_ID = "vs_01"

# "style" is the one-word feature used in lessons ("lab overrates lifestyle for At risk").
VARIANTS = [
    {"variant_id": 1, "label": "Flat lay", "style": "flat lay", "image_url": "/api/images/1.jpg",
     "features": ["white background", "no model", "flat lay", "sage green dress", "neutral palette"],
     "caption": "The linen wrap dress in sage. Washed, soft, made to last.", "price_usd": 88.0},
    {"variant_id": 2, "label": "On model, studio", "style": "studio", "image_url": "/api/images/2.jpg",
     "features": ["plain grey studio background", "on model", "full length", "sage green dress", "soft even light"],
     "caption": "Ties at the waist, falls just below the knee. Fits true to size.", "price_usd": 88.0},
    {"variant_id": 3, "label": "On model, street", "style": "lifestyle", "image_url": "/api/images/3.jpg",
     "features": ["sunny street background", "on model", "lifestyle", "walking mid-stride", "warm golden palette"],
     "caption": "Saturday market, iced coffee, linen that moves with you.", "price_usd": 88.0},
    {"variant_id": 4, "label": "Detail close-up", "style": "detail", "image_url": "/api/images/4.jpg",
     "features": ["close-up of fabric and stitching", "no model", "detail shot", "visible linen texture", "neutral palette"],
     "caption": "Look closer: French seams, coconut buttons, stone-washed linen.", "price_usd": 88.0},
]


def load_segments(db_path: str | Path | None = None) -> list[dict]:
    """Segment aggregates (counts, avg spend, top categories, recency) via insights. No PII."""
    path = Path(db_path) if db_path else FIXTURE_DB
    if not path.exists():
        make_fixture(path)
    customers, orders = insights.load_frames(str(path))
    return insights.summarize(insights.compute_rfm(customers, orders), orders)["segments"]
