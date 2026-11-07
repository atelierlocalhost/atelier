import mock1 from '@shared/mock_run.json'
import mock2 from '@shared/mock_run_2.json'
import lab1 from './mock_lab.json'
import lab2 from './mock_lab_2.json'
import { applyClient, DEMO_CLIENT } from './demoClient'
import mockTrend from './mock_trend.json'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
export const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:8080'

// POST /api/run is synchronous and can take 30 to 90 seconds.
const RUN_TIMEOUT_MS = 180_000

const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const mockRuns = [applyClient(mock1)]

async function http(path, opts = {}, timeoutMs = 30_000) {
  const res = await fetch(BASE_URL + path, { ...opts, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.detail || `${path} failed: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// 404 means no run yet, which is a normal empty state.
const q = (clientId) => (clientId ? `?client_id=${encodeURIComponent(clientId)}` : '')

export async function getLatestRun(clientId) {
  if (USE_MOCK) return mockRuns[mockRuns.length - 1]
  try {
    return await http(`/api/run/latest${q(clientId)}`)
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

export async function getRun(id) {
  if (USE_MOCK) return mockRuns.find((r) => r.run_id === id) || null
  try {
    return await http(`/api/run/${id}`)
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

// Completed runs for a client, oldest first: [{ run_id, label, started_at }]
export async function getRuns(clientId) {
  if (USE_MOCK) return mockRuns.map((r) => ({ run_id: r.run_id, label: r.label || r.run_id }))
  return http(`/api/runs${q(clientId)}`)
}

export async function startRun(label, clientId) {
  if (USE_MOCK) {
    await delay(800)
    if (mockRuns.length < 2) mockRuns.push(applyClient(mock2))
    return mockRuns[mockRuns.length - 1]
  }
  return http(
    `/api/run${q(clientId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(label ? { label } : {}),
    },
    RUN_TIMEOUT_MS,
  )
}

// Returns the updated Action (status "applied", optional result.message).
export async function approveAction(id) {
  if (USE_MOCK) {
    await delay(300)
    for (const run of mockRuns) {
      const a = run.actions.find((x) => x.id === id)
      if (a) {
        a.status = 'applied'
        a.result = { message: 'Applied in mock mode' }
        return a
      }
    }
    throw new Error('Action not found')
  }
  return http(`/api/actions/${id}/approve`, { method: 'POST' })
}

// CostSummary: { providers[], total_usd, frontier_equiv_usd, savings_pct }
export async function getCosts(runId) {
  if (USE_MOCK) {
    const run = mockRuns.find((r) => r.run_id === runId) || mockRuns[mockRuns.length - 1]
    const c = run.costs
    const total = c.sie_usd + c.tinfoil_usd + c.darkbloom_usd
    return {
      run_id: run.run_id,
      providers: [
        { provider: 'sie', calls: 0, tokens: 0, usd: c.sie_usd },
        // Darkbloom is retired: its cost is folded into Tinfoil.
        { provider: 'tinfoil', model: 'gpt-oss-120b', calls: 0, tokens: 0, usd: c.tinfoil_usd + c.darkbloom_usd },
      ],
      total_usd: total,
      frontier_equiv_usd: c.frontier_equiv_usd,
      savings_pct: ((c.frontier_equiv_usd - total) / c.frontier_equiv_usd) * 100,
    }
  }
  return http(`/api/costs${runId ? `?run_id=${encodeURIComponent(runId)}` : ''}`)
}

export const storeUrl = () => (USE_MOCK ? DEMO_CLIENT.url : `${BASE_URL}/api/store`)

// ---- Shopper Lab (synthetic shopper panel). Shapes follow the LabResult contract in the plan. ----
const mockLabs = []
const mockOutcomes = []

// Real call can take 30 to 90 s. n_per_segment defaults to 4 (20 personas).
// ctx: { shop_id | client_id, audience: 'women' | 'men' | 'kids' } scopes the panel to one shop's photos.
export async function startLabRun(variantSetId = 'vs_01', label, ctx = {}) {
  if (USE_MOCK) {
    await delay(5200) // lets the UI show the six steps
    const next = structuredClone(mockLabs.length === 0 ? lab1 : lab2)
    mockLabs.push(next)
    return next
  }
  return http(
    '/api/lab/run',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_set_id: variantSetId, ...(label ? { label } : {}), ...ctx }),
    },
    RUN_TIMEOUT_MS,
  )
}

// The four photos the panel will judge for this shop and audience: { product, variants[], sample_photos }
export async function getLabVariants(ctx = {}) {
  if (USE_MOCK || (!ctx.shop_id && !ctx.client_id)) return null
  const p = new URLSearchParams(Object.entries(ctx).filter(([, v]) => v))
  return http(`/api/lab/variants?${p}`)
}

export async function getLabRun(id) {
  if (USE_MOCK) return mockLabs.find((r) => r.lab_run_id === id) || null
  return http(`/api/lab/run/${id}`)
}

// Real results flow back so the lab can calibrate its predictions.
export async function postLabOutcome({ variant_id, observed, source = 'manual' }) {
  if (USE_MOCK) {
    await delay(300)
    mockOutcomes.push({ variant_id, observed, source })
    return { variant_id, observed, source }
  }
  return http('/api/lab/outcomes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variant_id, observed, source }),
  })
}

// ---- Trend Drive: find underperforming boutiques, plan, approve and send ----
const post = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })

// { searched, reviewed, underperforming, waiting_review, busy, stage, error }
export async function getTrendSummary() {
  if (USE_MOCK) return mockTrend.summary
  return http('/api/trend/summary')
}

// Starts a search in the background (3 to 4 minutes); poll getTrendSummary().busy.
export async function startTrendSearch() {
  if (USE_MOCK) {
    await delay(600)
    return { run_id: mockTrend.summary.run_id }
  }
  return http('/api/trend/search', post())
}

// { latest: ShopCard[], earlier: ShopCard[] }
export async function getTrendShops() {
  if (USE_MOCK) return mockTrend.shops
  return http('/api/trend/shops')
}

// Plan, why-chosen table, concept images and the exact email the shop receives.
export async function getTrendShop(id) {
  if (USE_MOCK) return mockTrend.details[id] || null
  return http(`/api/trend/shops/${id}`)
}

// Sends the proposal email from Gmail. 422 without an address, 409 if already sent.
export async function approveTrendShop(id, recipient) {
  if (USE_MOCK) {
    await delay(400)
    const d = mockTrend.details[id]
    if (d) Object.assign(d, { status: 'EMAILED', outreach: { ...d.outreach, result: 'Sent in mock mode' } })
    return { status: 'EMAILED', email_result: 'Sent in mock mode' }
  }
  return http(`/api/trend/shops/${id}/approve`, post(recipient ? { recipient } : {}))
}

// ---- Signed boutiques and their weekly reports ----
export async function getClients() {
  if (USE_MOCK) return mockTrend.clients
  return http('/api/clients')
}

export async function getReports(clientId) {
  if (USE_MOCK) return mockTrend.reports
  return http(`/api/clients/${encodeURIComponent(clientId)}/reports`)
}

// Builds the last `weeks` weekly reports in the background and emails each PDF.
export async function backfillReports(clientId, weeks = 4) {
  if (USE_MOCK) return { started: true, weeks }
  return http(`/api/clients/${encodeURIComponent(clientId)}/reports/backfill?weeks=${weeks}`, post())
}

export async function sendReportNow(clientId) {
  if (USE_MOCK) return { status: 'sent', detail: 'Sent in mock mode' }
  return http(`/api/clients/${encodeURIComponent(clientId)}/reports/send`, post(), RUN_TIMEOUT_MS)
}

// Backend-relative paths (PDFs, concept images) become absolute in real mode.
export const apiUrl = (path) => (USE_MOCK || !path ? path : BASE_URL + path)

// Which services have keys on the server: { tinfoil, sie, gmail, stripe, stripe_mode }
export async function getConnectionStatus() {
  if (USE_MOCK) return null
  return http('/api/connections')
}
