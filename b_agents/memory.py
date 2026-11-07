"""Shared agent memory. Owned by Person B.

    read(agent, dataset, query, k=5) -> list[str]
    write(agent, dataset, record) -> None
    write_many(agent, [(dataset, record), ...]) -> None     # one Cognee batch
    read_records(agent, dataset, limit=None) -> list[dict]  # SQLite mirror only, newest first
    record_outcome(action, segment, result) -> None
    record_observed(variant_id, observed, source, segment=None) -> dict   # Shopper Lab calibration
    calibration_summary() -> {"mean_abs_error_pct", "n_observed"}

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

DATASETS = ("brand", "customers", "competitors", "outcomes", "lab_outcomes", "calibration")
PERSONA = "persona:*"  # per-persona datasets: persona:<id>

PERMISSIONS: dict[str, dict[str, set[str]]] = {
    "insights": {"read": {"customers", "outcomes", "brand"}, "write": {"customers", "outcomes"}},
    "strategy": {"read": {"customers", "outcomes", "brand", "lab_outcomes", "calibration"},
                 "write": {"customers", "outcomes"}},
    "social": {"read": {"brand", "outcomes", "lab_outcomes"}, "write": set()},
    "competitor": {"read": set(), "write": {"competitors"}},
    # Shopper Lab. Synthetic shoppers never see customers.
    "persona_gen": {"read": {"customers"}, "write": set()},
    "shopper": {"read": {"lab_outcomes", "brand", PERSONA}, "write": set()},
    "lab_analyst": {"read": {"calibration"}, "write": {"lab_outcomes", "calibration", PERSONA}},
    # The platform itself: seeds brand voice and records action outcomes.
    "system": {"read": set(DATASETS) | {PERSONA}, "write": set(DATASETS) | {PERSONA}},
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


def _is_persona(dataset: str) -> bool:
    return bool(re.fullmatch(r"persona:[A-Za-z0-9_\-]+", dataset))


def _check(agent: str, dataset: str, mode: str) -> None:
    if dataset not in DATASETS and not _is_persona(dataset):
        raise ValueError(f"unknown memory dataset: {dataset!r}")
    allowed = PERMISSIONS.get(agent, {}).get(mode, set())
    if dataset not in allowed and not (_is_persona(dataset) and PERSONA in allowed):
        raise PermissionError(f"agent {agent!r} may not {mode} memory dataset {dataset!r}")


def _cognee_name(dataset: str) -> str:
    return COGNEE_PREFIX + dataset.replace(":", "_")


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


def _norm(s: str) -> str:
    return " ".join(s.split()).lower()


def _sqlite_count(dataset: str) -> int:
    with _db() as conn:
        return conn.execute("SELECT COUNT(*) FROM memory WHERE dataset = ?", (dataset,)).fetchone()[0]


def _sqlite_texts(dataset: str) -> list[str]:
    with _db() as conn:
        return [r[0] for r in conn.execute("SELECT text FROM memory WHERE dataset = ?", (dataset,))]


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
        # LiteLLM-routed providers ("custom", "openai") send `dimensions`, which LiteLLM rejects
        # for openai/* models; openai_compatible calls Tinfoil directly with the bare model id.
        "EMBEDDING_PROVIDER": "openai_compatible",
        "EMBEDDING_MODEL": os.getenv("EMBEDDING_MODEL", "nomic-embed-text").removeprefix("openai/"),
        "EMBEDDING_ENDPOINT": os.getenv("EMBEDDING_ENDPOINT", "https://inference.tinfoil.sh/v1"),
        "EMBEDDING_API_KEY": key,
        "EMBEDDING_DIMENSIONS": "768",
        # Per-dataset isolated stores; without it chunk search leaks across datasets.
        "ENABLE_BACKEND_ACCESS_CONTROL": "True",
        "CACHING": "false",  # Cognee 1.x session memory; not needed, avoids an extra cache service
        "TELEMETRY_DISABLED": "1",
        "SYSTEM_ROOT_DIRECTORY": str(ROOT / ".cognee_system"),
        "DATA_ROOT_DIRECTORY": str(ROOT / ".cognee_data"),
    }
    # Values the memory design depends on always win over .env; the rest are just defaults.
    forced = ("LLM_MODEL", "LLM_API_KEY", "EMBEDDING_PROVIDER", "EMBEDDING_MODEL", "EMBEDDING_API_KEY",
              "ENABLE_BACKEND_ACCESS_CONTROL")
    for k, v in defaults.items():
        if k in forced or k not in os.environ:
            os.environ[k] = v
    # Cognee re-loads the project .env with override=True at import, which would undo the
    # above. Point it at an empty file so the process env we just built is what it uses.
    empty = ROOT / ".cognee_system" / "empty.env"
    empty.parent.mkdir(parents=True, exist_ok=True)
    empty.touch()
    os.environ["COGNEE_ENV_FILE"] = str(empty)


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


_loop: asyncio.AbstractEventLoop | None = None
_loop_lock = threading.Lock()


def _run(coro):
    """Run a coroutine from sync code on ONE long-lived background event loop.

    Cognee caches async clients bound to the loop they were created on, so a fresh
    asyncio.run() per call breaks later calls ("Event loop is closed"). Safe to call
    from any thread, including from inside another running loop.
    """
    global _loop
    with _loop_lock:
        if _loop is None:
            _loop = asyncio.new_event_loop()
            threading.Thread(target=_loop.run_forever, name="memory-loop", daemon=True).start()
    return asyncio.run_coroutine_threadsafe(coro, _loop).result()


def _flatten(results) -> list:
    """With access control on, Cognee wraps hits per dataset: {"dataset_name", "search_result": [...]}."""
    out = []
    for r in results:
        inner = r.get("search_result") if isinstance(r, dict) else getattr(r, "search_result", None)
        out.extend(_flatten(inner) if isinstance(inner, list) else [r])
    return out


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


def _cognee_write_many(pairs: list[tuple[str, str]]) -> None:
    """Add (dataset, text) pairs in one event loop, one cognee.add per dataset."""
    cognee = _get_cognee()
    if cognee is None:
        return
    grouped: dict[str, list[str]] = {}
    for dataset, text in pairs:
        grouped.setdefault(dataset, []).append(text)

    async def add_all():
        for dataset, texts in grouped.items():
            await cognee.add(texts if len(texts) > 1 else texts[0], dataset_name=_cognee_name(dataset))

    _run(add_all())
    _dirty.update(grouped)


def _cognee_read(dataset: str, query: str, k: int = 5) -> list[str]:
    cognee = _get_cognee()
    if cognee is None:
        raise RuntimeError("cognee unavailable")
    from cognee import SearchType

    name = _cognee_name(dataset)
    if dataset in _dirty:
        _run(cognee.cognify(datasets=[name]))
        _dirty.discard(dataset)
    results = _run(cognee.search(query_text=query, query_type=SearchType.CHUNKS, datasets=[name], top_k=k * 3))
    # Cognee's chunk search can return chunks from other datasets, so keep only hits that
    # are records of this dataset. This is what guarantees e.g. social never sees customers.
    own = {_norm(t): t for t in _sqlite_texts(dataset)}
    hits = []
    for chunk in _flatten(results or []):
        text = own.get(_norm(_result_to_text(chunk)))
        if text and text not in hits:
            hits.append(text)
    return hits[:k]


# ---------- public API ----------

def read(agent: str, dataset: str, query: str, k: int = 5) -> list[str]:
    _check(agent, dataset, "read")
    started = time.time()
    if not _sqlite_count(dataset):  # every write lands in the mirror, so nothing to search
        print(f"[memory] {agent:<8} read {dataset:<9} empty", flush=True)
        return []
    if _use_cognee():
        try:
            hits = _cognee_read(dataset, query, k)
            if hits:
                print(f"[memory] {agent:<8} read {dataset:<9} via cognee  hits={len(hits)} latency={time.time() - started:.2f}s", flush=True)
                return hits
            print(f"[memory] {agent:<8} read {dataset:<9} cognee returned nothing, using sqlite", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[memory] {agent:<8} read {dataset:<9} cognee FAILED, using sqlite: {str(e)[:200]}", flush=True)
    hits = _sqlite_read(dataset, query, k)
    print(f"[memory] {agent:<8} read {dataset:<9} via sqlite  hits={len(hits)}", flush=True)
    return hits


def read_records(agent: str, dataset: str, limit: int | None = None) -> list[dict]:
    """Structured records from the SQLite mirror, newest first. No Cognee round trip."""
    _check(agent, dataset, "read")
    sql = "SELECT record_json FROM memory WHERE dataset = ? ORDER BY created_at DESC, id DESC"
    with _db() as conn:
        rows = conn.execute(sql + (" LIMIT ?" if limit else ""), (dataset, limit) if limit else (dataset,)).fetchall()
    return [json.loads(r[0]) for r in rows]


def write(agent: str, dataset: str, record: dict) -> None:
    write_many(agent, [(dataset, record)])


def write_many(agent: str, items: list[tuple[str, dict]]) -> None:
    """Write several records (any datasets the agent may write) with one Cognee batch."""
    for dataset, _ in items:
        _check(agent, dataset, "write")
    for dataset, record in items:
        _sqlite_write(agent, dataset, record)
    if _use_cognee() and items:
        started = time.time()
        try:
            _cognee_write_many([(d, _to_text(r)) for d, r in items])
            if len(items) > 1:
                print(f"[memory] {agent:<8} wrote {len(items)} records to cognee in {time.time() - started:.1f}s",
                      flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[memory] {agent:<8} write cognee FAILED (kept in sqlite): {str(e)[:200]}", flush=True)


def record_outcome(action: str, segment: str, result: str) -> None:
    """e.g. record_outcome("Win-back email", "At risk", "12% redeemed")."""
    write("system", "outcomes", {
        "text": f"{action} to {segment}: {result}",
        "action": action, "segment": segment, "result": result,
    })


def record_observed(variant_id: int, observed: float, source: str, segment: str | None = None) -> dict:
    """Compare a real observed score (same 0-1 scale as the lab score) to the last lab prediction.

    Writes the comparison to calibration and a lesson to lab_outcomes, e.g.
    "lab overrates lifestyle for At risk by 21%". Returns the calibration record.
    """
    pred = next((r for r in read_records("lab_analyst", "calibration")
                 if r.get("type") == "prediction" and r.get("variant_id") == variant_id), None)
    if pred is None:
        raise ValueError(f"no lab prediction recorded for variant {variant_id}")
    if observed <= 0:
        raise ValueError("observed must be > 0")
    predicted = pred["by_segment"][segment] if segment else pred["score"]
    error_pct = (predicted - observed) / observed * 100
    lesson = (f"lab {'overrates' if error_pct > 0 else 'underrates'} {pred['style']} "
              f"for {segment or 'all shoppers'} by {abs(error_pct):.0f}%")
    rec = {"type": "observed", "text": f"{lesson} (observed {observed:.3f} via {source}, predicted {predicted:.3f})",
           "variant_id": variant_id, "segment": segment, "style": pred["style"], "lab_run_id": pred["lab_run_id"],
           "predicted": round(predicted, 4), "observed": round(observed, 4), "error_pct": round(error_pct, 1),
           "source": source}
    write_many("lab_analyst", [("calibration", rec), ("lab_outcomes", {"text": lesson, "type": "calibration"})])
    return rec


def calibration_summary() -> dict:
    obs = [r for r in read_records("lab_analyst", "calibration") if r.get("type") == "observed"]
    mae = sum(abs(r["error_pct"]) for r in obs) / len(obs) if obs else 0.0
    return {"mean_abs_error_pct": round(mae, 1), "n_observed": len(obs)}


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
