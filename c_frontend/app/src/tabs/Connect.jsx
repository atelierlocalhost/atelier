import { useEffect, useState } from 'react'
import { USE_MOCK, BASE_URL, getCosts } from '../api'
import { ChartCard, HBar } from '../components/Charts'
import DrillDonut from '../components/DrillDonut'
import { getConnections, setConnection } from '../auth'

// Secrets never go in the browser. These keys live in the enclave's secret store.
const SERVICES = [
  { id: 'stripe', name: 'Stripe', tint: 'lavender', role: 'Payments: checkout links and coupons (test mode)', secret: 'STRIPE_SECRET_KEY' },
  { id: 'tinfoil', name: 'Tinfoil', tint: 'sky', role: 'Private inference for customer data', secret: 'TINFOIL_API_KEY' },
  { id: 'sie', name: 'SIE', tint: 'mint', role: 'Tagging, extraction and embeddings', secret: 'SIE_API_KEY' },
]

const COLORS = ['var(--seg-champions)', 'var(--seg-loyal)', 'var(--seg-new)']

// From the project plan: run order, which provider handles each agent, and Cognee memory permissions.
const AGENTS = [
  { name: 'Insights', provider: 'Tinfoil (private)', memory: 'Reads and writes customers, outcomes' },
  { name: 'Competitor', provider: 'Tinfoil + SIE', memory: 'Writes competitors only' },
  { name: 'Strategy', provider: 'Tinfoil (private)', memory: 'Reads and writes customers, outcomes' },
  { name: 'Social', provider: 'Tinfoil (private)', memory: 'Reads brand and outcomes, never customers' },
]

export default function Connect({ email, run }) {
  const [conn, setConn] = useState(getConnections)
  const [costs, setCosts] = useState(null)
  useEffect(() => {
    getCosts(run?.run_id).then(setCosts).catch(() => setCosts(null))
  }, [run])
  const usd = (n) => `$${n.toFixed(3)}`

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
      <h2>Agents</h2>
      <div className="card">
        <table className="data-table history">
          <thead><tr><th>Order</th><th>Agent</th><th>Runs on</th><th>Memory access</th></tr></thead>
          <tbody>
            {AGENTS.map((g, i) => (
              <tr key={g.name}><td>{i + 1}</td><th>{g.name}</th><td>{g.provider}</td><td>{g.memory}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Customer data only goes to the private enclave. Social never reads customers. What the agents learned is shown on the Actions tab.</p>
      </div>
      {costs && (
        <>
          <h2>Usage and cost</h2>
          <section className="cols">
            <ChartCard
              title="Cost per run"
              subtitle={`${Math.round(costs.savings_pct)}% cheaper than a frontier model`}
              data={[{ name: 'Atelier', value: costs.total_usd }, { name: 'Frontier model', value: costs.frontier_equiv_usd }]}
              format={usd}
            >
              <HBar
                data={[
                  { name: 'Atelier', value: costs.total_usd, color: 'var(--seg-champions)' },
                  { name: 'Frontier model', value: costs.frontier_equiv_usd, color: 'var(--seg-loyal)' },
                ]}
                format={usd}
              />
            </ChartCard>
            <DrillDonut
              title="Where the spend goes"
              subtitle="Cost per run by provider"
              centerLabel="per run"
              format={usd}
              data={costs.providers.map((p, i) => ({ name: p.provider, value: p.usd, color: COLORS[i % 3] }))}
              renderDetail={(name) => {
                const p = costs.providers.find((x) => x.provider === name)
                return <p>{p.calls} calls · {p.tokens.toLocaleString()} tokens · {usd(p.usd)}{p.model ? ` · ${p.model}` : ''}</p>
              }}
            />
          </section>
        </>
      )}
      {!USE_MOCK && (
        <p className="muted">
          Connections are managed on the server for now. A connect and status endpoint is needed in the API contract
          before these buttons can act on the live backend.
        </p>
      )}
    </>
  )
}
