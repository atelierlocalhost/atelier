"""strategy agent. Owned by Person B. Phase 1 stub returning its slice of shared/mock_run.json."""
from shared.contracts import load_mock


def run(ctx: dict) -> dict:
    m = load_mock()
    return {"actions": m["actions"], "memory_used": m["memory_used"]}
