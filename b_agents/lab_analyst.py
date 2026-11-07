"""Lab analyst: turns shopper reactions into a LabResult (b_agents/lab_contract.py).

run(ctx) needs:
    lab_run_id, variant_set_id, product (name or {"name": ...}),
    variants  (variant_id, label, image_url, features, optional style),
    personas  (persona_gen output), reactions (shopper.run_panel output),
    lessons_used (list[str], what the shoppers were shown)
optional: calibration (defaults to memory.calibration_summary()), tokens (for costs;
defaults to llm_util.usage(), so reset_usage() at the start of a lab run),
remember (default True).

Memory (one Cognee batch): lessons_learned -> lab_outcomes, each variant's prediction
-> calibration (for memory.record_observed), each persona's reactions -> persona:<id>.

All numbers are computed in pandas/numpy:
    score = 0.2*stop_scroll + 0.3*click + 0.5*add_to_cart, per variant and per segment;
    1000-sample bootstrap over personas -> 90% interval; winner is "clear" only if
    its ci_low > the runner-up's ci_high. One Tinfoil call writes 3 working + 3 fix
    lines and 1-3 lessons_learned from those numbers (rule-based fallback).
Extra fields live under analyst_* keys.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

from b_agents import llm_util, memory
from shared.contracts import SEGMENT_NAMES

PROMPT = (Path(__file__).parent / "prompts" / "lab_analyst.txt").read_text()
WEIGHTS = {"stop_scroll": 0.2, "click": 0.3, "add_to_cart": 0.5}
N_BOOT, CI = 1000, 90
USD_PER_M = {"tinfoil": 0.60, "frontier": 10.0}  # same rates as a_platform.llm.USD_PER_M_TOKENS

# Keyword themes for grouping free-text reasons and objections.
THEMES = [
    ("Price and value", ("price", "$", "expensive", "cost", "afford", "budget", "value", "pricey", "worth", "sale",
                         "discount", "cheap")),
    ("Real-life styling", ("street", "outdoor", "real life", "real-life", "lifestyle", "everyday", "vibe", "sunny",
                           "market", "walking", "moves", "movement", "in action", "context")),
    ("Seeing it worn", ("model", "on a person", "on someone", "worn", "on a body", "how it looks on")),
    ("Fit and shape", ("fit", "silhouette", "flatter", "shape", "wrap", "waist", "length", "size", "drape", "tie")),
    ("Fabric and craft", ("linen", "fabric", "texture", "material", "quality", "stitch", "seam", "detail", "craft",
                          "button", "close-up", "closeup")),
    ("Clean, simple look", ("clean", "simple", "white", "minimal", "plain", "flat lay", "flat")),
    ("Color", ("color", "colour", "sage", "green", "palette", "tone", "golden")),
]


def _name(product) -> str:
    return product["name"] if isinstance(product, dict) else str(product)


def scores(reactions: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(reactions)
    df["score"] = sum(w * df[f] for f, w in WEIGHTS.items())
    return df


def bootstrap_ci(df: pd.DataFrame, n_boot: int = N_BOOT, ci: int = CI, seed: int = 0) -> dict[int, list[float]]:
    """Resample personas with replacement; interval of each variant's mean score."""
    mat = df.pivot_table(index="persona_id", columns="variant_id", values="score", aggfunc="mean")
    mat = mat.fillna(mat.mean())
    idx = np.random.default_rng(seed).integers(0, len(mat), size=(n_boot, len(mat)))
    means = mat.to_numpy()[idx].mean(axis=1)  # (n_boot, n_variants)
    lo, hi = np.percentile(means, [(100 - ci) / 2, 100 - (100 - ci) / 2], axis=0)
    return {int(v): [round(float(a), 3), round(float(b), 3)] for v, a, b in zip(mat.columns, lo, hi)}


def theme_of(text: str) -> str:
    t = text.lower()
    hits = [(sum(k in t for k in keys), -i, name) for i, (name, keys) in enumerate(THEMES)]
    best = max(hits)
    return best[2] if best[0] > 0 else "Other"


def group_texts(df: pd.DataFrame, field: str, per_variant: int = 2) -> list[dict]:
    """Group a free-text field by theme within each variant; share = fraction of that variant's personas."""
    rows = []
    for vid, g in df[df[field].str.len() > 0].groupby("variant_id"):
        themes = g[field].map(theme_of)
        n = df[df["variant_id"] == vid]["persona_id"].nunique()
        for theme, count in themes.value_counts().head(per_variant).items():
            example = g[field][themes == theme].iloc[0]
            rows.append({"variant_id": int(vid), "text": f"{theme}: \"{example}\"", "share": round(count / n, 2)})
    return sorted(rows, key=lambda r: (r["variant_id"], -r["share"]))


def pick_comments(df: pd.DataFrame, personas: list[dict], k: int = 5) -> list[dict]:
    """One per segment where possible, the most purchase-minded comment, spreading across variants."""
    by_id = {p["id"]: p for p in personas}
    pool = df[df["comment"].str.len() > 0].sort_values(["purchase_intent", "score"], ascending=False)
    picked, used_variants = [], set()
    for seg in SEGMENT_NAMES:
        cands = pool[pool["segment"] == seg]
        if cands.empty:
            continue
        fresh = cands[~cands["variant_id"].isin(used_variants)]
        r = (fresh if not fresh.empty else cands).iloc[0]
        p = by_id.get(r["persona_id"], {})
        picked.append({"persona": f"{p.get('name', r['persona_id'])}, {p.get('age_band', '?')}, {seg}",
                       "variant_id": int(r["variant_id"]), "text": r["comment"]})
        used_variants.add(r["variant_id"])
    return picked[:k]


def compute(ctx: dict) -> dict:
    """Everything numeric in the LabResult (no LLM)."""
    df = scores(ctx["reactions"])
    variants = {v["variant_id"]: v for v in ctx["variants"]}
    overall = df.groupby("variant_id")["score"].mean()
    seg = df.pivot_table(index="variant_id", columns="segment", values="score", aggfunc="mean")
    cis = bootstrap_ci(df)
    order = overall.sort_values(ascending=False).index.tolist()
    rows = []
    for rank, vid in enumerate(order, 1):
        v = variants[vid]
        rows.append({
            "variant_id": int(vid), "label": v["label"], "image_url": v["image_url"], "features": v["features"],
            "score": round(float(overall[vid]), 3), "ci": cis[vid], "rank": rank,
            # a segment with no personas falls back to the overall score
            "by_segment": {s: round(float(seg.at[vid, s]), 3) if s in seg.columns and pd.notna(seg.at[vid, s])
                           else round(float(overall[vid]), 3) for s in SEGMENT_NAMES},
        })
    w, r = rows[0], rows[1]
    winner = {"variant_id": w["variant_id"], "label": w["label"],
              "lift_pct": round((w["score"] - r["score"]) / r["score"] * 100, 1) if r["score"] else 0.0,
              "call": "clear" if w["ci"][0] > r["ci"][1] else "too_close"}
    return {"df": df, "variants": rows, "winner": winner,
            "reasons": group_texts(df, "reason"), "objections": group_texts(df, "objection"),
            "comments": pick_comments(df, ctx["personas"])}


def segment_deltas(rows: list[dict]) -> list[tuple[float, dict, str]]:
    """(delta_pct vs that segment's average across variants, variant, segment), biggest first."""
    out = []
    for s in SEGMENT_NAMES:
        avg = np.mean([v["by_segment"][s] for v in rows])
        for v in rows:
            if avg:
                out.append(((v["by_segment"][s] - avg) / avg * 100, v, s))
    return sorted(out, key=lambda x: -abs(x[0]))


def _fallback_text(num: dict, styles: dict[int, str]) -> dict:
    rows, w = num["variants"], num["winner"]
    best_seg = max(SEGMENT_NAMES, key=lambda s: rows[0]["by_segment"][s])
    worst = rows[-1]
    top_reason = next((t["text"] for t in num["reasons"] if t["variant_id"] == w["variant_id"]), "")
    top_obj = max(num["objections"], key=lambda t: t["share"], default={"text": "", "share": 0})
    working = [
        f"{w['label']} wins with a score of {rows[0]['score']:.2f}, {w['lift_pct']}% ahead of {rows[1]['label']}",
        f"{w['label']} is strongest with {best_seg} shoppers ({rows[0]['by_segment'][best_seg]:.2f})",
        f"Top reason for {w['label']}: {top_reason}" if top_reason else f"{len(num['df'])} reactions collected",
    ]
    fix = [
        f"{worst['label']} ranks last at {worst['score']:.2f}",
        f"Most common objection ({top_obj['share']:.0%}): {top_obj['text']}",
        "The top two are too close to call; test with real traffic" if w["call"] == "too_close"
        else f"Lead with {w['label']} and retire {worst['label']}",
    ]
    lessons = [f"{styles.get(v['variant_id'], v['label'].lower())} photos score {d:+.0f}% vs average with {s} shoppers"
               for d, v, s in segment_deltas(rows)[:2]]
    return {"working": working, "fix": fix, "lessons_learned": lessons}


def validate_text(out: dict) -> dict:
    working, fix = [str(x) for x in out["working"]], [str(x) for x in out["fix"]]
    lessons = [str(x) for x in out["lessons_learned"]]
    if len(working) < 3 or len(fix) < 3:
        raise ValueError("need 3 working and 3 fix lines")
    if not 1 <= len(lessons) <= 3:
        raise ValueError("need 1 to 3 lessons_learned")
    for lesson in lessons:
        if not any(s.lower() in lesson.lower() for s in SEGMENT_NAMES) or not re.search(r"\d", lesson):
            raise ValueError(f"lesson must name a segment and a number: {lesson!r}")
    return {"working": working[:3], "fix": fix[:3], "lessons_learned": lessons}


def explain(num: dict, ctx: dict, styles: dict[int, str]) -> tuple[dict, str]:
    payload = {
        "product": _name(ctx["product"]),
        "variants": [{**{k: v[k] for k in ("variant_id", "label", "features", "score", "ci", "rank", "by_segment")},
                      "style": styles.get(v["variant_id"])} for v in num["variants"]],
        "winner": num["winner"], "reasons": num["reasons"], "objections": num["objections"],
        # precomputed so lessons quote real deltas instead of the model doing arithmetic
        "segment_deltas": [{"style": styles.get(v["variant_id"]), "variant": v["label"], "segment": s,
                            "delta_pct_vs_segment_avg": round(d, 1)} for d, v, s in segment_deltas(num["variants"])[:6]],
        "lessons_used": ctx.get("lessons_used", []), "calibration": ctx.get("calibration"),
    }
    return llm_util.with_fallback("lab_analyst", lambda: llm_util.chat_json("lab_analyst", [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": json.dumps(payload)},
    ], validate_text), lambda: _fallback_text(num, styles))


def costs(tokens: int) -> dict:
    return {"sie_usd": 0.0, "tinfoil_usd": round(tokens / 1e6 * USD_PER_M["tinfoil"], 4), "darkbloom_usd": 0.0,
            "frontier_equiv_usd": round(tokens / 1e6 * USD_PER_M["frontier"], 4)}


def remember(result: dict, df: pd.DataFrame, ctx: dict, styles: dict[int, str]) -> None:
    run_id = result["lab_run_id"]
    labels = {v["variant_id"]: v["label"] for v in result["variants"]}
    items = [("lab_outcomes", {"text": lesson, "type": "lesson", "lab_run_id": run_id})
             for lesson in result["lessons_learned"]]
    items += [("calibration", {"type": "prediction", "lab_run_id": run_id, "variant_id": v["variant_id"],
                               "label": v["label"], "style": styles[v["variant_id"]], "score": v["score"],
                               "by_segment": v["by_segment"],
                               "text": f"{run_id} predicted {v['label']} at {v['score']:.3f}"})
              for v in result["variants"]]
    for pid, g in df.groupby("persona_id"):
        best, worst = g.loc[g["score"].idxmax()], g.loc[g["score"].idxmin()]
        items.append((f"persona:{pid}", {"lab_run_id": run_id, "text": (
            f"{run_id}: liked {labels[best['variant_id']]} most ({best['add_to_cart']:.0%} add to cart, "
            f"intent {best['purchase_intent']}/7), {labels[worst['variant_id']]} least. "
            f"Objection: {best['objection']}")}))
    memory.write_many("lab_analyst", items)


def run(ctx: dict) -> dict:
    styles = {v["variant_id"]: v.get("style") or v["label"].lower() for v in ctx["variants"]}
    num = compute(ctx)
    calibration = ctx.get("calibration") or memory.calibration_summary()
    text, source = explain(num, {**ctx, "calibration": calibration}, styles)
    tokens = ctx["tokens"] if "tokens" in ctx else llm_util.usage()["tokens"]
    result = {
        "lab_run_id": ctx["lab_run_id"], "variant_set_id": ctx["variant_set_id"], "product": _name(ctx["product"]),
        "winner": num["winner"], "variants": num["variants"],
        "reasons": num["reasons"], "objections": num["objections"], "comments": num["comments"],
        "lessons_used": list(ctx.get("lessons_used", [])), "lessons_learned": text["lessons_learned"],
        "calibration": calibration,
        "working": text["working"], "fix": text["fix"], "costs": costs(tokens),
        "analyst_source": source, "analyst_n_personas": int(num["df"]["persona_id"].nunique()),
        "analyst_n_reactions": int(len(num["df"])), "analyst_tokens": int(tokens),
    }
    if ctx.get("remember", True):
        remember(result, num["df"], ctx, styles)
    return result
