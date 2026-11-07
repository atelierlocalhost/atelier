"""Thin helpers around a_platform.llm for Person B's agents.

All of Person B's agents run on Tinfoil (gpt-oss-120b). insights and strategy go
through llm.chat; the other tasks aren't Tinfoil tasks in a_platform's router, so
they call the shared Tinfoil client directly (same client, model and cost logging).
Logs one line per call: agent, path (tinfoil / fallback), model, latency.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time

ROUTED_TASKS = {"insights", "strategy"}  # Tinfoil tasks in a_platform.llm
DIRECT_TINFOIL_TASKS = {"social", "persona_gen", "shopper", "lab_analyst"}

# Tokens used by direct Tinfoil calls; the lab resets this per run to fill its costs block.
_usage = {"tokens": 0, "calls": 0}
_usage_lock = threading.Lock()


def reset_usage() -> None:
    with _usage_lock:
        _usage.update(tokens=0, calls=0)


def usage() -> dict:
    with _usage_lock:
        return dict(_usage)


class LLMUnavailable(RuntimeError):
    pass


def _tinfoil_model() -> str:
    from a_platform import llm

    # .env sets LLM_MODEL=openai/gpt-oss-120b for Cognee's LiteLLM; Tinfoil itself 404s
    # on the prefixed name, so strip it here until a_platform/llm.py does.
    llm.TINFOIL_MODEL = llm.TINFOIL_MODEL.removeprefix("openai/")
    return llm.TINFOIL_MODEL


def tinfoil_client():
    """The one shared Tinfoil client (a_platform caches it; creating it takes ~10-40s)."""
    from a_platform import llm

    return llm._tinfoil_client()


def _direct_tinfoil(messages: list[dict], json_mode: bool = False, reasoning_effort: str | None = None) -> str:
    from a_platform import llm

    model = _tinfoil_model()
    kwargs = {"model": model, "messages": messages}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if reasoning_effort:
        kwargs["reasoning_effort"] = reasoning_effort
    resp = tinfoil_client().chat.completions.create(**kwargs)
    tokens = getattr(resp.usage, "total_tokens", 0) if resp.usage else 0
    with _usage_lock:
        _usage["tokens"] += tokens
        _usage["calls"] += 1
    llm._log_cost("tinfoil", model, tokens)
    return resp.choices[0].message.content or ""


def log_call(agent: str, path: str, model: str, started: float, note: str = "") -> None:
    print(f"[agent] {agent:<11} path={path:<9} model={model:<14} latency={time.time() - started:6.2f}s"
          + (f"  {note}" if note else ""), flush=True)


def chat(task: str, messages: list[dict], json_mode: bool = False, reasoning_effort: str | None = None,
         label: str | None = None) -> str:
    """`label` only changes the log line (e.g. "shopper p03"); `reasoning_effort` applies to direct tasks."""
    if task not in ROUTED_TASKS | DIRECT_TINFOIL_TASKS:
        raise ValueError(f"unknown task: {task!r}")
    # Fail fast without a key: the Tinfoil client otherwise blocks on attestation retries.
    if not os.getenv("TINFOIL_API_KEY"):
        raise LLMUnavailable("TINFOIL_API_KEY not set")
    from a_platform import llm

    path, model, name = "tinfoil", _tinfoil_model(), label or task
    for attempt in (1, 2):
        started = time.time()
        try:
            if task in DIRECT_TINFOIL_TASKS:
                out = _direct_tinfoil(messages, json_mode, reasoning_effort)
            else:
                out = llm.chat(task, messages, json=json_mode)
        except Exception as e:
            # Tinfoil occasionally drops a request (read timeout / connection error); retry those once.
            transient = any(s in str(e).lower() for s in ("timed out", "timeout", "connection error"))
            log_call(name, path, model, started, f"FAILED: {str(e)[:160]}" + ("; retrying" if transient and attempt == 1 else ""))
            if transient and attempt == 1:
                continue
            raise
        log_call(name, path, model, started, "ok")
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


def chat_json(task: str, messages: list[dict], validate, json_mode: bool = True, **opts):
    """Call the LLM, parse + validate JSON, retry once with the error fed back.

    `opts` (reasoning_effort, label) pass through to chat().
    """
    raw = chat(task, messages, json_mode, **opts)
    try:
        return validate(extract_json(raw))
    except (ValueError, KeyError, TypeError) as e:
        print(f"[agent] {opts.get('label') or task:<11} invalid JSON ({str(e)[:100]}), retrying once", flush=True)
        retry = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": f"That was invalid ({e}). Reply with only the corrected JSON."},
        ]
        return validate(extract_json(chat(task, retry, json_mode, **opts)))


def with_fallback(task: str, llm_fn, fallback_fn, label: str | None = None):
    """Run llm_fn(); on any failure run fallback_fn(). Returns (result, "llm" | "fallback")."""
    try:
        return llm_fn(), "llm"
    except Exception as e:  # noqa: BLE001
        started = time.time()
        result = fallback_fn()
        log_call(label or task, "fallback", "rule-based", started, f"reason: {str(e)[:160]}")
        return result, "fallback"
