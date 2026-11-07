"""Persona generator for the Shopper Lab: 4 synthetic shoppers per segment x 5 segments.

run(ctx) needs ctx["segments"] (insights_stats["segments"]: counts, avg spend, top
categories, recency). Only whitelisted aggregate fields are sent to Tinfoil, never
names or emails. Names are invented first names. One strict-JSON call, validated,
retried once, then a fixed list of 20 as fallback.

Returns {"personas": [Persona x 20], "persona_gen_source": "llm" | "fallback"}.
Persona: id, segment, name, age_band, budget_usd, style, price_sensitivity, channel.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from b_agents import llm_util
from shared.contracts import SEGMENT_NAMES

PROMPT = (Path(__file__).parent / "prompts" / "persona_gen.txt").read_text()
PER_SEGMENT = 4
SENSITIVITY = {"low": "low", "med": "med", "medium": "med", "high": "high"}
# Only aggregates leave the process.
SEGMENT_FIELDS = ("name", "count", "avg_recency_days", "avg_orders", "revenue_share_pct", "top_categories")
NAME_RE = re.compile(r"^[A-Z][a-zA-Z'\-]{1,14}$")

FALLBACK = [
    # segment, name, age_band, budget_usd, style, price_sensitivity, channel
    ("Champions", "Maya", "30s", 250, "elevated minimalist, invests in natural fabrics", "low", "Instagram"),
    ("Champions", "Priya", "40s", 300, "polished workwear with soft tailoring", "low", "email"),
    ("Champions", "Elena", "50s", 220, "classic pieces, quality over trends", "low", "in store"),
    ("Champions", "Jules", "20s", 180, "trend-led, loves a statement piece", "med", "TikTok"),
    ("Loyal", "Sofia", "30s", 140, "relaxed linen and easy dresses", "med", "Instagram"),
    ("Loyal", "Hannah", "40s", 120, "practical capsule wardrobe", "med", "email"),
    ("Loyal", "Nadia", "20s", 100, "vintage-inspired, mixes thrifted finds", "med", "TikTok"),
    ("Loyal", "Grace", "50s", 150, "comfortable classics in neutral tones", "low", "in store"),
    ("New", "Zoe", "20s", 70, "playful, follows creators for outfit ideas", "high", "TikTok"),
    ("New", "Amara", "30s", 90, "clean basics, still testing the shop", "med", "Instagram"),
    ("New", "Lily", "20s", 60, "budget-aware student, loves color", "high", "TikTok"),
    ("New", "Rosa", "40s", 110, "smart casual for work and weekends", "med", "Google search"),
    ("At risk", "Claire", "30s", 120, "used to buy seasonal drops, now browsing elsewhere", "med", "email"),
    ("At risk", "Tessa", "40s", 130, "loves linen but waits for sales", "high", "email"),
    ("At risk", "Imani", "30s", 100, "busy parent, shops in quick bursts", "med", "Instagram"),
    ("At risk", "Leah", "50s", 140, "loyal to fit, skeptical of hype", "med", "in store"),
    ("Hibernating", "Ruby", "20s", 50, "occasional buyer, deal-driven", "high", "TikTok"),
    ("Hibernating", "Nora", "60s", 80, "timeless shapes, rarely shops online", "high", "email"),
    ("Hibernating", "Iris", "30s", 60, "bought once as a gift", "high", "Instagram"),
    ("Hibernating", "Wren", "40s", 70, "minimal wardrobe, buys only when needed", "high", "Google search"),
]


def _with_ids(personas: list[dict]) -> list[dict]:
    order = {s: i for i, s in enumerate(SEGMENT_NAMES)}
    personas = sorted(personas, key=lambda p: order[p["segment"]])
    return [{"id": f"p{i + 1:02d}", **p} for i, p in enumerate(personas)]


def fallback_personas() -> list[dict]:
    keys = ("segment", "name", "age_band", "budget_usd", "style", "price_sensitivity", "channel")
    return _with_ids([dict(zip(keys, row)) for row in FALLBACK])


def validate_personas(out) -> list[dict]:
    items = out["personas"] if isinstance(out, dict) else out
    if not isinstance(items, list) or len(items) != PER_SEGMENT * len(SEGMENT_NAMES):
        raise ValueError(f"need exactly {PER_SEGMENT * len(SEGMENT_NAMES)} personas")
    clean = []
    for i, p in enumerate(items):
        if p.get("segment") not in SEGMENT_NAMES:
            raise ValueError(f"persona {i}: segment must be one of {SEGMENT_NAMES}")
        name = str(p.get("name", "")).strip()
        if not NAME_RE.match(name):
            raise ValueError(f"persona {i}: name must be a single invented first name")
        age_band = str(p.get("age_band", "")).strip()
        if not re.fullmatch(r"[1-9]0s", age_band):
            raise ValueError(f"persona {i}: age_band must look like '30s'")
        sens = SENSITIVITY.get(str(p.get("price_sensitivity", "")).strip().lower())
        if not sens:
            raise ValueError(f"persona {i}: price_sensitivity must be low, med or high")
        budget = float(p["budget_usd"])
        if budget <= 0:
            raise ValueError(f"persona {i}: budget_usd must be positive")
        style, channel = str(p.get("style", "")).strip(), str(p.get("channel", "")).strip()
        if not style or not channel:
            raise ValueError(f"persona {i}: style and channel are required")
        clean.append({"segment": p["segment"], "name": name, "age_band": age_band, "budget_usd": round(budget),
                      "style": style, "price_sensitivity": sens, "channel": channel})
    counts = {s: sum(p["segment"] == s for p in clean) for s in SEGMENT_NAMES}
    if any(c != PER_SEGMENT for c in counts.values()):
        raise ValueError(f"need {PER_SEGMENT} personas per segment, got {counts}")
    if len({p["name"] for p in clean}) != len(clean):
        raise ValueError("persona names must be unique")
    return _with_ids(clean)


def segment_payload(segments: list[dict]) -> list[dict]:
    """Whitelisted aggregates. avg_spend is lifetime spend, so also send the per-order value."""
    out = []
    for s in segments:
        row = {k: s[k] for k in SEGMENT_FIELDS if k in s}
        row["avg_lifetime_spend_usd"] = s["avg_spend"]
        if s.get("avg_orders"):
            row["avg_order_value_usd"] = round(s["avg_spend"] / s["avg_orders"], 2)
        out.append(row)
    return out


def run(ctx: dict) -> dict:
    payload = {"segments": segment_payload(ctx["segments"]), "personas_per_segment": PER_SEGMENT}
    personas, source = llm_util.with_fallback("persona_gen", lambda: llm_util.chat_json("persona_gen", [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": json.dumps(payload)},
    ], validate_personas), fallback_personas)
    return {"personas": personas, "persona_gen_source": source}
