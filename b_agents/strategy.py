"""Strategy agent: turns insights + competitors + past outcomes into 3-5 proposed actions.

Reads outcomes memory first ("What has worked for this store before?") and puts
those strings in memory_used. LLM is Tinfoil (customer-derived data). If the LLM
is unavailable, a rule-based planner uses the same memory so the demo still learns.

Action ids start at ctx.get("next_action_id", 1); A can replace them with DB ids.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from b_agents import llm_util, memory
from shared.contracts import ACTION_TYPES, SEGMENT_NAMES

PROMPT = (Path(__file__).parent / "prompts" / "strategy.txt").read_text()
MEMORY_QUERY = "What has worked for this store before?"


def validate_actions(out, start_id: int = 1) -> list[dict]:
    items = out["actions"] if isinstance(out, dict) else out
    if not isinstance(items, list) or not 3 <= len(items) <= 5:
        raise ValueError("need a list of 3 to 5 actions")
    actions = []
    for i, a in enumerate(items):
        if a.get("type") not in ACTION_TYPES:
            raise ValueError(f"action {i}: type must be one of {ACTION_TYPES}")
        if a.get("segment") not in SEGMENT_NAMES:
            raise ValueError(f"action {i}: segment must be one of {SEGMENT_NAMES}")
        if not str(a.get("title", "")).strip() or not str(a.get("why", "")).strip():
            raise ValueError(f"action {i}: title and why are required")
        actions.append({
            "id": start_id + i, "type": a["type"], "segment": a["segment"],
            "title": str(a["title"]).strip(), "why": str(a["why"]).strip(), "status": "proposed",
        })
    return actions


# ---------- rule-based fallback ----------

TYPE_WORDS = {
    "winback_email": ("win-back", "winback", "win back", "email"),
    "coupon": ("coupon", "discount", "code"),
    "bundle": ("bundle",),
    "acquisition_post": ("post", "social", "acquisition"),
}


def parse_outcome(text: str) -> dict | None:
    """'Winback coupon to At risk: 12% redeemed' -> {types, segment, pct, text}."""
    seg = next((s for s in SEGMENT_NAMES if s.lower() in text.lower()), None)
    pct = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    types = [t for t, words in TYPE_WORDS.items() if any(w in text.lower() for w in words)]
    if not seg or not pct or not types:
        return None
    return {"types": types, "segment": seg, "pct": float(pct.group(1)), "text": text}


def _fallback_plan(insights: dict, competitors: list[dict], memory_used: list[str]) -> list[dict]:
    seg = {s["name"]: s for s in insights["segments"]}

    def n(name):
        return seg.get(name, {}).get("count", 0)

    promo = next((f"{c['name']} is running \"{c['promos'][0]}\"" for c in competitors if c.get("promos")), None)
    plan = [
        {"type": "coupon", "segment": "At risk", "title": "15% come-back coupon for At risk customers",
         "why": f"{n('At risk')} customers with ${seg.get('At risk', {}).get('avg_spend', 0):.0f} avg spend have gone quiet for 90+ days"},
        {"type": "bundle", "segment": "Loyal", "title": "Curated 3-piece bundle for Loyal customers",
         "why": f"{n('Loyal')} Loyal customers already buy repeatedly; a bundle lifts order value"
                + (f" and answers {promo}" if promo else "")},
        {"type": "acquisition_post", "segment": "New", "title": "New-arrivals post to keep new shoppers coming",
         "why": f"{n('New')} new customers arrived recently; keep the top of the funnel warm"},
        {"type": "winback_email", "segment": "Hibernating", "title": "Gentle 'we miss you' email to Hibernating",
         "why": f"Hibernating is {n('Hibernating')} customers; a low-cost email tests if any can be revived"},
    ]
    outcomes = [o for o in map(parse_outcome, memory_used) if o]
    for o in sorted(outcomes, key=lambda o: -o["pct"]):
        matches = [a for a in plan if a["segment"] == o["segment"] and a["type"] in o["types"]]
        if o["pct"] >= 5:  # worked: lead with it, and repeat the playbook
            for a in matches:
                plan.remove(a)
            main_type = o["types"][0]
            plan.insert(0, {
                "type": main_type, "segment": o["segment"],
                "title": f"Repeat what worked: {o['text'].split(':')[0]}",
                "why": f"Memory: \"{o['text']}\", our best result so far, so run it again for the {n(o['segment'])} {o['segment']} customers",
            })
            for a in plan:
                if a["segment"] == "Hibernating" and o["segment"] == "At risk":
                    a.update(type=main_type, title=f"Extend the {o['segment']} win-back to Hibernating",
                             why=f"The same offer worked for At risk ({o['pct']:.0f}%); Hibernating ({n('Hibernating')}) is the next lapsed group")
        else:  # didn't work: drop it and say why
            for a in matches:
                plan.remove(a)
            plan.append({
                "type": "acquisition_post", "segment": o["segment"],
                "title": f"Swap the {o['types'][0].replace('_', ' ')} for a styling post aimed at {o['segment']}",
                "why": f"Memory: \"{o['text']}\" barely moved, so try content instead of another offer",
            })
    seen, deduped = set(), []
    for a in plan:
        if (a["type"], a["segment"]) not in seen:
            seen.add((a["type"], a["segment"]))
            deduped.append(a)
    return deduped[:5]


# ---------- agent ----------

def plan(insights: dict, competitors: list[dict], memory_used: list[str], stats: dict | None = None,
         start_id: int = 1) -> tuple[list[dict], str]:
    """Returns (actions, source) where source is "llm" or "fallback"."""
    payload = {"insights": insights, "segment_stats": (stats or {}).get("segments"),
               "competitors": competitors, "past_outcomes": memory_used}
    return llm_util.with_fallback("strategy", lambda: llm_util.chat_json("strategy", [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": json.dumps(payload)},
    ], lambda out: validate_actions(out, start_id)),
        lambda: validate_actions(_fallback_plan(insights, competitors, memory_used), start_id))


def run(ctx: dict) -> dict:
    memory_used = memory.read("strategy", "outcomes", MEMORY_QUERY)
    actions, source = plan(ctx["insights"], ctx.get("competitors", []), memory_used,
                           ctx.get("insights_stats"), ctx.get("next_action_id", 1))
    return {"actions": actions, "memory_used": memory_used, "strategy_source": source}
