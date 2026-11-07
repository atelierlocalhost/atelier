"""LLM router. Owned by Person A.

    chat(task, messages, json=False) -> str

Routing rule: anything touching customer data goes to Tinfoil (private
inference in an enclave). Creative copy with no PII goes to Darkbloom.
"""
from __future__ import annotations

import os
import sqlite3

TINFOIL_TASKS = {"insights", "strategy", "orders"}
DARKBLOOM_TASKS = {"social", "competitor"}

TINFOIL_MODEL = os.getenv("LLM_MODEL", "gpt-oss-120b")
DARKBLOOM_BASE_URL = "https://api.darkbloom.dev/v1"

# Rough $ per 1M tokens, for the cost panel only.
USD_PER_M_TOKENS = {"tinfoil": 0.60, "darkbloom": 0.30, "frontier": 10.0}

# The orchestrator sets these before a run so costs land on the right row.
current_run_id: str | None = None
db_path: str | None = os.getenv("ATELIER_DB_PATH")

_clients: dict = {}


def _tinfoil_client():
    if "tinfoil" not in _clients:
        from tinfoil import TinfoilAI

        _clients["tinfoil"] = TinfoilAI(api_key=os.getenv("TINFOIL_API_KEY"))
    return _clients["tinfoil"]


def _darkbloom_client():
    if "darkbloom" not in _clients:
        from openai import OpenAI

        _clients["darkbloom"] = OpenAI(
            api_key=os.getenv("DARKBLOOM_API_KEY"), base_url=DARKBLOOM_BASE_URL
        )
    return _clients["darkbloom"]


def _route(task: str):
    if task in TINFOIL_TASKS:
        return "tinfoil", _tinfoil_client(), TINFOIL_MODEL
    if task in DARKBLOOM_TASKS:
        return "darkbloom", _darkbloom_client(), os.getenv("DARKBLOOM_MODEL", "")
    raise ValueError(f"unknown llm task: {task!r}")


def _log_cost(provider: str, model: str, tokens: int) -> None:
    usd = tokens / 1_000_000 * USD_PER_M_TOKENS.get(provider, 0.0)
    if db_path and os.path.exists(db_path):
        try:
            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "INSERT INTO costs (run_id, provider, model, tokens, usd) VALUES (?, ?, ?, ?, ?)",
                    (current_run_id, provider, model, tokens, usd),
                )
            return
        except sqlite3.Error:
            pass
    print(f"[llm] run={current_run_id} provider={provider} model={model} tokens={tokens} usd={usd:.5f}")


def chat(task: str, messages: list[dict], json: bool = False) -> str:
    provider, client, model = _route(task)
    kwargs = {"model": model, "messages": messages}
    # Darkbloom may not support response_format; callers ask for JSON in the prompt.
    if json and provider == "tinfoil":
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.completions.create(**kwargs)
    tokens = getattr(resp.usage, "total_tokens", 0) if resp.usage else 0
    _log_cost(provider, model, tokens)
    return resp.choices[0].message.content or ""
