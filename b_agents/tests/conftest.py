import pytest

from b_agents.fixture import make_fixture


@pytest.fixture(autouse=True)
def isolated_memory(tmp_path, monkeypatch):
    """Every test gets its own SQLite memory and no LLM keys (rule-based fallbacks)."""
    from b_agents import memory

    monkeypatch.setenv("MEMORY_BACKEND", "sqlite")
    monkeypatch.delenv("TINFOIL_API_KEY", raising=False)
    monkeypatch.setattr(memory, "FALLBACK_DB", str(tmp_path / "memory.db"))
    memory.seed_brand()


@pytest.fixture(scope="session")
def fixture_db(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "fixture.db"
    labels = make_fixture(path)
    return str(path), labels
