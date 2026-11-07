# b_agents (Person B)

Shared memory plus the insights / strategy / social agents. Each agent exposes `run(ctx: dict) -> dict` and returns its slice of the run JSON (`shared/contracts.py`).

## Run order (A's orchestrator)

`insights -> competitor -> strategy -> social`, merging each result into `ctx`.

| Agent | Needs in ctx | Returns | LLM |
|---|---|---|---|
| `insights` | `db_path` (optional `as_of`) | `insights`, `insights_stats` (extra, not in run JSON) | Tinfoil |
| `strategy` | `insights`, optional `competitors`, `insights_stats`, `next_action_id` | `actions`, `memory_used` | Tinfoil |
| `social` | optional `actions` | `social` | Tinfoil (direct client; not routed through `llm.chat`) |

Each agent also returns `<agent>_source: "llm" | "fallback"` (outside the contract) and logs one line per call: `[agent] <name> path=tinfoil|fallback model=... latency=...`.

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

## Shopper Lab

20 synthetic shoppers (4 per segment) react to photo variants of one product. All LLM calls go to Tinfoil `gpt-oss-120b`.

**Entry point for A's `lab.py`:** `result = await b_agents.lab_pipeline.arun(ctx)` (or `lab_pipeline.run(ctx)` from sync code). It returns a LabResult (`b_agents/lab_contract.py`) plus `analyst_*` extras.

| ctx key | |
|---|---|
| `lab_run_id`, `variant_set_id` | e.g. `"l_001"`, `"vs_01"` |
| `product` | name, or `{"name": ...}` |
| `variants` | `[{variant_id, label, image_url, features, caption, price_usd, style?}]`; `style` is the word used in lessons ("lifestyle") |
| `segments` | `insights_stats["segments"]` (insights `run()` output); only needed when `personas` isn't given |
| `personas` | optional; the pipeline adds them to ctx, so pass them back to reuse the same panel |
| `shopper_lessons` | `"all"` (default) or `"observed"`; see the note below |

The pipeline runs in this order:
1. `persona_gen.run` (only if `personas` isn't given).
2. Lessons from `lab_outcomes`, read once (top 5).
3. Each persona's history from the SQLite mirror.
4. `shopper.run_panel`, with `Semaphore(8)`.
5. `lab_analyst.run`, which writes `lab_outcomes`, `calibration` predictions and `persona:<id>` in one Cognee batch.

**Real results:** call `memory.record_observed(variant_id, observed, source, segment=None)`. `observed` is on the lab's 0-1 score scale. It compares the result with the last prediction, writes a lesson such as "lab overrates lifestyle for At risk by 21%" and updates `calibration`.

**`shopper_lessons`:** with `"all"`, shoppers also see the lab's own findings ("lifestyle scores +70% with Champions"), and in testing the lab amplified its own winner: the lead went from +19% to +71%. With `"observed"`, shoppers only see lessons from real results, and scores moved in the corrected direction.

Timing: about 55-70s for a run with persona generation (persona_gen ~20s, panel ~25-30s, analyst ~5s), plus ~10-40s once per process to create the Tinfoil client.

```bash
python -m b_agents.dev_lab --fixture                     # run 1 -> 2 observed rates -> run 2
python -m b_agents.dev_lab --fixture --lessons observed
python -m pytest b_agents/tests -q -k live -s           # live 20-persona panel (needs .env)
```

Until `seed_lab.py` lands, `b_agents/lab_fixture.py` has the product and its 4 variants, and segment stats come from the fixture DB.
