"""Thin helpers around a_platform.llm for Person B's agents.

Logs one line per call: agent, path (tinfoil / darkbloom / fallback), model, latency.
"""
from __future__ import annotations

import json
import os
import re
import time

PROVIDER_KEY = {"insights": "TINFOIL_API_KEY", "strategy": "TINFOIL_API_KEY", "social": "DARKBLOOM_API_KEY"}


class LLMUnavailable(RuntimeError):
    pass


def _path_and_model(task: str) -> tuple[str, str]:
    from a_platform import llm

    # .env sets LLM_MODEL=openai/gpt-oss-120b for Cognee's LiteLLM; Tinfoil itself 404s
    # on the prefixed name, so strip it here until a_platform/llm.py does.
    llm.TINFOIL_MODEL = llm.TINFOIL_MODEL.removeprefix("openai/")
    if task in llm.TINFOIL_TASKS:
        return "tinfoil", llm.TINFOIL_MODEL
    return "darkbloom", os.getenv("DARKBLOOM_MODEL", "")


def log_call(agent: str, path: str, model: str, started: float, note: str = "") -> None:
    print(f"[agent] {agent:<8} path={path:<9} model={model:<28} latency={time.time() - started:6.2f}s"
          + (f"  {note}" if note else ""), flush=True)


def chat(task: str, messages: list[dict], json_mode: bool = False) -> str:
    # Fail fast without a key: the Tinfoil client otherwise blocks on attestation retries.
    key = PROVIDER_KEY.get(task)
    if key and not os.getenv(key):
        raise LLMUnavailable(f"{key} not set")
    from a_platform import llm

    path, model = _path_and_model(task)
    started = time.time()
    try:
        out = llm.chat(task, messages, json=json_mode)
    except Exception as e:
        log_call(task, path, model, started, f"FAILED: {str(e)[:160]}")
        raise
    log_call(task, path, model, started, "ok")
    return out


def extract_json(text: str):
    """Parse the first JSON object (or array) in `text`, tolerating prose and ``` fences."""
    text = re.sub(r"```(?:json)?", "", text)
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch in "{[":
            try:
                return decoder.raw_decode(text[i:])[0]
            except json.JSONDecodeError:
                continue
    raise ValueError("no JSON found in LLM output")


def chat_json(task: str, messages: list[dict], validate, json_mode: bool = True):
    """Call the LLM, parse + validate JSON, retry once with the error fed back."""
    raw = chat(task, messages, json_mode)
    try:
        return validate(extract_json(raw))
    except (ValueError, KeyError, TypeError) as e:
        print(f"[agent] {task:<8} invalid JSON ({str(e)[:100]}), retrying once", flush=True)
        retry = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": f"That was invalid ({e}). Reply with only the corrected JSON."},
        ]
        return validate(extract_json(chat(task, retry, json_mode)))


def with_fallback(task: str, llm_fn, fallback_fn):
    """Run llm_fn(); on any failure run fallback_fn(). Returns (result, "llm" | "fallback")."""
    try:
        return llm_fn(), "llm"
    except Exception as e:  # noqa: BLE001
        started = time.time()
        result = fallback_fn()
        log_call(task, "fallback", "rule-based", started, f"reason: {str(e)[:160]}")
        return result, "fallback"
