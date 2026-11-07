import { fillShopNumbers } from '../lib/simulated'
import RevenueEstimate from '../components/RevenueEstimate'
import { ChartCard, HBar } from '../components/Charts'

const money = (n) => `$${Math.round(n).toLocaleString()}`

// Signed boutiques: a simple list. The numbers live inside each boutique's page.
export default function Clients({ clients: rawClients, onOpen }) {
  const clients = rawClients.map(fillShopNumbers)

  return (
    <>
      {!clients.length && <p className="muted">No signed boutiques yet. They appear here when a shop pays on its proposal.</p>}
      <section className="grid">
        <div className="tile lavender">
          <p className="caption">Signed shops</p>
          <p className="big">{clients.length}</p>
          <p className="muted">$5 first month</p>
        </div>
      </section>
      <div className="grid wide">
        {clients.map((c) => (
          <div className="card client-card" key={c.id}>
            <div className="comp-head">
              <div>
                <h3>{c.name}</h3>
                <p className="muted">{c.address || 'Brooklyn'} · signed {c.signed_at?.slice(0, 10) || 'date unavailable'}</p>
              </div>
              <button className="btn small" onClick={() => onOpen(c.id)}>Open boutique</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// Shown at the top of a boutique's page: last 90 days and monthly revenue.
export function ClientSnapshot({ client: rawClient }) {
  if (!rawClient) return null
  const client = fillShopNumbers(rawClient)
  const monthly = client.monthly.slice(-6).map((m) => ({ ...m, color: 'var(--purple-500)' }))
  return (
    <>
      <RevenueEstimate key={client.id} baseline={Number.isFinite(client.revenue_90d) ? client.revenue_90d / 3 : undefined} name={client.name} />
      {client.simulatedFields.length > 0 && <p className="muted">Missing store figures filled with simulated data.</p>}
      <div className="client-stats">
        <span className="pill">{client.orders_90d} orders · 90 days</span>
        <span className="pill">{money(client.revenue_90d)} · 90 days</span>
        <span className="pill">{client.repeat_rate_pct}% repeat</span>
        <span className="pill alt">{client.reports} reports</span>
      </div>
      <ChartCard title="Monthly revenue" subtitle="simulated store data" data={monthly} format={money}>
        <HBar data={monthly} format={money} />
      </ChartCard>
    </>
  )
}
