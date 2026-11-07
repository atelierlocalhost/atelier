"""Synthetic shopper: one persona reacts to every photo variant (one Tinfoil call per persona).

    await react(persona, variants, lessons) -> list[Reaction]   # one per variant
    await run_panel(personas, variants, lessons) -> list[Reaction]

Variants are shuffled per persona and relabelled A-D so position and labels don't
bias the result; shown_as and position are recorded and mapped back to variant_id.
Text only (features, caption, price), no images. If `lessons` is non-empty the
prompt opens with them. Strict JSON, extracted from surrounding text, retried once;
a rule-based reaction is the fallback (logged path=fallback).

Reaction: persona_id, segment, variant_id, shown_as, position, stop_scroll, click,
add_to_cart (0-1), purchase_intent (1-7), wtp_usd, reason, objection, comment, source.
"""
from __future__ import annotations

import asyncio
import os
import random
import time

from b_agents import llm_util

LABELS = "ABCD"
CONCURRENCY = 8
RATE_FIELDS = ("stop_scroll", "click", "add_to_cart")
TEXT_FIELDS = ("reason", "objection", "comment")

# One Tinfoil client for the whole process, created at import (attestation takes ~10-40s).
# llm_util/a_platform cache it, so every lab call reuses this same client.
CLIENT = llm_util.tinfoil_client() if os.getenv("TINFOIL_API_KEY") else None

INSTRUCTIONS = """You are role-playing one real shopper scrolling a social feed. Stay in character: your budget, taste, price sensitivity and habits decide how you react. Be honest; most posts don't get a click, and few get added to cart.

For EACH option, estimate:
- stop_scroll: probability (0 to 1) you stop scrolling on this post
- click: probability (0 to 1) you tap through to the product
- add_to_cart: probability (0 to 1) you add it to cart
- purchase_intent: 1 (never) to 7 (definitely buying)
- wtp_usd: the most you'd pay for this dress, in USD
- reason: one short sentence on what draws you in (or doesn't)
- objection: one short sentence on what holds you back
- comment: what you'd actually type in the comments, in your own voice

Return JSON only, one entry per option:
{"reactions": [{"option": "A", "stop_scroll": 0.4, "click": 0.2, "add_to_cart": 0.05, "purchase_intent": 3, "wtp_usd": 70, "reason": "...", "objection": "...", "comment": "..."}]}"""


def shuffled(persona: dict, variants: list[dict], seed: str = "") -> list[tuple[str, int, dict]]:
    """[(shown_as, position, variant)], shuffled deterministically per persona (+ seed)."""
    order = list(variants)
    random.Random(f"{persona['id']}:{seed}").shuffle(order)
    return [(LABELS[i], i + 1, v) for i, v in enumerate(order)]


def build_prompt(persona: dict, shown: list[tuple[str, int, dict]], lessons: list[str],
                 history: list[str] | None = None) -> str:
    parts = []
    if lessons:
        parts.append("Lessons from this store so far:\n" + "\n".join(f"- {x}" for x in lessons))
    parts.append(
        "You are {name}, in your {age_band}, a {segment} customer of a small clothing boutique. "
        "Style: {style}. Budget for one item: about ${budget_usd}. Price sensitivity: {price_sensitivity}. "
        "You usually discover clothes via {channel}.".format(**persona))
    if history:
        parts.append("Your earlier reactions in this store's photo tests:\n" + "\n".join(f"- {h}" for h in history))
    parts.append(INSTRUCTIONS)
    for label, _, v in shown:
        parts.append(f"Option {label}:\n  Photo: {', '.join(v['features'])}\n  Caption: \"{v['caption']}\"\n"
                     f"  Price: ${v['price_usd']:.0f}")
    return "\n\n".join(parts)


def _rate(x) -> float:
    x = float(x)
    if 1 < x <= 100:  # tolerate percentages
        x /= 100
    if not 0 <= x <= 1:
        raise ValueError(f"rate out of range: {x}")
    return round(x, 3)


def validate_reactions(out, shown: list[tuple[str, int, dict]]) -> dict[str, dict]:
    items = out["reactions"] if isinstance(out, dict) else out
    by_label = {}
    for r in items:
        label = str(r.get("option", r.get("shown_as", ""))).strip().upper().removeprefix("OPTION ").strip()
        missing = [f for f in (*RATE_FIELDS, "purchase_intent", "wtp_usd") if r.get(f) is None]
        if missing:
            raise ValueError(f"option {label or '?'} is missing {', '.join(missing)}")
        intent = round(float(r["purchase_intent"]))
        if not 1 <= intent <= 7:
            raise ValueError(f"purchase_intent out of range: {intent}")
        wtp = float(r["wtp_usd"])
        if wtp < 0:
            raise ValueError("wtp_usd must be >= 0")
        by_label[label] = {**{f: _rate(r[f]) for f in RATE_FIELDS}, "purchase_intent": intent,
                           "wtp_usd": round(wtp, 2), **{f: str(r.get(f, "")).strip() for f in TEXT_FIELDS}}
    missing = {label for label, _, _ in shown} - set(by_label)
    if missing:
        raise ValueError(f"missing options: {sorted(missing)}")
    return by_label


def fallback_reactions(persona: dict, shown: list[tuple[str, int, dict]]) -> dict[str, dict]:
    """Rule-based reaction so the lab still runs without the LLM."""
    rnd = random.Random(persona["id"])
    social = any(c in persona["channel"].lower() for c in ("instagram", "tiktok"))
    older = persona["age_band"][:1] in "56789"
    out = {}
    for label, _, v in shown:
        style = v.get("style", "")
        s = {"flat lay": 0.35, "studio": 0.5, "lifestyle": 0.55, "detail": 0.4}.get(style, 0.45)
        s += 0.1 if (style == "lifestyle" and social) else 0
        s += 0.05 if (style in ("studio", "detail") and older) else 0
        s += 0.1 if (style == "detail" and persona["segment"] == "Champions") else 0
        s *= 0.7 if persona["budget_usd"] < v["price_usd"] else 1.0
        s = min(0.95, max(0.05, s + rnd.uniform(-0.05, 0.05)))
        out[label] = {"stop_scroll": round(s, 3), "click": round(s * 0.6, 3), "add_to_cart": round(s * 0.3, 3),
                      "purchase_intent": max(1, min(7, round(1 + s * 7))),
                      "wtp_usd": round(min(persona["budget_usd"], v["price_usd"]) * (0.7 + s / 2), 2),
                      "reason": f"The {style or v['label'].lower()} photo", "objection": "Not sure about the price",
                      "comment": "Pretty!"}
    return out


async def react(persona: dict, variants: list[dict], lessons: list[str], seed: str = "",
                history: list[str] | None = None) -> list[dict]:
    shown = shuffled(persona, variants, seed)
    prompt = build_prompt(persona, shown, lessons, history)
    label = f"shopper {persona['id']}"

    def call():
        return llm_util.with_fallback(label, lambda: llm_util.chat_json(
            "shopper", [{"role": "user", "content": prompt}], lambda out: validate_reactions(out, shown),
            reasoning_effort="low", label=label,
        ), lambda: fallback_reactions(persona, shown), label=label)

    by_label, source = await asyncio.to_thread(call)
    return sorted(({
        "persona_id": persona["id"], "segment": persona["segment"], "variant_id": v["variant_id"],
        "shown_as": shown_as, "position": position, **by_label[shown_as], "source": source,
    } for shown_as, position, v in shown), key=lambda r: r["variant_id"])


async def run_panel(personas: list[dict], variants: list[dict], lessons: list[str], seed: str = "",
                    history: dict[str, list[str]] | None = None) -> list[dict]:
    """All personas in parallel (at most CONCURRENCY Tinfoil calls in flight). Flat list of reactions.

    `history` maps persona id -> that persona's earlier reactions (from the SQLite mirror).
    """
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(p):
        async with sem:
            return await react(p, variants, lessons, seed, (history or {}).get(p["id"]))

    started = time.time()
    results = await asyncio.gather(*(one(p) for p in personas))
    reactions = [r for rs in results for r in rs]
    n_llm = sum(rs[0]["source"] == "llm" for rs in results)
    print(f"[lab] shopper panel: {n_llm}/{len(personas)} personas via tinfoil, "
          f"{len(personas) - n_llm} fallback, {len(reactions)} reactions in {time.time() - started:.1f}s", flush=True)
    return reactions
