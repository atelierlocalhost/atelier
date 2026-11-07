# Atelier

**An AI operator for small boutiques that keeps customer data private.**

![Inference: Tinfoil](https://img.shields.io/badge/inference-Tinfoil-0a7671)
![Memory: Cognee](https://img.shields.io/badge/memory-Cognee-6646c2)
![Model: gpt-oss-120b](https://img.shields.io/badge/model-gpt--oss--120b-15202b)
![Python 3.12](https://img.shields.io/badge/python-3.12-3776ab)
![React + Vite](https://img.shields.io/badge/frontend-React%20%2B%20Vite-646cff)

Atelier reads a shop's orders, finds which customers are drifting away, checks what competitors are doing, and proposes the next few moves: a win-back coupon, a bundle, a post. It writes the social carousels in the shop's own voice, tests product photos on a panel of synthetic shoppers before anything goes live, and remembers what worked so the next plan is better than the last.

Every model call runs on Tinfoil's attested private inference, and the agents' shared memory runs on Cognee inside the same trust boundary. Customer records never leave the app; the models only ever see aggregates.

[Architecture](#architecture) · [Sponsors](#built-with-our-sponsors) · [How it works](#how-it-works) · [Privacy](#privacy-model) · [Quickstart](#quickstart) · [Repository](#repository-layout) · [Status](#status)

---

## What it does

| Capability | What the shop owner gets |
|---|---|
| **Customer insights** | RFM segmentation (Champions, Loyal, New, At risk, Hibernating) with churn flags, computed in pandas and explained in plain language |
| **Strategy** | 3 to 5 concrete actions per run (coupon, bundle, win-back email, acquisition post), each with the reason behind it |
| **Social** | 3 ready-to-post carousels with captions, trending sounds and 5 slides each |
| **Shopper Lab** | 20 synthetic shoppers rate product photo variants; a ranked winner with confidence intervals, per-segment scores and real comments |
| **Memory** | Results of past actions and lab tests feed the next run, so the plan visibly adapts |

---

## Architecture

![Atelier architecture](docs/architecture.svg)

The backend runs as a single container inside a Tinfoil enclave. Cognee runs in-process, so memory stays inside the enclave with everything else. The teal arrows are the only traffic that leaves the box, and all of it goes to Tinfoil's attested inference endpoint: the app's chat calls, and Cognee's own LLM and embedding calls.

---

## Built with our sponsors

| Sponsor | Role in Atelier | Where in the code | Status |
|---|---|---|---|
| **Tinfoil** | Private inference for every LLM call (`gpt-oss-120b`), embeddings for memory (`nomic-embed-text`, 768 dimensions), and enclave hosting for the app container | `a_platform/llm.py`, `b_agents/llm_util.py`, `b_agents/memory.py`, `Dockerfile`, `tinfoil-config.yml` | Inference live and verified. Enclave config in repo, deploy pending |
| **Cognee** | Shared memory for all agents: brand voice, customer summaries, competitor notes, action outcomes, lab lessons, calibration and per-persona history | `b_agents/memory.py` | Live, running on Tinfoil. SQLite mirror as fallback |
| **SIE / Superlinked** | Product tagging and embeddings for the storefront | `a_platform/sie.py` | Interface stub, not yet wired |
| **Darkbloom** | Originally planned for creative copy with no customer data | removed | Retired: the account had no credits, so those calls moved to Tinfoil. `darkbloom_usd` stays 0 |

### Tinfoil

- **One trust boundary for all inference.** The agents (insights, strategy, social, persona generation, the 20 shoppers and the lab analyst) share one Tinfoil client, and Cognee's cognify and embedding calls go to the same Tinfoil endpoint.
- **Attestation before the first request.** The `tinfoil` SDK verifies the enclave when the client is created. That takes 10 to 40 seconds, so the app creates the client once per process and reuses it.
- **Structured output.** Calls request JSON, and every response is still extracted, validated against the contract and retried once with the validation error fed back.
- **Fast concurrent calls.** The shopper panel uses `reasoning_effort="low"`, which cut a test call from 3.5 s to 1.3 s, and runs 8 calls at a time through `asyncio.to_thread`.

### Cognee

- **One isolated dataset per memory kind**: `brand`, `customers`, `competitors`, `outcomes`, `lab_outcomes`, `calibration` and `persona:<id>`.
- **Configured for Tinfoil.** Cognee's LLM and embeddings point at Tinfoil. Three settings made it work:
  - **Embeddings:** `EMBEDDING_PROVIDER=openai_compatible`, because the LiteLLM-routed providers reject the `dimensions` parameter.
  - **Isolation:** `ENABLE_BACKEND_ACCESS_CONTROL=True`, because without it chunk search returned results from other datasets.
  - **Config file:** `COGNEE_ENV_FILE` points at an empty file, because Cognee otherwise re-loads `.env` with override on and undoes the configuration.
- **Permission map in front of every call.** `memory.py` checks which agent may read or write each dataset before Cognee is touched, and it also filters every Cognee hit to records of the requested dataset.
- **Built for speed.** All Cognee calls share one long-lived event loop. Writes are batched (27 records in 3.7 s). Every write is mirrored to SQLite, so persona history and calibration are read without a Cognee round trip, and reads fall back to the mirror if Cognee errors.

---

## How it works

### The main run

![Main run](docs/main-run.svg)

1. **Insights** loads orders from SQLite and computes recency, frequency and monetary quintiles in pandas. Tinfoil receives segment aggregates only and returns what is working and what to fix. A summary is written to `customers` memory.
2. **Competitor** returns rival promotions and price gaps (mock data until the platform agent lands).
3. **Strategy** first asks memory what has worked for this store before, then asks Tinfoil for 3 to 5 actions. Every action is validated against the contract.
4. **Social** reads the brand voice and past outcomes, never customers, and writes 3 carousels with sounds picked from a curated trends list.

When the owner applies an action, `memory.record_outcome()` stores the result. In testing, after recording "win-back coupon to At risk: 12% redeemed" and "bundle to Loyal: 1% uptake", the next plan opened with the win-back and dropped the bundle.

### The Shopper Lab

![Shopper Lab](docs/shopper-lab.svg)

1. **Personas.** One Tinfoil call turns segment aggregates into 20 personas, 4 per segment. Each has an invented first name, an age band, a budget near the segment's average order value, a style, a price sensitivity and a channel.
2. **Shoppers.** Each persona sees the photo variants shuffled and relabelled A to D, so position and labels don't bias the result. For each variant they return the chance they stop scrolling, click and add to cart, plus purchase intent, willingness to pay, a reason, an objection and a comment.
3. **Analysis.** pandas scores each variant as `0.2 * stop_scroll + 0.3 * click + 0.5 * add_to_cart`, overall and per segment. A 1000-sample bootstrap over personas gives a 90% interval. The winner is called `clear` only when its lower bound beats the runner-up's upper bound; otherwise it is `too_close`.
4. **Learning.** Lessons, per-variant predictions and each persona's reactions are written to memory in one batch. When real sales come in, `memory.record_observed()` compares them with the prediction and writes a correction such as "lab overrates lifestyle for At risk by 21%".

Which lessons the shoppers see is configurable. With `shopper_lessons="all"`, they also see the lab's own earlier findings. In testing, that inflated the winner's lead from 19% to 71%. With `"observed"`, they see only lessons from real results, and scores moved in the direction the real data pointed.

### Memory permissions

| Agent | brand | customers | competitors | outcomes | lab_outcomes | calibration | persona:&lt;id&gt; |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| insights | R | RW | | RW | | | |
| strategy | R | RW | | RW | R | R | |
| social | R | | | R | R | | |
| competitor | | | W | | | | |
| persona_gen | | R | | | | | |
| shopper | R | **denied** | | | R | | R |
| lab_analyst | | | | | W | RW | W |

Any other access raises `PermissionError`. The test suite checks the important ones, including that a synthetic shopper can never read real customers.

---

## Privacy model

- **Customer rows stay in the app.** Agents compute on them locally and send only aggregates (counts, averages, shares) to the model.
- **One destination for inference.** Every model call goes to Tinfoil, whose servers run in attested enclaves. The client verifies the enclave before sending anything.
- **Memory never leaves the enclave.** Cognee runs in-process with its graph and vector stores on local disk. Its LLM and embedding calls go to the same Tinfoil endpoint.
- **Least privilege between agents.** Each agent can touch only the memory it needs. Creative agents and synthetic shoppers cannot read customers.
- **No names in synthetic data.** Personas get invented first names, and the tests confirm that no real names or emails appear in what is sent to the model.

---

## Measured performance

From live runs on Tinfoil with Cognee enabled:

| Step | Result |
|---|---|
| Shopper panel, 20 personas | 20 of 20 valid responses in 25 to 33 s |
| Full lab run including persona generation | 55 to 70 s |
| Lab run reusing personas | 35 to 49 s |
| Cognee batch write, 27 records | 3.7 s |
| Cost of one lab run | $0.017 on Tinfoil, vs about $0.29 at frontier-model rates |
| Darkbloom calls | 0 |

---

## Quickstart

### Requirements

- Python 3.12. Cognee needs 3.10 or newer.
- Node 18 or newer, for the dashboard.
- A Tinfoil API key.

### Backend and agents

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install uv && uv pip install -r requirements.txt   # uv resolves Cognee's dependencies much faster than pip
cp .env.example .env                                   # add TINFOIL_API_KEY
uvicorn a_platform.main:app --reload --port 8080
```

### See the agents learn

```bash
python -m b_agents.dev_run --fixture                     # main run twice, with outcomes recorded in between
python -m b_agents.dev_lab --fixture                     # Shopper Lab: run 1, seed real results, run 2
python -m b_agents.dev_lab --fixture --lessons observed  # same, shoppers see only real-result lessons
```

Both scripts build a deterministic fixture store (80 customers, about 220 orders over 6 months, with a clear At risk group), print one log line per model call with its provider, model and latency, and save their run JSON to `b_agents/.dev/`.

### Dashboard

```bash
cd c_frontend/app
npm install
npm run dev
```

The dashboard runs on mock data by default. Set `VITE_USE_MOCK=false` and `VITE_BASE_URL=http://localhost:8080` in `c_frontend/app/.env` to use the API.

### Configuration

| Variable | Purpose |
|---|---|
| `TINFOIL_API_KEY` | Tinfoil inference, used by the app and by Cognee |
| `LLM_ENDPOINT`, `LLM_MODEL` | Tinfoil endpoint and chat model (`gpt-oss-120b`) |
| `EMBEDDING_ENDPOINT`, `EMBEDDING_MODEL` | Tinfoil endpoint and embedding model (`nomic-embed-text`) |
| `MEMORY_BACKEND` | `auto` (default; Cognee when a Tinfoil key is set), `cognee` or `sqlite` |
| `ATELIER_DB_PATH` | Store database. Defaults to `atelier.db` at the repo root |
| `ATELIER_MEMORY_DB` | SQLite memory mirror. Defaults to `b_agents/.dev/memory.db` |
| `SIE_API_KEY`, `STRIPE_SECRET_KEY` | Product tagging and payments (stubs today) |
| `TELEMETRY_DISABLED` | Keep at `1` |

`DARKBLOOM_API_KEY` and `DARKBLOOM_MODEL` are still in `.env.example` but are unused. Leave them blank.

---

## Repository layout

```
atelier/
├── shared/              Frozen contract: run JSON types, mock runs, SQLite schema
├── a_platform/          Person A: FastAPI, orchestrator, db, seed, LLM router, SIE, Stripe,
│                        storefront, orders and competitor agents
├── b_agents/            Person B: Cognee memory, insights, strategy, social, Shopper Lab
│   ├── memory.py        Permission map, Cognee on Tinfoil, SQLite mirror, calibration
│   ├── lab_pipeline.py  Shopper Lab entry point: persona_gen, shopper panel, lab_analyst
│   ├── lab_contract.py  LabResult shape
│   └── tests/           Permissions, RFM math, contract shapes, live panel test
├── c_frontend/          Person C: React dashboard, store and card templates, pitch
├── docs/                Architecture diagrams
├── Dockerfile           App container (at the root because Tinfoil requires it)
└── tinfoil-config.yml   Tinfoil enclave configuration
```

Every agent exposes `run(ctx: dict) -> dict` and returns only its slice of the run JSON in `shared/contracts.py`. The orchestrator merges each slice into `ctx` in order: insights, competitor, strategy, social.

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/api/run` | Run the agent pipeline and return the run JSON |
| GET | `/api/run/latest`, `/api/run/{id}` | Fetch a run |
| POST | `/api/actions/{id}/approve` | Approve a proposed action |
| GET | `/api/costs` | Cost breakdown by provider |
| GET | `/api/store` | Storefront products and payment links |
| POST | `/webhooks/stripe` | Stripe events |
| POST | `/api/lab/run`, `/api/lab/outcomes` | Shopper Lab (planned; calls `b_agents.lab_pipeline.arun` and `memory.record_observed`) |

---

## Testing

```bash
python -m pytest b_agents/tests -q                 # 57 offline tests, no keys needed
python -m pytest b_agents/tests -q -k live -s      # live 20-persona panel on Tinfoil (needs .env)
```

Offline tests run every agent on its rule-based fallback, so the full pipeline is covered without network access.

---

## Status

| Area | Owner | State |
|---|---|---|
| Agents, memory and Shopper Lab | B | On `main`. Verified end to end on Tinfoil and Cognee |
| Dashboard and Shopper Lab tab | C | On `main`. Runs on mock data until the API is live |
| API, orchestrator, Stripe, SIE, enclave deploy | A | Scaffold on `main`. Lab endpoints and the deploy are next |

## Team workflow

- Each person works in their own folder and branch: `a_platform/`, `b_agents/` (`b/agents`), `c_frontend/` (`c/frontend`).
- Never edit another person's folder. Ask the owner.
- `shared/` is frozen. Tell the whole team before changing it.
- Merge to `main` when your part runs.
