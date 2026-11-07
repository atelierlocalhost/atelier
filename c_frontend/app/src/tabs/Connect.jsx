import { useState } from 'react'
import { USE_MOCK, BASE_URL } from '../api'
import { getConnections, setConnection } from '../auth'

// Secrets never go in the browser. These keys live in the enclave's secret store.
const SERVICES = [
  { id: 'stripe', name: 'Stripe', tint: 'lavender', role: 'Payments: checkout links and coupons (test mode)', secret: 'STRIPE_SECRET_KEY' },
  { id: 'tinfoil', name: 'Tinfoil', tint: 'sky', role: 'Private inference for customer data', secret: 'TINFOIL_API_KEY' },
  { id: 'darkbloom', name: 'Darkbloom', tint: 'pink', role: 'Social and competitor copy', secret: 'DARKBLOOM_API_KEY' },
  { id: 'sie', name: 'SIE', tint: 'mint', role: 'Tagging, extraction and embeddings', secret: 'SIE_API_KEY' },
]

export default function Connect({ email }) {
  const [conn, setConn] = useState(getConnections)

  function toggle(id) {
    setConn(setConnection(id, !conn[id]))
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <p className="caption">Signed in as</p>
        <h3>{email}</h3>
        <p className="muted">API: {BASE_URL}{USE_MOCK ? ' (mock mode, nothing is called)' : ''}</p>
      </div>
      <section className="grid wide">
        {SERVICES.map((s) => (
          <div className={`tile ${s.tint}`} key={s.id}>
            <div className="comp-head">
              <h3 style={{ margin: 0 }}>{s.name}</h3>
              <span className={conn[s.id] ? 'pill ok' : 'pill'}>{conn[s.id] ? 'Connected' : 'Not connected'}</span>
            </div>
            <p>{s.role}</p>
            <p className="muted">Key is stored server-side as <code>{s.secret}</code>, never in this page.</p>
            <button className={conn[s.id] ? 'btn' : 'btn primary'} onClick={() => toggle(s.id)} disabled={!USE_MOCK}>
              {conn[s.id] ? 'Disconnect' : s.id === 'stripe' ? 'Connect payments' : 'Connect'}
            </button>
          </div>
        ))}
      </section>
      {!USE_MOCK && (
        <p className="muted">
          Connections are managed on the server for now. A connect and status endpoint is needed in the API contract
          before these buttons can act on the live backend.
        </p>
      )}
    </>
  )
}
