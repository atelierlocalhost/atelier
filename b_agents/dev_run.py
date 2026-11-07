"""Run Person B's agents end to end without the API, and show memory changing the plan.

    python -m b_agents.dev_run            # uses atelier.db if seeded, else a fixture DB
    python -m b_agents.dev_run --fixture  # always use the fixture DB

Writes b_agents/.dev/run1.json and run2.json and prints a diff of the actions.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from a_platform.agents import competitor  # noqa: E402
from b_agents import insights, memory, social, strategy  # noqa: E402
from b_agents.fixture import make_fixture  # noqa: E402
from shared.contracts import load_mock  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEV = Path(__file__).resolve().parent / ".dev"
FAKE_OUTCOMES = [
    ("Winback coupon", "At risk", "12% redeemed"),
    ("Bundle", "Loyal", "1% uptake"),
]


def pick_db(force_fixture: bool) -> str:
    seeded = ROOT / "atelier.db"
    if not force_fixture and seeded.exists():
        try:
            with sqlite3.connect(seeded) as conn:
                if conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0] > 0:
                    return str(seeded)
        except sqlite3.Error:
            pass
    path = DEV / "fixture.db"
    make_fixture(path)
    return str(path)


def run_pipeline(run_id: str, db_path: str, next_action_id: int = 1) -> dict:
    ctx: dict = {"run_id": run_id, "db_path": db_path, "next_action_id": next_action_id}
    for agent in (insights, competitor, strategy, social):
        ctx.update(agent.run(ctx))
    return {
        "run_id": run_id,
        "insights": ctx["insights"],
        "competitors": ctx.get("competitors", []),
        "actions": ctx["actions"],
        "memory_used": ctx["memory_used"],
        "social": ctx["social"],
        "costs": load_mock()["costs"],  # A computes real costs in the orchestrator
        # dev-only, outside the contract: which path each agent took
        "sources": {k: ctx.get(f"{k}_source") for k in ("insights", "strategy", "social")},
    }


def show_actions(label: str, run: dict) -> None:
    print(f"\n{label}  sources={run['sources']}  memory_used={run['memory_used']}")
    for a in run["actions"]:
        print(f"  #{a['id']} {a['type']:<17} {a['segment']:<12} {a['title']}")
        print(f"      why: {a['why']}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", action="store_true", help="always use the generated fixture DB")
    args = ap.parse_args()

    DEV.mkdir(exist_ok=True)
    db_path = pick_db(args.fixture)
    print(f"db: {db_path}  memory_backend={os.getenv('MEMORY_BACKEND', 'auto')}")
    memory.reset()
    memory.seed_brand()

    run1 = run_pipeline("r_001", db_path)
    print(json.dumps(run1, indent=2))
    (DEV / "run1.json").write_text(json.dumps(run1, indent=2))

    print("\nrecording outcomes:")
    for action, segment, result in FAKE_OUTCOMES:
        memory.record_outcome(action, segment, result)
        print(f"  {action} to {segment}: {result}")

    run2 = run_pipeline("r_002", db_path, next_action_id=len(run1["actions"]) + 1)
    (DEV / "run2.json").write_text(json.dumps(run2, indent=2))

    print("\n===== actions diff (run 1 -> run 2) =====")
    show_actions("RUN 1", run1)
    show_actions("RUN 2", run2)
    before = {(a["type"], a["segment"]) for a in run1["actions"]}
    after = {(a["type"], a["segment"]) for a in run2["actions"]}
    print("\n  dropped:", sorted(before - after) or "none")
    print("  added:  ", sorted(after - before) or "none")
    print(f"\nsaved {DEV / 'run1.json'} and {DEV / 'run2.json'}")


if __name__ == "__main__":
    main()
