"""Insights agent: RFM segmentation in pandas, LLM (Tinfoil) only explains the numbers.

run(ctx) needs ctx["db_path"]; optional ctx["as_of"] (ISO date, defaults to the
day after the latest order). Returns {"insights": Insights, "insights_stats": {...},
"insights_source": "llm" | "fallback"}. The extra keys are not part of the run JSON.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pandas as pd

from b_agents import llm_util, memory
from shared.contracts import SEGMENT_NAMES

PROMPT = (Path(__file__).parent / "prompts" / "insights.txt").read_text()


def load_frames(db_path: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    with sqlite3.connect(db_path) as conn:
        customers = pd.read_sql("SELECT id, signup_date FROM customers", conn)
        orders = pd.read_sql("SELECT customer_id, amount, created_at FROM orders", conn)
    orders["created_at"] = pd.to_datetime(orders["created_at"])
    return customers, orders


def _score(s: pd.Series, ascending: bool = True) -> pd.Series:
    """Quintile score 1-5. Rank first so ties don't collapse the bins."""
    ranks = s.rank(method="first", ascending=ascending)
    return pd.qcut(ranks, 5, labels=[1, 2, 3, 4, 5]).astype(int)


def _segment(row) -> str:
    # Quintiles are relative, so in a small shop we add raw guards: order counts tie
    # heavily (use the count) and "lapsed" means 90+ days regardless of quintile.
    lapsed = row.R <= 2 or row.recency_days > 90
    if row.R >= 4 and row.F >= 4 and row.M >= 4:
        return "Champions"
    if row.frequency == 1 and row.recency_days <= 60:
        return "New"
    if not lapsed and row.frequency >= 3:
        return "Loyal"
    if lapsed and (row.frequency >= 3 or row.M >= 4):
        return "At risk"
    return "Hibernating"


def compute_rfm(customers: pd.DataFrame, orders: pd.DataFrame, as_of=None) -> pd.DataFrame:
    as_of = pd.Timestamp(as_of) if as_of else orders["created_at"].max().normalize() + pd.Timedelta(days=1)
    rfm = orders.groupby("customer_id").agg(
        last_order=("created_at", "max"), frequency=("amount", "size"), monetary=("amount", "sum")
    )
    rfm["recency_days"] = (as_of - rfm["last_order"]).dt.days
    rfm["R"] = _score(rfm["recency_days"], ascending=False)  # more recent -> higher score
    rfm["F"] = _score(rfm["frequency"])
    rfm["M"] = _score(rfm["monetary"])
    rfm["segment"] = rfm.apply(_segment, axis=1)
    rfm["churn_risk"] = (rfm["recency_days"] > 90) & ((rfm["frequency"] >= 3) | (rfm["M"] >= 4))
    return rfm


def summarize(rfm: pd.DataFrame) -> dict:
    """Aggregates only, no PII. This is all the LLM ever sees."""
    total_rev = rfm["monetary"].sum()
    by_seg = rfm.groupby("segment").agg(
        count=("monetary", "size"), avg_spend=("monetary", "mean"), revenue=("monetary", "sum"),
        avg_recency_days=("recency_days", "mean"), avg_orders=("frequency", "mean"),
        churn_risk=("churn_risk", "sum"),
    )
    segments = []
    for name in SEGMENT_NAMES:
        if name not in by_seg.index:
            continue
        r = by_seg.loc[name]
        segments.append({
            "name": name, "count": int(r["count"]), "avg_spend": round(float(r["avg_spend"]), 2),
            "revenue_share_pct": round(float(r["revenue"] / total_rev * 100), 1),
            "avg_recency_days": round(float(r["avg_recency_days"]), 1),
            "avg_orders": round(float(r["avg_orders"]), 2), "churn_risk": int(r["churn_risk"]),
        })
    return {
        "customers": int(len(rfm)), "revenue": round(float(total_rev), 2),
        "churn_risk_customers": int(rfm["churn_risk"].sum()), "segments": segments,
    }


def _fallback_explain(stats: dict) -> dict:
    seg = {s["name"]: s for s in stats["segments"]}
    working, fix = [], []
    if c := seg.get("Champions"):
        working.append(f"Champions ({c['count']}) drive {c['revenue_share_pct']}% of revenue at ${c['avg_spend']:.0f} avg spend")
    if l := seg.get("Loyal"):
        working.append(f"Loyal customers ({l['count']}) average {l['avg_orders']} orders each")
    if n := seg.get("New"):
        working.append(f"{n['count']} new customers placed a first order recently")
    if a := seg.get("At risk"):
        fix.append(f"{a['count']} At risk customers spent ${a['avg_spend']:.0f} on average but last ordered ~{a['avg_recency_days']:.0f} days ago")
    if h := seg.get("Hibernating"):
        fix.append(f"Hibernating is {h['count']} customers with ${h['avg_spend']:.0f} avg spend")
    fix.append(f"{stats['churn_risk_customers']} customers are flagged as churn risk")
    return {"working": working, "fix": fix}


def _validate(out: dict) -> dict:
    working = [str(x) for x in out["working"]][:4]
    fix = [str(x) for x in out["fix"]][:4]
    if not working or not fix:
        raise ValueError("working and fix must be non-empty lists")
    return {"working": working, "fix": fix}


def explain(stats: dict) -> tuple[dict, str]:
    """Returns (text, source) where source is "llm" or "fallback"."""
    return llm_util.with_fallback("insights", lambda: llm_util.chat_json("insights", [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": json.dumps(stats)},
    ], _validate), lambda: _fallback_explain(stats))


def run(ctx: dict) -> dict:
    customers, orders = load_frames(ctx["db_path"])
    rfm = compute_rfm(customers, orders, ctx.get("as_of"))
    stats = summarize(rfm)
    text, source = explain(stats)
    insights = {
        "segments": [{k: s[k] for k in ("name", "count", "avg_spend")} for s in stats["segments"]],
        "working": text["working"],
        "fix": text["fix"],
    }
    seg_line = ", ".join(f"{s['name']} {s['count']} (${s['avg_spend']:.0f})" for s in stats["segments"])
    memory.write("insights", "customers", {
        "text": f"Run {ctx.get('run_id', '?')}: {stats['customers']} customers; {seg_line}; "
                f"{stats['churn_risk_customers']} churn risk.",
    })
    return {"insights": insights, "insights_stats": stats, "insights_source": source}
