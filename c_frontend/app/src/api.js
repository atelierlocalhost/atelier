import mock1 from '@shared/mock_run.json'
import mock2 from '@shared/mock_run_2.json'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
export const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:8080'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))
let mockRuns = [structuredClone(mock1)]

async function http(path, opts) {
  const res = await fetch(BASE_URL + path, opts)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export async function getLatestRun() {
  if (USE_MOCK) return mockRuns[mockRuns.length - 1]
  return http('/api/run/latest')
}

export async function listRuns() {
  if (USE_MOCK) return mockRuns
  const latest = await http('/api/run/latest')
  return [latest]
}

export async function getRun(id) {
  if (USE_MOCK) return mockRuns.find((r) => r.run_id === id)
  return http(`/api/run/${id}`)
}

export async function startRun() {
  if (USE_MOCK) {
    await delay(800)
    if (mockRuns.length < 2) mockRuns.push(structuredClone(mock2))
    return mockRuns[mockRuns.length - 1]
  }
  return http('/api/run', { method: 'POST' })
}

export async function approveAction(id) {
  if (USE_MOCK) {
    await delay(300)
    for (const run of mockRuns) {
      const a = run.actions.find((x) => x.id === id)
      if (a) a.status = 'applied'
    }
    return { id, status: 'applied' }
  }
  return http(`/api/actions/${id}/approve`, { method: 'POST' })
}

export async function getCosts() {
  if (USE_MOCK) return mockRuns[mockRuns.length - 1].costs
  return http('/api/costs')
}

export const storeUrl = () => (USE_MOCK ? null : `${BASE_URL}/api/store`)
