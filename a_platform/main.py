"""FastAPI app. Owned by Person A. Endpoints listed in a_platform/README.md."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request

from a_platform import orchestrator, stripe_client

app = FastAPI(title="Atelier")
RUNS: dict[str, dict] = {}  # TODO(A): persist runs


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/run")
def create_run():
    run_id = f"r_{len(RUNS) + 1:03d}"
    RUNS[run_id] = orchestrator.run(run_id)
    return RUNS[run_id]


@app.get("/api/run/latest")
def latest_run():
    if not RUNS:
        raise HTTPException(404, "no runs yet")
    return RUNS[sorted(RUNS)[-1]]


@app.get("/api/run/{run_id}")
def get_run(run_id: str):
    if run_id not in RUNS:
        raise HTTPException(404, "run not found")
    return RUNS[run_id]


@app.post("/api/actions/{action_id}/approve")
def approve_action(action_id: int):
    # TODO(A): update actions table, hand to orders agent
    return {"id": action_id, "status": "approved"}


@app.get("/api/costs")
def costs():
    # TODO(A): aggregate costs table
    return {}


@app.get("/api/store")
def store():
    # TODO(A): products + stripe links for c_frontend/templates/store.html
    return {"products": []}


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    return stripe_client.handle_webhook(await request.body(), request.headers.get("stripe-signature", ""))
