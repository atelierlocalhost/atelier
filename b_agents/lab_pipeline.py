"""Shopper Lab pipeline: what A's lab.py calls.

    result = await lab_pipeline.arun(ctx)   # from async code (FastAPI async endpoint)
    result = lab_pipeline.run(ctx)          # from sync code

ctx in:
    lab_run_id      "l_001"
    variant_set_id  "vs_01"
    product         "Linen wrap dress" or {"name": ...}
    variants        [{variant_id, label, image_url, features, caption, price_usd, style?}]
    segments        insights_stats["segments"] (needed only when personas aren't given)
    personas        optional; reuse a previous run's personas to compare runs fairly
ctx out (added): personas, persona_gen_source

Order: persona_gen (if needed) -> lessons from lab_outcomes, read ONCE (top 5) ->
persona histories from the SQLite mirror -> shopper.run_panel -> lab_analyst.run
(which writes lab_outcomes / calibration / persona:<id> to memory).
Returns a LabResult (b_agents/lab_contract.py) plus analyst_* extras.
"""
from __future__ import annotations

import asyncio
import time

from b_agents import lab_analyst, llm_util, memory, persona_gen, shopper

LESSON_QUERY = "What do shoppers in this store respond to in product photos?"


async def arun(ctx: dict) -> dict:
    started = time.time()
    llm_util.reset_usage()
    generated = not ctx.get("personas")
    if generated:
        ctx.update(await asyncio.to_thread(persona_gen.run, ctx))
    lessons = await asyncio.to_thread(memory.read, "shopper", "lab_outcomes", LESSON_QUERY, 5)
    history = {p["id"]: [r["text"] for r in memory.read_records("shopper", f"persona:{p['id']}", limit=2)]
               for p in ctx["personas"]}
    reactions = await shopper.run_panel(ctx["personas"], ctx["variants"], lessons, history=history)
    result = await asyncio.to_thread(lab_analyst.run, {**ctx, "reactions": reactions, "lessons_used": lessons})
    n_llm = len({r["persona_id"] for r in reactions if r["source"] == "llm"})
    result["analyst_sources"] = {"persona_gen": ctx["persona_gen_source"] if generated else "reused",
                                 "shopper": f"{n_llm}/{len(ctx['personas'])} llm",
                                 "lab_analyst": result["analyst_source"]}
    result["analyst_runtime_s"] = round(time.time() - started, 1)
    print(f"[lab] {result['lab_run_id']} done in {result['analyst_runtime_s']}s  sources={result['analyst_sources']}",
          flush=True)
    return result


def run(ctx: dict) -> dict:
    """Sync wrapper. From inside a running event loop, use `await arun(ctx)` instead."""
    return asyncio.run(arun(ctx))
