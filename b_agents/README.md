# b_agents (Person B)

Shared memory plus the insights / strategy / social agents. Each agent exposes `run(ctx: dict) -> dict` and returns its slice of the run JSON (`shared/contracts.py`).

## Run order (A's orchestrator)

`insights -> competitor -> strategy -> social`, merging each result into `ctx`.

| Agent | Needs in ctx | Returns | LLM |
|---|---|---|---|
| `insights` | `db_path` (optional `as_of`) | `insights`, `insights_stats` (extra, not in run JSON) | Tinfoil |
| `strategy` | `insights`, optional `competitors`, `insights_stats`, `next_action_id` | `actions`, `memory_used` | Tinfoil |
| `social` | optional `actions` | `social` | Darkbloom |

Each agent also returns `<agent>_source: "llm" | "fallback"` (outside the contract) and logs one line per call: `[agent] <name> path=tinfoil|darkbloom|fallback model=... latency=...`.

Numbers are computed in pandas (RFM quintiles). The LLM only explains them and only sees aggregates, never names or emails. Without an API key each agent uses a rule-based fallback, so the pipeline always returns valid JSON.

## Memory (`memory.py`)

```python
memory.read(agent, dataset, query) -> list[str]
memory.write(agent, dataset, record) -> None        # PermissionError if not allowed
memory.record_outcome("Win-back email", "At risk", "12% redeemed")
memory.seed_brand()                                  # idempotent; call once at startup
```

Datasets: `brand`, `customers`, `competitors`, `outcomes`.

| Agent | Read | Write |
|---|---|---|
| insights, strategy | customers, outcomes, brand | customers, outcomes |
| social | brand, outcomes | none |
| competitor | none | competitors |
| system (platform) | all | all |

The backend is Cognee 1.6 on Tinfoil (verified working). There's one Cognee dataset per memory dataset (`atelier_<name>`). Every write is also mirrored to SQLite, and reads fall back to it if Cognee errors.
`MEMORY_BACKEND=cognee|sqlite|auto` (auto means Cognee when `TINFOIL_API_KEY` is set).

memory.py sets Cognee's config itself, and these values win over `.env`:
- LLM: `custom` provider (unless `LLM_PROVIDER` is set), model `openai/gpt-oss-120b`.
- Embeddings: `EMBEDDING_PROVIDER=openai_compatible`, model `nomic-embed-text`, 768 dims. The LiteLLM providers (`custom`, `openai`) fail with "Setting dimensions is not supported".
- `ENABLE_BACKEND_ACCESS_CONTROL=True`. Without it, chunk search returns chunks from other datasets. As a second guard, Cognee hits are filtered to records of the requested dataset.
- `COGNEE_ENV_FILE` points to an empty file, because Cognee otherwise re-loads `.env` with override=True and undoes all of the above.

Reads that need a cognify take 20 to 40 seconds; reads after that take about 4 seconds.

## Dev

```bash
python -m b_agents.dev_run --fixture   # run twice with outcomes in between; diff of actions
python -m pytest b_agents/tests -q
```

`fixture.py` builds a deterministic DB (80 customers, ~220 orders, 6 months, clear At risk group) under `b_agents/.dev/` (gitignored).
