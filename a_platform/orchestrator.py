"""Runs the agents in order and assembles the run JSON. Owned by Person A."""
from __future__ import annotations

from a_platform import llm
from a_platform.agents import competitor
from a_platform.db import DB_PATH
from b_agents import insights, social, strategy
from shared.contracts import RunResult, load_mock

PIPELINE = [insights, competitor, strategy, social]


def run(run_id: str, db_path: str = DB_PATH) -> RunResult:
    llm.current_run_id = run_id
    llm.db_path = db_path
    ctx: dict = {"run_id": run_id, "db_path": db_path}
    for agent in PIPELINE:
        ctx.update(agent.run(ctx))
    return {
        "run_id": run_id,
        "insights": ctx["insights"],
        "competitors": ctx.get("competitors", []),
        "actions": ctx.get("actions", []),
        "memory_used": ctx.get("memory_used", []),
        "social": ctx.get("social", []),
        "costs": load_mock()["costs"],  # TODO(A): sum from costs table
    }


if __name__ == "__main__":
    import json

    print(json.dumps(run("r_dev"), indent=2))
