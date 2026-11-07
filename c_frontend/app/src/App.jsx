import { useCallback, useEffect, useState } from 'react'
import { getLatestRun, getRun, startRun, USE_MOCK } from './api'
import Store from './tabs/Store'
import Insights from './tabs/Insights'
import Actions from './tabs/Actions'
import Social from './tabs/Social'
import Compare from './tabs/Compare'
import CostPanel from './components/CostPanel'

const TABS = ['Store', 'Insights', 'Actions', 'Social', 'Compare']

export default function App() {
  const [tab, setTab] = useState('Store')
  const [run, setRun] = useState(null)
  const [runs, setRuns] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const latest = await getLatestRun()
      setRun(latest)
      if (latest) {
        // No list endpoint: also fetch the previous run by id for Compare.
        const n = Number(latest.run_id.split('_')[1])
        const prev = n > 1 ? await getRun(`r_${String(n - 1).padStart(3, '0')}`) : null
        setRuns(prev ? [prev, latest] : [latest])
      }
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function runAgain() {
    setBusy(true)
    try {
      const next = await startRun()
      setRuns((prev) => [...prev.filter((r) => r.run_id !== next.run_id), next].slice(-2))
      setRun(next)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="brandbar">
        <div className="brandbar-in">
          <div>
            <img className="logo" src="/logo.png" alt="Atelier" />
            <p className="muted">AI operator for small boutiques{USE_MOCK && ' (mock data)'}</p>
          </div>
          <div className="top-right">
            {run && <span className="pill">{run.run_id}</span>}
            <button className="btn primary" onClick={runAgain} disabled={busy}>
              {busy ? 'Running (up to 90s)...' : 'Run again'}
            </button>
          </div>
        </div>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {error && <p className="error">{error}</p>}
      <main>
        {tab === 'Store' && <Store run={run} />}
        {run && tab === 'Insights' && <Insights run={run} />}
        {run && tab === 'Actions' && <Actions run={run} onChange={load} />}
        {run && tab === 'Social' && <Social run={run} />}
        {tab === 'Compare' && <Compare runs={runs} />}
        {!run && !error && tab !== 'Compare' && tab !== 'Store' && (
          <p className="muted">No runs yet. Click Run again to start one.</p>
        )}
      </main>
      <CostPanel runId={run?.run_id} />
    </div>
  )
}
