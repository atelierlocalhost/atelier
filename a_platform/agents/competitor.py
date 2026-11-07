"""Competitor agent: scrapes competitor promos (Darkbloom). Owned by Person A. Stub."""
from shared.contracts import load_mock


def run(ctx: dict) -> dict:
    return {"competitors": load_mock()["competitors"]}
