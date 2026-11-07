import json

import pytest

from b_agents import lab_fixture, llm_util, persona_gen
from shared.contracts import SEGMENT_NAMES


@pytest.fixture(scope="module")
def segments(fixture_db):
    return lab_fixture.load_segments(fixture_db[0])


def test_fallback_is_20_valid_personas(segments):
    out = persona_gen.run({"segments": segments})  # no key in tests -> fallback
    ps = out["personas"]
    assert out["persona_gen_source"] == "fallback"
    assert len(ps) == 20 and len({p["id"] for p in ps}) == 20
    assert {s: sum(p["segment"] == s for p in ps) for s in SEGMENT_NAMES} == {s: 4 for s in SEGMENT_NAMES}
    assert persona_gen.validate_personas({"personas": ps}) == ps  # fallback passes the same validator


def test_only_aggregates_sent(segments, monkeypatch, fixture_db):
    import sqlite3

    sent = []
    monkeypatch.setattr(llm_util, "chat", lambda task, messages, *a, **k: sent.append(messages) or "{}")
    persona_gen.run({"segments": segments})
    payload = json.dumps(sent)
    with sqlite3.connect(fixture_db[0]) as conn:
        names_emails = [v for row in conn.execute("SELECT name, email FROM customers") for v in row]
    assert sent and not any(v in payload for v in names_emails)
    assert "@" not in payload


@pytest.mark.parametrize("bad", [
    {"name": "Maya Patel"}, {"name": "maya@example.com"}, {"age_band": "thirties"},
    {"price_sensitivity": "extreme"}, {"segment": "VIP"}, {"budget_usd": -5},
])
def test_validator_rejects(bad):
    ps = [{k: v for k, v in p.items() if k != "id"} for p in persona_gen.fallback_personas()]
    ps[0] = {**ps[0], **bad}
    with pytest.raises((ValueError, KeyError, TypeError)):
        persona_gen.validate_personas({"personas": ps})
