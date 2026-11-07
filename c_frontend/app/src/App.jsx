import { useCallback, useEffect, useState } from 'react'
import { getLatestRun, getRun, startRun, USE_MOCK } from './api'
import { DEMO_CLIENT } from './demoClient'
import { getSession, signIn, signOut } from './auth'
import Store from './tabs/Store'
import Insights from './tabs/Insights'
import Actions from './tabs/Actions'
import Social from './tabs/Social'
import Compare from './tabs/Compare'
import Connect from './tabs/Connect'
import Assistant from './tabs/Assistant'
import SignIn from './tabs/SignIn'
import Icon from './components/Icons'
import StyleGuide from './design/StyleGuide'

const TABS = [
  { id: 'store', label: 'Your store', icon: 'store' },
  { id: 'insights', label: 'Insights', icon: 'insights' },
  { id: 'actions', label: 'Actions', icon: 'actions' },
  { id: 'social', label: 'Social and email', icon: 'social' },
  { id: 'assistant', label: 'Assistant and reports', icon: 'chat' },
  { id: 'compare', label: 'Compare runs', icon: 'compare' },
  { id: 'connect', label: 'Connections', icon: 'emails' },
]

export default function App() {
  const [session, setSession] = useState(getSession)
  const [tab, setTab] = useState('store')
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
    if (session) load()
  }, [session, load])

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

  if (window.location.hash === '#design') return <StyleGuide />
  if (!session) return <SignIn onSignIn={(email) => setSession(signIn(email))} />

  const current = TABS.find((t) => t.id === tab)
  const needsRun = ['insights', 'actions', 'social'].includes(tab)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo-block"><img className="logo" src="/logo.png" alt="Atelier" /></div>
        <nav className="nav" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'nav-item active' : 'nav-item'} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="btn primary" onClick={runAgain} disabled={busy}>
            {busy ? 'Running (up to 90s)...' : 'Run again'}
          </button>
          <button className="btn" onClick={() => { signOut(); setSession(null) }}>Sign out</button>
        </div>
      </aside>
      <div className="content">
        <header className="page-head">
          <p className="caption">{USE_MOCK ? DEMO_CLIENT.name : session.email}</p>
          <h1>{tab === 'store' ? 'Welcome back' : current.label}</h1>
        </header>
        {error && <p className="error">{error}</p>}
        <main>
          {tab === 'store' && <Store run={run} />}
          {run && tab === 'insights' && <Insights run={run} />}
          {run && tab === 'actions' && <Actions run={run} onChange={load} />}
          {run && tab === 'social' && <Social run={run} onChange={load} />}
          {tab === 'assistant' && <Assistant run={run} />}
          {tab === 'compare' && <Compare runs={runs} />}
          {tab === 'connect' && <Connect email={session.email} run={run} />}
          {!run && !error && needsRun && <p className="muted">No runs yet. Click Run again to start one.</p>}
        </main>
      </div>
    </div>
  )
}
