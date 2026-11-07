"""Frozen contract shared by all three folders. Tell the team before editing.

Every agent module exposes:

    def run(ctx: dict) -> dict

`ctx` is a plain dict the orchestrator builds up as agents run. It always has
"run_id" and "db_path"; after each agent runs, the orchestrator merges the
agent's returned slice into ctx, so later agents can read earlier output
(e.g. strategy reads ctx["insights"] and ctx.get("competitors", [])).

Each agent returns only its slice of RunResult:
    insights   -> {"insights": Insights}
    competitor -> {"competitors": list[Competitor]}
    strategy   -> {"actions": list[Action], "memory_used": list[str]}
    social     -> {"social": list[SocialPost]}
    storefront, orders -> {} (side effects only; not part of the run JSON)

Orchestrator run order: insights, competitor, strategy, social.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Literal, TypedDict

SHARED_DIR = Path(__file__).parent

ActionType = Literal["coupon", "bundle", "winback_email", "acquisition_post"]
ActionStatus = Literal["proposed", "approved", "applied"]
SegmentName = Literal["Champions", "Loyal", "New", "At risk", "Hibernating"]

ACTION_TYPES = ("coupon", "bundle", "winback_email", "acquisition_post")
ACTION_STATUSES = ("proposed", "approved", "applied")
SEGMENT_NAMES = ("Champions", "Loyal", "New", "At risk", "Hibernating")
MEMORY_DATASETS = ("brand", "customers", "competitors", "outcomes")


class Segment(TypedDict):
    name: str
    count: int
    avg_spend: float


class Insights(TypedDict):
    segments: list[Segment]
    working: list[str]
    fix: list[str]


class Competitor(TypedDict):
    name: str
    url: str
    promos: list[str]
    price_gap_pct: float


class Action(TypedDict):
    id: int
    type: ActionType
    segment: str
    title: str
    why: str
    status: ActionStatus


class Slide(TypedDict):
    headline: str
    body: str


class SocialPost(TypedDict):
    caption: str
    sound: str
    slides: list[Slide]


class Costs(TypedDict):
    sie_usd: float
    tinfoil_usd: float
    darkbloom_usd: float
    frontier_equiv_usd: float


class RunResult(TypedDict):
    run_id: str
    insights: Insights
    competitors: list[Competitor]
    actions: list[Action]
    memory_used: list[str]
    social: list[SocialPost]
    costs: Costs


AgentFn = Callable[[dict], dict]


def load_mock(n: int = 1) -> RunResult:
    """Load shared/mock_run.json (n=1) or shared/mock_run_2.json (n=2)."""
    name = "mock_run.json" if n == 1 else f"mock_run_{n}.json"
    return json.loads((SHARED_DIR / name).read_text())
