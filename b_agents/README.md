# b_agents (Person B)

Shared memory plus the insights / strategy / social agents. Each agent exposes `run(ctx: dict) -> dict` and returns its slice of the run JSON (`shared/contracts.py`).

## Run order (A's orchestrator)

`insights -> competitor -> strategy -> social`, merging each result into `ctx`.

| Agent | Needs in ctx | Returns | LLM |
|---|---|---|---|
| `insights` | `db_path` (optional `as_of`) | `insights`, `insights_stats` (extra, not in run JSON) | Tinfoil |
| `strategy` | `insights`, optional `competitors`, `insights_stats`, `next_action_id` | `actions`, `memory_used` | Tinfoil |
| `social` | optional `actions` | `social` | Darkbloom |

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

The backend is Cognee, with its LLM and embeddings on Tinfoil (`custom` provider, `openai/gpt-oss-120b`, `openai/nomic-embed-text`, 768 dims). There's one Cognee dataset per memory dataset (`atelier_<name>`). Every write is also mirrored to SQLite, and reads fall back to it if Cognee errors.
`MEMORY_BACKEND=cognee|sqlite|auto` (auto means Cognee when `TINFOIL_API_KEY` is set).

## Dev

```bash
python -m b_agents.dev_run --fixture   # run twice with outcomes in between; diff of actions
python -m pytest b_agents/tests -q
```

`fixture.py` builds a deterministic DB (80 customers, ~220 orders, 6 months, clear At risk group) under `b_agents/.dev/` (gitignored).
