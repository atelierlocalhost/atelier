import pytest

from b_agents import memory


def test_social_cannot_read_customers():
    with pytest.raises(PermissionError):
        memory.read("social", "customers", "anything")


@pytest.mark.parametrize("agent,dataset,mode", [
    ("social", "outcomes", "write"),
    ("competitor", "outcomes", "write"),
    ("competitor", "customers", "read"),
    ("insights", "brand", "write"),
    ("strategy", "competitors", "write"),
    ("unknown_agent", "brand", "read"),
])
def test_denied(agent, dataset, mode):
    with pytest.raises(PermissionError):
        if mode == "read":
            memory.read(agent, dataset, "q")
        else:
            memory.write(agent, dataset, {"text": "x"})


def test_allowed_and_round_trip():
    memory.write("insights", "customers", {"text": "16 At risk customers"})
    memory.write("competitor", "competitors", {"text": "Maison Verte 20% off linen"})
    assert memory.read("strategy", "customers", "at risk") == ["16 At risk customers"]
    assert memory.read("social", "brand", "voice")[0].startswith("Brand voice")


def test_record_outcome_readable_by_strategy_and_social():
    memory.record_outcome("Win-back email", "At risk", "12% redeemed")
    assert "Win-back email to At risk: 12% redeemed" in memory.read("strategy", "outcomes", "what worked")
    assert "Win-back email to At risk: 12% redeemed" in memory.read("social", "outcomes", "what worked")


def test_unknown_dataset():
    with pytest.raises(ValueError):
        memory.read("system", "nope", "q")
