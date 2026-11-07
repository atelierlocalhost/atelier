"""Social agent: 3 carousel posts via Darkbloom. No customer data ever goes in.

Reads brand + outcomes memory only (never customers). Uses action titles from
strategy (no PII) and curated trends/sounds from data/trends.json. Darkbloom may
not support response_format, so JSON is requested in the prompt, extracted, validated
and retried once. Falls back to templated posts if the LLM is unavailable.
"""
from __future__ import annotations

import json
from pathlib import Path

from b_agents import llm_util, memory

HERE = Path(__file__).parent
PROMPT = (HERE / "prompts" / "social.txt").read_text()
TRENDS = json.loads((HERE / "data" / "trends.json").read_text())
SOUND_NAMES = [s["name"] for s in TRENDS["sounds"]]


def validate_posts(out) -> list[dict]:
    posts = out["posts"] if isinstance(out, dict) else out
    if not isinstance(posts, list) or len(posts) != 3:
        raise ValueError("need exactly 3 posts")
    clean = []
    for i, p in enumerate(posts):
        if p.get("sound") not in SOUND_NAMES:
            raise ValueError(f"post {i}: sound must be one of {SOUND_NAMES}")
        slides = p.get("slides")
        if not isinstance(slides, list) or len(slides) != 5:
            raise ValueError(f"post {i}: need exactly 5 slides")
        if not str(p.get("caption", "")).strip():
            raise ValueError(f"post {i}: caption required")
        clean.append({
            "caption": str(p["caption"]).strip(), "sound": p["sound"],
            "slides": [{"headline": str(s["headline"]).strip(), "body": str(s["body"]).strip()} for s in slides],
        })
    return clean


def _fallback_posts(actions: list[dict]) -> list[dict]:
    trends, sounds = TRENDS["trends"], SOUND_NAMES
    offer = next((a["title"] for a in actions if a["type"] in ("coupon", "winback_email")), None)
    posts = []
    for i in range(3):
        trend = trends[i]
        posts.append({
            "caption": f"{trend['name']}, our way. Soft fabrics, small batches, come say hi.",
            "sound": sounds[i],
            "slides": [
                {"headline": trend["name"], "body": trend["description"]},
                {"headline": "On the rail now", "body": f"Our {trend['name'].lower()} edit, in limited sizes."},
                {"headline": "Made to last", "body": "Natural fabrics you'll reach for every week."},
                {"headline": "Style it three ways", "body": "Desk, dinner, Sunday market."},
                {"headline": "Come say hi", "body": "A little thank-you is waiting for returning friends."
                 if offer and i == 0 else "Small shop, real people. Open Tue to Sun."},
            ],
        })
    return posts


def run(ctx: dict) -> dict:
    brand = memory.read("social", "brand", "brand voice and tone")
    outcomes = memory.read("social", "outcomes", "what content and offers worked")
    actions = ctx.get("actions", [])
    payload = {
        "brand_voice": brand,
        "past_outcomes": outcomes,
        "this_week_plan": [{"type": a["type"], "segment": a["segment"], "title": a["title"]} for a in actions],
        "trends": TRENDS["trends"],
        "sounds": TRENDS["sounds"],
    }
    posts, source = llm_util.with_fallback("social", lambda: llm_util.chat_json("social", [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": json.dumps(payload)},
    ], validate_posts, json_mode=False), lambda: validate_posts(_fallback_posts(actions)))
    return {"social": posts, "social_source": source}
