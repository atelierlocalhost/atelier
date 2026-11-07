# a_platform (Person A)

FastAPI app, orchestrator, SQLite, seed data, LLM router, SIE, Stripe, and the storefront / orders / competitor agents.

Run: `uvicorn a_platform.main:app --reload`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/api/run` | run the agent pipeline, return run JSON |
| GET | `/api/run/latest` | most recent run JSON |
| GET | `/api/run/{id}` | run JSON by id |
| POST | `/api/actions/{id}/approve` | mark an action approved (proposed -> approved -> applied) |
| GET | `/api/costs` | cost breakdown by provider |
| GET | `/api/store` | products + Stripe links for the storefront |
| POST | `/webhooks/stripe` | Stripe webhook |

## LLM router (`llm.py`)

`chat(task, messages, json=False) -> str`

- `insights`, `strategy`, `orders` -> Tinfoil (`TinfoilAI`, `gpt-oss-120b`). Anything with customer data.
- `social`, `competitor` -> Darkbloom (OpenAI client, `https://api.darkbloom.dev/v1`, model from `DARKBLOOM_MODEL`). No PII.
- Logs provider/model/tokens to the `costs` table when the db exists, else prints.

Pipeline order: insights, competitor, strategy, social.
