"""Shared agent memory. Owned by Person B.

    read(agent, dataset, query) -> list[str]
    write(agent, dataset, record) -> None
    record_outcome(action, segment, result) -> None

Backed by Cognee (one Cognee dataset per memory dataset), with Cognee's LLM and
embeddings pointed at Tinfoil so memory content never leaves the enclave.
Every write is mirrored to a small SQLite store; reads fall back to it whenever
Cognee is unavailable or errors, so agents are never blocked.

MEMORY_BACKEND=cognee | sqlite | auto (default: cognee if TINFOIL_API_KEY is set
and cognee imports, else sqlite).
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sqlite3
import threading
import time
from pathlib import Path

DATASETS = ("brand", "customers", "competitors", "outcomes")

PERMISSIONS: dict[str, dict[str, set[str]]] = {
    "insights": {"read": {"customers", "outcomes", "brand"}, "write": {"customers", "outcomes"}},
    "strategy": {"read": {"customers", "outcomes", "brand"}, "write": {"customers", "outcomes"}},
    "social": {"read": {"brand", "outcomes"}, "write": set()},
    "competitor": {"read": set(), "write": {"competitors"}},
    # The platform itself: seeds brand voice and records action outcomes.
    "system": {"read": set(DATASETS), "write": set(DATASETS)},
}

BRAND_VOICE = (
    "Brand voice for Atelier Juniper, a small neighborhood clothing boutique: warm, unhurried "
    "and a little witty. We talk like a friend who works in the shop, never like a sales banner. "
    "Short sentences, sensory words (soft, washed, sun-faded), no ALL CAPS, at most one emoji. "
    "We favor natural fabrics, small-batch makers and pieces that last; we never shame or pressure, "
    "and discounts are framed as a thank-you, not a fire sale."
)

ROOT = Path(__file__).resolve().parent.parent
FALLBACK_DB = os.getenv("ATELIER_MEMORY_DB", str(Path(__file__).resolve().parent / ".dev" / "memory.db"))
COGNEE_PREFIX = "atelier_"


def _check(agent: str, dataset: str, mode: str) -> None:
    if dataset not in DATASETS:
        raise ValueError(f"unknown memory dataset: {dataset!r}")
    if dataset not in PERMISSIONS.get(agent, {}).get(mode, set()):
        raise PermissionError(f"agent {agent!r} may not {mode} memory dataset {dataset!r}")


def _to_text(record: dict) -> str:
    if "text" in record:
        return str(record["text"])
    return "; ".join(f"{k}: {v}" for k, v in record.items())


# ---------- SQLite store (always written; read fallback) ----------

def _db() -> sqlite3.Connection:
    Path(FALLBACK_DB).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(FALLBACK_DB)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS memory (id INTEGER PRIMARY KEY, dataset TEXT, agent TEXT, "
        "text TEXT, record_json TEXT, created_at REAL)"
    )
    return conn


def _words(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9%]+", s.lower()))


def _sqlite_write(agent: str, dataset: str, record: dict) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT INTO memory (dataset, agent, text, record_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (dataset, agent, _to_text(record), json.dumps(record), time.time()),
        )


def _sqlite_read(dataset: str, query: str, k: int = 5) -> list[str]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT text FROM memory WHERE dataset = ? ORDER BY created_at DESC, id DESC", (dataset,)
        ).fetchall()
    q = _words(query)
    # Rank by word overlap with the query, most recent first on ties.
    ranked = sorted(enumerate(rows), key=lambda ir: (-len(q & _words(ir[1][0])), ir[0]))
    return [row[0] for _, row in ranked[:k]]


# ---------- Cognee ----------

def _configure_cognee_env() -> None:
    """Point Cognee's LLM + embeddings at Tinfoil (OpenAI-compatible). Must run before import."""
    key = os.getenv("TINFOIL_API_KEY") or os.getenv("LLM_API_KEY", "")
    defaults = {
        "LLM_PROVIDER": "custom",
        "LLM_MODEL": "openai/" + os.getenv("LLM_MODEL", "gpt-oss-120b").removeprefix("openai/"),
        "LLM_ENDPOINT": os.getenv("LLM_ENDPOINT", "https://inference.tinfoil.sh/v1"),
        "LLM_API_KEY": key,
        "EMBEDDING_PROVIDER": "custom",
        "EMBEDDING_MODEL": "openai/" + os.getenv("EMBEDDING_MODEL", "nomic-embed-text").removeprefix("openai/"),
        "EMBEDDING_ENDPOINT": os.getenv("EMBEDDING_ENDPOINT", "https://inference.tinfoil.sh/v1"),
        "EMBEDDING_API_KEY": key,
        "EMBEDDING_DIMENSIONS": "768",
        "ENABLE_BACKEND_ACCESS_CONTROL": "False",  # our permission map is enforced here instead
        "CACHING": "false",  # Cognee 1.x session memory; not needed, avoids an extra cache service
        "TELEMETRY_DISABLED": "1",
        "SYSTEM_ROOT_DIRECTORY": str(ROOT / ".cognee_system"),
        "DATA_ROOT_DIRECTORY": str(ROOT / ".cognee_data"),
    }
    # LLM_MODEL / EMBEDDING_MODEL / *_ENDPOINT are shared with .env, so always set the prefixed form.
    for k, v in defaults.items():
        if k in ("LLM_MODEL", "EMBEDDING_MODEL", "LLM_API_KEY", "EMBEDDING_API_KEY") or k not in os.environ:
            os.environ[k] = v


_cognee = None
_cognee_failed = False
_dirty: set[str] = set()


def _use_cognee() -> bool:
    backend = os.getenv("MEMORY_BACKEND", "auto")
    if backend == "sqlite" or _cognee_failed:
        return False
    return backend == "cognee" or bool(os.getenv("TINFOIL_API_KEY"))


def _get_cognee():
    global _cognee, _cognee_failed
    if _cognee is None:
        try:
            _configure_cognee_env()
            import cognee

            _cognee = cognee
        except Exception as e:  # noqa: BLE001
            _cognee_failed = True
            print(f"[memory] cognee unavailable, using sqlite: {e}")
    return _cognee


def _run(coro):
    """Run a coroutine from sync code, even if an event loop is already running."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    out: dict = {}
    t = threading.Thread(target=lambda: out.update(v=asyncio.run(coro)))
    t.start()
    t.join()
    return out.get("v")


def _result_to_text(r) -> str:
    if isinstance(r, str):
        return r
    if isinstance(r, dict):
        for key in ("text", "search_result", "content", "name"):
            if key in r:
                return _result_to_text(r[key])
        return json.dumps(r, default=str)
    if isinstance(r, list):
        return " ".join(_result_to_text(x) for x in r)
    return str(getattr(r, "text", None) or getattr(r, "search_result", None) or r)


def _cognee_write(dataset: str, text: str) -> None:
    cognee = _get_cognee()
    if cognee is None:
        return
    _run(cognee.add(text, dataset_name=COGNEE_PREFIX + dataset))
    _dirty.add(dataset)


def _cognee_read(dataset: str, query: str, k: int = 5) -> list[str]:
    cognee = _get_cognee()
    if cognee is None:
        raise RuntimeError("cognee unavailable")
    from cognee import SearchType

    name = COGNEE_PREFIX + dataset
    if dataset in _dirty:
        _run(cognee.cognify(datasets=[name]))
        _dirty.discard(dataset)
    results = _run(cognee.search(query_text=query, query_type=SearchType.CHUNKS, datasets=[name], top_k=k))
    return [t for t in (_result_to_text(r).strip() for r in results or []) if t][:k]


# ---------- public API ----------

def read(agent: str, dataset: str, query: str) -> list[str]:
    _check(agent, dataset, "read")
    if _use_cognee():
        try:
            hits = _cognee_read(dataset, query)
            if hits:
                return hits
        except Exception as e:  # noqa: BLE001
            print(f"[memory] cognee read failed, using sqlite: {e}")
    return _sqlite_read(dataset, query)


def write(agent: str, dataset: str, record: dict) -> None:
    _check(agent, dataset, "write")
    _sqlite_write(agent, dataset, record)
    if _use_cognee():
        try:
            _cognee_write(dataset, _to_text(record))
        except Exception as e:  # noqa: BLE001
            print(f"[memory] cognee write failed (kept in sqlite): {e}")


def record_outcome(action: str, segment: str, result: str) -> None:
    """e.g. record_outcome("Win-back email", "At risk", "12% redeemed")."""
    write("system", "outcomes", {
        "text": f"{action} to {segment}: {result}",
        "action": action, "segment": segment, "result": result,
    })


def seed_brand() -> None:
    """Idempotent: writes the brand voice once."""
    with _db() as conn:
        exists = conn.execute("SELECT 1 FROM memory WHERE dataset = 'brand' LIMIT 1").fetchone()
    if not exists:
        write("system", "brand", {"text": BRAND_VOICE})


def reset() -> None:
    """Wipe the SQLite mirror (and Cognee data if enabled). Used by dev_run and tests."""
    with _db() as conn:
        conn.execute("DELETE FROM memory")
    _dirty.clear()
    if _use_cognee() and (cognee := _get_cognee()) is not None:
        try:
            _run(cognee.prune.prune_data())
            _run(cognee.prune.prune_system(metadata=True))
        except Exception as e:  # noqa: BLE001
            print(f"[memory] cognee prune failed: {e}")
