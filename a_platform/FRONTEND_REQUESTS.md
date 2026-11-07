# From C (dashboard) to A (platform): what the UI does and what it needs next

Written by Person C. This is a new file only; no existing file in `a_platform/` was touched.
Branch: `c/frontend`. Run the UI: `cd c_frontend/app && npm install && npm run dev`.
Flip to your API with `VITE_USE_MOCK=false` and `VITE_BASE_URL=http://localhost:8080` in `c_frontend/app/.env`.

## What the interface does today
| Tab | Uses | Status |
|---|---|---|
| Your store | `GET /api/run/latest`, iframe of `GET /api/store` | Works against the contract. Stats are derived from `insights.segments`. |
| Insights | run JSON | Segment explorer, social media insights, mailing list and past campaigns, competitor analysis (what they do better, offer comparison, suggested responses). |
| Actions | `POST /api/actions/{id}/approve` | Board by status, plus the memory the Strategy agent used. Expects the updated Action back (`status: applied`, optional `result.message`). |
| Social and email | run JSON | Carousels, image lab (uploads, sample stats), email drafts. |
| Assistant and reports | `POST /api/chat` (missing) | Chat falls back to rule-based answers from the run. Reports (PDF/CSV/MD) are built in the browser. |
| Compare runs | `GET /api/run/{id}` | Runs named by what happened, what changed, what worked, customer profile before and after. Fetches the previous run by id. |
| Connections | `GET /api/costs` | Agent order and memory permissions, cost per run and spend breakdown, service connections (local toggles in mock mode). |

Other behavior to know:
- `POST /api/run` can take 30 to 90 s. The UI waits up to 180 s.
- A 404 from `/api/run/latest` is shown as an empty state, not an error.
- `/api/costs?run_id=` must return the `CostSummary` shape from the OpenAPI spec.
- The UI only renders `http(s)` competitor URLs as links.
- The store template is `c_frontend/templates/store.html` (Jinja2). Context: `store_name`, `products` (rows from the products table; `tags` is a comma-separated string). Card template: `templates/card.html` with `headline`, `body`, `index`, `total`.
- Please add the Netlify origin and `http://localhost:5173` to CORS.

## What to build next (in priority order)
1. **`POST /api/chat`**: body `{messages: [{role, content}], run_id}`, response `{reply: string}`. Route it through `llm.chat("insights", ...)` (Tinfoil), since answers include customer data. The UI already calls it and falls back locally on any failure.
2. **Real `/api/store`** rendered from `store.html` with real products and Stripe links.
3. **Email copy on actions**: for `winback_email` and `coupon` actions return `email: {subject, body}` written by the Strategy agent. Today the UI writes template copy itself. Needs B plus a contract change.
4. **Campaign history**: store past campaign results (`name`, `segment`, `rate`, `metric`, `sent_at`) and expose `GET /api/campaigns`. The UI parses `memory_used` strings for now and fills the rest with labeled sample rows.
5. **Image performance and generation**: `POST /api/images` (upload), `GET /api/images` (list with `reach`, `engagement`, `saves`, `clicks`, `tags`), `POST /api/images/generate` (concepts from top styles). The UI keeps images in the browser and shows labeled sample stats.
6. **Auth and connections**: `POST /api/auth/login`, `GET /api/integrations` (status per service), `POST /api/integrations/stripe/connect`. Keys stay in enclave secrets; the UI never takes them. Sign-in is a demo today.
7. **Competitor price gap**: `price_gap_pct` may be `null` when not measured. The UI shows "Price gap not measured".
8. **Product and order detail** (top products, orders per month) if you want richer store stats.
9. **Dockerfile / `.dockerignore`**: add `c_frontend/app/node_modules` so the image stays small.
10. **`tinfoil-config.yml`** (yours, unchanged by me): needs the egress allowlist, `networks: [backend]`, `secrets:` for the keys, the 4 CPU / 16384 MB sizing, a pinned image digest, and `LLM_API_KEY` for Cognee.

## Demo data
`c_frontend/app/src/demoClient.js` overlays the mock run with a demo client (Because Of Alice) and an invented, larger customer base. Those numbers are not the brand's real figures. The competitor (Oh Polly) and the storefront collections were read from public sites. The client site forbids embedding, so the mock storefront is drawn by the app.
