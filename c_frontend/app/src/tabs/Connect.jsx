import { useEffect, useState } from 'react'
import { USE_MOCK, BASE_URL, getConnectionStatus } from '../api'
import { getConnections, setConnection } from '../auth'

// Secrets never go in the browser. These keys live in the enclave's secret store.
const SERVICES = [
  { id: 'stripe', name: 'Stripe', tint: 'lavender', role: 'Payments: checkout links and coupons (test mode)', secret: 'STRIPE_SECRET_KEY' },
  { id: 'tinfoil', name: 'Tinfoil', tint: 'sky', role: 'Private inference for customer data', secret: 'TINFOIL_API_KEY' },
  { id: 'sie', name: 'SIE', tint: 'mint', role: 'Tagging, extraction and embeddings', secret: 'SIE_API_KEY' },
  { id: 'gmail', name: 'Gmail', tint: 'peach', role: 'Sends proposals and weekly reports', secret: 'GMAIL_APP_PASSWORD' },
]

export default function Connect() {
  const [conn, setConn] = useState(getConnections)
  const [live, setLive] = useState(null)
  useEffect(() => {
    getConnectionStatus().then(setLive).catch(() => setLive(null))
  }, [])
  // Real mode shows what the server actually has; mock mode keeps the demo toggles.
  const isOn = (id) => (live ? !!live[id] : !!conn[id])

  function toggle(id) {
    setConn(setConnection(id, !conn[id]))
  }

  return (
    <>
      <p className="muted">API: {BASE_URL}{USE_MOCK ? ' (mock mode, nothing is called)' : ''}</p>
      <section className="grid wide">
        {SERVICES.map((s) => (
          <div className={`tile ${s.tint}`} key={s.id}>
            <div className="comp-head">
              <h3 style={{ margin: 0 }}>{s.name}</h3>
              <span className={isOn(s.id) ? 'pill ok' : 'pill'}>{isOn(s.id) ? 'Connected' : live && s.id === 'stripe' ? 'Placeholder' : 'Not connected'}</span>
            </div>
            <p>{s.role}</p>
            <p className="muted">Key is stored server-side as <code>{s.secret}</code>, never in this page.</p>
            {USE_MOCK ? (
              <button className={conn[s.id] ? 'btn' : 'btn primary'} onClick={() => toggle(s.id)}>
                {conn[s.id] ? 'Disconnect' : s.id === 'stripe' ? 'Connect payments' : 'Connect'}
              </button>
            ) : (
              <p className="muted">{isOn(s.id) ? 'Key is set on the server.' : `Add ${s.secret} to the server .env to connect.`}</p>
            )}
          </div>
        ))}
      </section>
    </>
  )
}
