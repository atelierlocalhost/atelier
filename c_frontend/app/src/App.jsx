import { useCallback, useEffect, useState } from 'react'
import { getLatestRun, listRuns, startRun, USE_MOCK } from './api'
import Store from './tabs/Store'
import Insights from './tabs/Insights'
import Actions from './tabs/Actions'
import Social from './tabs/Social'
import Compare from './tabs/Compare'
import CostPanel from './components/CostPanel'

const TABS = ['Store', 'Insights', 'Actions', 'Social', 'Compare']

export default function App() {
  const [tab, setTab] = useState('Insights')
  const [run, setRun] = useState(null)
  const [runs, setRuns] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRun(await getLatestRun())
      setRuns([...(await listRuns())])
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
      setRun(await startRun())
      setRuns([...(await listRuns())])
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Atelier</h1>
          <p className="muted">AI operator for small boutiques{USE_MOCK && ' (mock data)'}</p>
        </div>
        <div className="top-right">
          {run && <span className="pill">{run.run_id}</span>}
          <button className="btn primary" onClick={runAgain} disabled={busy}>
            {busy ? 'Running...' : 'Run again'}
          </button>
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
        {tab === 'Store' && <Store />}
        {run && tab === 'Insights' && <Insights run={run} />}
        {run && tab === 'Actions' && <Actions run={run} onChange={load} />}
        {run && tab === 'Social' && <Social run={run} />}
        {tab === 'Compare' && <Compare runs={runs} />}
        {!run && !error && tab !== 'Store' && <p className="muted">Loading...</p>}
      </main>
      <CostPanel runKey={run?.run_id} />
    </div>
  )
}
