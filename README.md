# Atelier

An AI operator for small boutiques: segments customers, watches competitors, proposes actions, writes social posts, and remembers what worked.

## Ownership

| Folder | Owner | Branch | Contents |
|---|---|---|---|
| `shared/` | everyone (frozen) | `main` | run JSON contract, mock runs, SQLite schema |
| `a_platform/` | Person A | `a/platform` | FastAPI, orchestrator, db, seed, LLM router, SIE, Stripe, storefront/orders/competitor agents |
| `b_agents/` | Person B | `b/agents` | Cognee memory, insights/strategy/social agents |
| `c_frontend/` | Person C | `c/frontend` | React dashboard, store/card templates, pitch |
| `Dockerfile`, `tinfoil-config.yml` | Person A | `a/platform` | at repo root because Tinfoil requires it |

## Rules

- **Never edit another person's folder.** Ask the owner.
- `shared/` is frozen. Don't edit it without telling the whole team first.
- Work on your own branch; merge to `main` when it runs.

## Privacy routing

Anything touching customer data goes to **Tinfoil** (private inference in an enclave). Social and competitor copy with no PII goes to **Darkbloom**.

## Setup

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn a_platform.main:app --reload
```

Agent contract: every agent module exposes `run(ctx: dict) -> dict` (see `shared/contracts.py`).
Pipeline order: insights, competitor, strategy, social.
