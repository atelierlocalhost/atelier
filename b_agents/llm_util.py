"""Thin helpers around a_platform.llm for Person B's agents."""
from __future__ import annotations

import json
import os
import re

PROVIDER_KEY = {"insights": "TINFOIL_API_KEY", "strategy": "TINFOIL_API_KEY", "social": "DARKBLOOM_API_KEY"}


class LLMUnavailable(RuntimeError):
    pass


def chat(task: str, messages: list[dict], json_mode: bool = False) -> str:
    # Fail fast without a key: the Tinfoil client otherwise blocks on attestation retries.
    key = PROVIDER_KEY.get(task)
    if key and not os.getenv(key):
        raise LLMUnavailable(f"{key} not set")
    from a_platform import llm

    return llm.chat(task, messages, json=json_mode)


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
        retry = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": f"That was invalid ({e}). Reply with only the corrected JSON."},
        ]
        return validate(extract_json(chat(task, retry, json_mode)))
