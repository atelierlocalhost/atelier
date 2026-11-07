import mock1 from '@shared/mock_run.json'
import mock2 from '@shared/mock_run_2.json'
import { applyClient, DEMO_CLIENT } from './demoClient'

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
export async function getLatestRun() {
  if (USE_MOCK) return mockRuns[mockRuns.length - 1]
  try {
    return await http('/api/run/latest')
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

export async function startRun(label) {
  if (USE_MOCK) {
    await delay(800)
    if (mockRuns.length < 2) mockRuns.push(applyClient(mock2))
    return mockRuns[mockRuns.length - 1]
  }
  return http(
    '/api/run',
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
        { provider: 'tinfoil', model: 'gpt-oss-120b', calls: 0, tokens: 0, usd: c.tinfoil_usd },
        { provider: 'darkbloom', calls: 0, tokens: 0, usd: c.darkbloom_usd },
      ],
      total_usd: total,
      frontier_equiv_usd: c.frontier_equiv_usd,
      savings_pct: ((c.frontier_equiv_usd - total) / c.frontier_equiv_usd) * 100,
    }
  }
  return http(`/api/costs${runId ? `?run_id=${encodeURIComponent(runId)}` : ''}`)
}

export const storeUrl = () => (USE_MOCK ? DEMO_CLIENT.url : `${BASE_URL}/api/store`)
