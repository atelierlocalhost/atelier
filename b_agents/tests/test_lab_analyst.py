import asyncio
from typing import get_type_hints

import numpy as np
import pandas as pd

from b_agents import lab_analyst, lab_fixture, persona_gen, shopper
from b_agents.lab_contract import LabResult, LabVariant, Winner
from shared.contracts import SEGMENT_NAMES

PERSONAS = persona_gen.fallback_personas()


def ctx_with(reactions):
    return {"lab_run_id": "l_test", "variant_set_id": "vs_01", "product": lab_fixture.PRODUCT,
            "variants": lab_fixture.VARIANTS, "personas": PERSONAS, "reactions": reactions,
            "lessons_used": [], "tokens": 1000}


def synthetic(gap: float) -> list[dict]:
    """Variant v scores base + v*gap for everyone, plus persona noise."""
    rng = np.random.default_rng(1)
    rs = []
    for p in PERSONAS:
        noise = rng.normal(0, 0.05)
        for v in lab_fixture.VARIANTS:
            x = float(np.clip(0.3 + v["variant_id"] * gap + noise, 0, 1))
            rs.append({"persona_id": p["id"], "segment": p["segment"], "variant_id": v["variant_id"],
                       "shown_as": "A", "position": 1, "stop_scroll": x, "click": x, "add_to_cart": x,
                       "purchase_intent": 4, "wtp_usd": 80, "reason": "love the linen fabric",
                       "objection": "too expensive for me", "comment": f"nice {v['variant_id']}"})
    return rs


def test_lab_result_shape_exact():
    reactions = asyncio.run(shopper.run_panel(PERSONAS, lab_fixture.VARIANTS, []))  # fallback reactions
    out = lab_analyst.run(ctx_with(reactions))
    contract = set(get_type_hints(LabResult))
    assert contract <= set(out)
    assert all(k.startswith("analyst_") for k in set(out) - contract)
    assert set(out["winner"]) == set(get_type_hints(Winner))
    for v in out["variants"]:
        assert set(v) == set(get_type_hints(LabVariant))
        assert set(v["by_segment"]) == set(SEGMENT_NAMES)
        assert v["ci"][0] <= v["score"] <= v["ci"][1]
    assert sorted(v["rank"] for v in out["variants"]) == [1, 2, 3, 4]
    assert len(out["working"]) == 3 and len(out["fix"]) == 3 and 1 <= len(out["lessons_learned"]) <= 3
    assert out["costs"]["darkbloom_usd"] == 0.0
    assert len(out["comments"]) == 5 and all(c["persona"].count(",") == 2 for c in out["comments"])


def test_score_formula_and_segments():
    rs = synthetic(0.1)
    df = lab_analyst.scores(rs)
    r = rs[0]
    assert abs(df["score"][0] - (0.2 * r["stop_scroll"] + 0.3 * r["click"] + 0.5 * r["add_to_cart"])) < 1e-9
    num = lab_analyst.compute(ctx_with(rs))
    v4 = next(v for v in num["variants"] if v["variant_id"] == 4)
    expected = pd.DataFrame(rs).assign(score=df["score"]).query("variant_id == 4").groupby("segment")["score"].mean()
    assert all(abs(v4["by_segment"][s] - round(expected[s], 3)) < 1e-9 for s in SEGMENT_NAMES)


def test_clear_vs_too_close():
    clear = lab_analyst.compute(ctx_with(synthetic(0.1)))
    assert clear["winner"]["variant_id"] == 4 and clear["winner"]["call"] == "clear"
    assert clear["winner"]["lift_pct"] > 0
    close = lab_analyst.compute(ctx_with(synthetic(0.001)))
    assert close["winner"]["call"] == "too_close"


def test_grouping_shares():
    num = lab_analyst.compute(ctx_with(synthetic(0.1)))
    assert {r["variant_id"] for r in num["reasons"]} == {1, 2, 3, 4}
    assert all(r["text"].startswith("Fabric and craft") and r["share"] == 1.0 for r in num["reasons"])
    assert all(o["text"].startswith("Price and value") for o in num["objections"])


def test_validator_accepts_unicode_hyphen_segment():
    out = lab_analyst.validate_text({"working": ["a", "b", "c"], "fix": ["d", "e", "f"],
                                     "lessons_learned": ["Studio photos score +41.6% for At\u2011risk shoppers"]})
    assert out["lessons_learned"] == ["Studio photos score +41.6% for At-risk shoppers"]
