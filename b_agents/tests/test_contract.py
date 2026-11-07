import pytest
from typing import get_type_hints

from b_agents import insights, memory, social, strategy
from shared.contracts import ACTION_TYPES, SEGMENT_NAMES, Action, Insights, Segment, Slide, SocialPost, load_mock


def keys(td):
    return set(get_type_hints(td))


@pytest.fixture
def ctx(fixture_db):
    path, _ = fixture_db
    c = {"run_id": "r_test", "db_path": path, "competitors": load_mock()["competitors"]}
    c.update(insights.run(c))
    return c


def test_insights_shape(ctx):
    ins = ctx["insights"]
    assert set(ins) == keys(Insights)
    assert all(set(s) == keys(Segment) for s in ins["segments"])
    assert ins["working"] and ins["fix"]
    assert memory.read("insights", "customers", "segments")  # summary written to memory


def test_strategy_shape(ctx):
    out = strategy.run(ctx)
    assert set(out) == {"actions", "memory_used", "strategy_source"}
    assert out["strategy_source"] == "fallback"  # no keys in tests
    assert 3 <= len(out["actions"]) <= 5
    for a in out["actions"]:
        assert set(a) == keys(Action)
        assert a["type"] in ACTION_TYPES and a["segment"] in SEGMENT_NAMES and a["status"] == "proposed"


def test_strategy_uses_memory(ctx):
    before = strategy.run(ctx)["actions"]
    memory.record_outcome("Winback coupon", "At risk", "12% redeemed")
    memory.record_outcome("Bundle", "Loyal", "1% uptake")
    out = strategy.run(ctx)
    assert "Winback coupon to At risk: 12% redeemed" in out["memory_used"]
    assert ("bundle", "Loyal") in {(a["type"], a["segment"]) for a in before}
    assert ("bundle", "Loyal") not in {(a["type"], a["segment"]) for a in out["actions"]}
    assert "12%" in out["actions"][0]["why"]


def test_strategy_validator_rejects_bad_actions():
    with pytest.raises(ValueError):
        strategy.validate_actions({"actions": [{"type": "billboard", "segment": "Loyal", "title": "t", "why": "w"}] * 3})
    with pytest.raises(ValueError):
        strategy.validate_actions({"actions": []})


def test_social_shape(ctx):
    ctx.update(strategy.run(ctx))
    posts = social.run(ctx)["social"]
    assert len(posts) == 3
    for p in posts:
        assert set(p) == keys(SocialPost)
        assert p["sound"] in social.SOUND_NAMES
        assert len(p["slides"]) == 5 and all(set(s) == keys(Slide) for s in p["slides"])


def test_social_llm_json_extraction_and_retry(monkeypatch):
    from b_agents import llm_util

    good = {"posts": [{"caption": "c", "sound": social.SOUND_NAMES[0],
                       "slides": [{"headline": "h", "body": "b"}] * 5}] * 3}
    replies = iter(["not json at all", "Here you go:\n```json\n" + __import__("json").dumps(good) + "\n```"])
    monkeypatch.setattr(llm_util, "chat", lambda *a, **k: next(replies))
    posts = llm_util.chat_json("social", [], social.validate_posts, json_mode=False)
    assert len(posts) == 3
