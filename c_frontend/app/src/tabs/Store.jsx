import { storeUrl } from '../api'

const money = (n) => `$${Math.round(n).toLocaleString()}`

function stats(run) {
  const segs = run.insights.segments
  const by = (name) => segs.find((s) => s.name === name)
  const customers = segs.reduce((n, s) => n + s.count, 0)
  const revenue = segs.reduce((n, s) => n + s.count * s.avg_spend, 0)
  const repeat = (by('Champions')?.count || 0) + (by('Loyal')?.count || 0)
  const top = [...segs].sort((a, b) => b.count * b.avg_spend - a.count * a.avg_spend)[0]
  return { customers, revenue, repeat, top, atRisk: by('At risk'), fresh: by('New') }
}

function Tile({ label, value, sub }) {
  return (
    <div className="card">
      <p className="muted">{label}</p>
      <p className="big">{value}</p>
      {sub && <p className="muted">{sub}</p>}
    </div>
  )
}

export default function Store({ run }) {
  const url = storeUrl()
  const s = run && stats(run)
  const pending = run ? run.actions.filter((a) => a.status === 'proposed').length : 0
  const gap = run?.competitors[0]

  return (
    <>
      <h2>Your store</h2>
      {s ? (
        <>
          <section className="grid">
            <Tile label="Customers" value={s.customers} sub={`${s.fresh?.count ?? 0} new recently`} />
            <Tile label="Lifetime revenue" value={money(s.revenue)} sub={`${money(s.revenue / s.customers)} per customer`} />
            <Tile label="Repeat buyers" value={`${Math.round((s.repeat / s.customers) * 100)}%`} sub="Champions + Loyal" />
            <Tile label="At risk" value={s.atRisk?.count ?? 0} sub="need a win-back" />
            <Tile label="Open actions" value={pending} sub="waiting for approval" />
            {gap && <Tile label="Price vs competitor" value={`${gap.price_gap_pct}%`} sub={gap.name} />}
          </section>
          <section className="card">
            <h3>Overview</h3>
            <ul>
              <li>Best segment: {s.top.name} ({s.top.count} customers, {money(s.top.count * s.top.avg_spend)} lifetime).</li>
              {run.insights.working[0] && <li>Working: {run.insights.working[0]}</li>}
              {run.insights.fix[0] && <li>Fix first: {run.insights.fix[0]}</li>}
              {pending > 0 && <li>{pending} proposed actions are ready on the Actions tab.</li>}
            </ul>
          </section>
        </>
      ) : (
        <p className="muted">No stats yet. Click Run again to analyze your store.</p>
      )}
      <h3>Storefront</h3>
      {url ? (
        <iframe className="store-frame" src={url} title="Storefront" />
      ) : (
        <p className="muted">Storefront preview needs the live API. Set VITE_USE_MOCK=false.</p>
      )}
    </>
  )
}
