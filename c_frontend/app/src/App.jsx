import { useCallback, useEffect, useState } from 'react'
import { getClients, getLatestRun, getRun, getRuns, startRun, USE_MOCK } from './api'
import { DEMO_CLIENT } from './demoClient'
import { getSession } from './auth'
import Store from './tabs/Store'
import Insights from './tabs/Insights'
import Actions from './tabs/Actions'
import Social from './tabs/Social'
import Compare from './tabs/Compare'
import Connect from './tabs/Connect'
import Assistant from './tabs/Assistant'
import LabTab from './tabs/LabTab'
import TrendDrive from './tabs/TrendDrive'
import Clients, { ClientSnapshot } from './tabs/Clients'
import WeeklyReports from './tabs/WeeklyReports'
import Icon from './components/Icons'
import StyleGuide from './design/StyleGuide'

// Left menu: the studio only. A signed boutique opens as one long page with every section.
const STUDIO_TABS = [
  { id: 'trend', label: 'Trend Drive', icon: 'search' },
  { id: 'clients', label: 'Signed boutiques', icon: 'clients' },
]
const SHOP_SECTIONS = [
  { id: 'store', label: 'Overview' },
  { id: 'insights', label: 'Insights' },
  { id: 'actions', label: 'Actions' },
  { id: 'social', label: 'Social and email' },
  { id: 'lab', label: 'Shopper lab' },
  { id: 'assistant', label: 'Assistant and reports' },
  { id: 'compare', label: 'Compare runs' },
  { id: 'reports', label: 'Weekly reports' },
  { id: 'connect', label: 'Connections' },
]
const hashClient = () => (window.location.hash.match(/client=([\w-]+)/) || [])[1] || null

export default function App() {
  // No sign-in page: the dashboard opens directly (operator view).
  const [session] = useState(() => getSession() || { email: 'operator' })
  const [tab, setTab] = useState(() => (hashClient() ? 'shop' : 'trend'))
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(hashClient)
  const [run, setRun] = useState(null)
  const [runs, setRuns] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const list = await getClients()
      setClients(list)
      const id = clientId || list[0]?.id || null
      if (!clientId && id) setClientId(id)
      if (!id && !USE_MOCK) {
        setRun(null)
        setRuns([])
        return
      }
      const latest = await getLatestRun(id)
      setRun(latest)
      if (latest) {
        // Compare the two most recent completed runs for this boutique.
        const ids = (await getRuns(id)).map((r) => r.run_id).slice(-2)
        const prev = ids.length === 2 && ids[1] === latest.run_id ? await getRun(ids[0]) : null
        setRuns(prev ? [prev, latest] : [latest])
      } else {
        setRuns([])
      }
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [clientId])

  useEffect(() => {
    if (session) load()
  }, [session, load])

  async function runAgain() {
    setBusy(true)
    try {
      const next = await startRun(undefined, clientId)
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

  const client = clients.find((c) => c.id === clientId)
  const clientName = run?.client?.name || client?.name || (USE_MOCK ? DEMO_CLIENT.name : '')
  const go = (id) => {
    window.location.hash = ''
    setTab(id)
    // Shops can sign at any time (their proposal page): always show the current list.
    if (id === 'clients') getClients().then(setClients).catch((e) => setError(e.message))
  }
  const openShop = (id) => {
    window.location.hash = `client=${id}`
    setClientId(id)
    setRun(null)
    setTab('shop')
    window.scrollTo(0, 0)
  }
  const shop = tab === 'shop'
  const heading = shop ? clientName : STUDIO_TABS.find((t) => t.id === tab).label

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo-block"><img className="logo" src="/logo.png" alt="Atelier" /></div>
        <nav className="nav" aria-label="Main">
          {STUDIO_TABS.map((t) => (
            <button key={t.id} className={t.id === tab || (shop && t.id === 'clients') ? 'nav-item active' : 'nav-item'} onClick={() => go(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="content">
        <header className="page-head shop-head">
          <div>
            <p className="caption">{shop ? 'Signed boutique' : 'Maison Sovereign studio'}</p>
            <h1>{heading}</h1>
          </div>
          {shop && (
            <div className="head-actions">
              <button className="btn" onClick={() => go('clients')}>← All boutiques</button>
            </div>
          )}
        </header>
        {error && <p className="error">{error}</p>}
        <main>
          {tab === 'trend' && <TrendDrive />}
          {tab === 'clients' && <Clients clients={clients} onOpen={openShop} />}
          {shop && (
            <>
              <nav className="chips section-nav" aria-label="Sections">
                {SHOP_SECTIONS.map((x) => <a key={x.id} className="pill" href={`#client=${clientId}`} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${x.id}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{x.label}</a>)}
              </nav>
              {!run && <p className="muted">No runs yet for this boutique. Click Run again to start one.</p>}
              <section id="sec-store" className="shop-section">
                <Store run={run} name={clientName} website={run?.client?.website || client?.website} />
                <ClientSnapshot client={client} />
              </section>
              {run && (
                <>
                  <section id="sec-insights" className="shop-section"><h2>Insights</h2><Insights run={run} /></section>
                  <section id="sec-actions" className="shop-section"><h2>Actions</h2><Actions run={run} onChange={load} /></section>
                  <section id="sec-social" className="shop-section"><h2>Social and email</h2><Social run={run} onChange={load} /></section>
                </>
              )}
              <section id="sec-lab" className="shop-section"><h2>Shopper lab</h2><LabTab clientId={clientId} /></section>
              <section id="sec-assistant" className="shop-section"><h2>Assistant and reports</h2><Assistant run={run} /></section>
              <section id="sec-compare" className="shop-section"><h2>Compare runs</h2><Compare runs={runs} /></section>
              <section id="sec-reports" className="shop-section"><h2>Weekly reports</h2><WeeklyReports client={client} /></section>
              <section id="sec-connect" className="shop-section"><h2>Connections</h2><Connect /></section>
            </>
          )}
        </main>
      </div>
      {shop && (
        <button className="btn primary fab" onClick={runAgain} disabled={busy || (!USE_MOCK && !clientId)}>
          {busy ? 'Running (up to 90s)...' : 'Run again'}
        </button>
      )}
    </div>
  )
}
