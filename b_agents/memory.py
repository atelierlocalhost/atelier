"""Shared agent memory (Cognee). Owned by Person B. Phase 1 stub."""
from __future__ import annotations

DATASETS = ("brand", "customers", "competitors", "outcomes")


def read(agent: str, dataset: str, query: str) -> list[str]:
    return []


def write(agent: str, dataset: str, record: dict) -> None:
    return None
