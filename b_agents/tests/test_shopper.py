import asyncio
import json
import re
import time

import pytest
from dotenv import dotenv_values

from b_agents import lab_fixture, llm_util, persona_gen, shopper

VARIANTS = lab_fixture.VARIANTS
PERSONAS = persona_gen.fallback_personas()


def fake_llm(task, messages, *a, **k):
    """Answers with add_to_cart = variant_id / 10, found by matching each option's caption."""
    prompt = messages[0]["content"]
    reactions = []
    for label, body in re.findall(r"Option ([A-D]):\n(.*?)(?=\n\nOption|\Z)", prompt, re.S):
        vid = next(v["variant_id"] for v in VARIANTS if v["caption"] in body)
        reactions.append({"option": label, "stop_scroll": 0.5, "click": 0.3, "add_to_cart": vid / 10,
                          "purchase_intent": 4, "wtp_usd": 80, "reason": "r", "objection": "o", "comment": "c"})
    return "Sure, here you go:\n" + json.dumps({"reactions": reactions})


def test_shuffle_relabels_and_maps_back(monkeypatch):
    monkeypatch.setenv("TINFOIL_API_KEY", "fake")
    monkeypatch.setattr(llm_util, "chat", fake_llm)
    rs = asyncio.run(shopper.react(PERSONAS[0], VARIANTS, []))
    assert [r["variant_id"] for r in rs] == [1, 2, 3, 4]
    assert all(r["add_to_cart"] == r["variant_id"] / 10 for r in rs)
    assert sorted(r["shown_as"] for r in rs) == list("ABCD")
    assert sorted(r["position"] for r in rs) == [1, 2, 3, 4]
    assert all(r["source"] == "llm" for r in rs)
    # different personas see different orders
    orders = {tuple(v["variant_id"] for _, _, v in shopper.shuffled(p, VARIANTS)) for p in PERSONAS}
    assert len(orders) > 1


def test_prompt_opens_with_lessons_only_when_given():
    shown = shopper.shuffled(PERSONAS[0], VARIANTS)
    assert shopper.build_prompt(PERSONAS[0], shown, ["Street photos win with New"]).startswith(
        "Lessons from this store so far:\n- Street photos win with New")
    plain = shopper.build_prompt(PERSONAS[0], shown, [])
    assert "Lessons" not in plain and plain.startswith("You are ")
    assert "/api/images" not in plain  # text only


def test_validator_rejects_missing_option_and_bad_ranges():
    shown = shopper.shuffled(PERSONAS[0], VARIANTS)
    ok = {"stop_scroll": 0.5, "click": 0.3, "add_to_cart": 0.1, "purchase_intent": 4, "wtp_usd": 80,
          "reason": "r", "objection": "o", "comment": "c"}
    with pytest.raises(ValueError):
        shopper.validate_reactions({"reactions": [{"option": l, **ok} for l in "ABC"]}, shown)
    with pytest.raises(ValueError):
        shopper.validate_reactions({"reactions": [{"option": l, **ok, "purchase_intent": 9} for l in "ABCD"]}, shown)


def test_panel_fallback_without_key():
    rs = asyncio.run(shopper.run_panel(PERSONAS, VARIANTS, []))
    assert len(rs) == 80 and all(r["source"] == "fallback" for r in rs)


@pytest.mark.skipif(not dotenv_values(".env").get("TINFOIL_API_KEY"), reason="needs TINFOIL_API_KEY in .env")
def test_live_panel_20_of_20_under_60s(monkeypatch):
    monkeypatch.setenv("TINFOIL_API_KEY", dotenv_values(".env")["TINFOIL_API_KEY"])
    llm_util.tinfoil_client()  # one-time client creation isn't part of the panel time
    started = time.time()
    rs = asyncio.run(shopper.run_panel(PERSONAS, VARIANTS, []))
    elapsed = time.time() - started
    print(f"live panel: {len(rs)} reactions in {elapsed:.1f}s")
    assert len(rs) == 80
    assert sum(r["source"] == "llm" for r in rs) == 80, "all 20 personas should be valid Tinfoil responses"
    assert elapsed < 60
