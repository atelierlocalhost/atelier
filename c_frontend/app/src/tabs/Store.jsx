import { useEffect, useState } from 'react'
import { getCosts, storeUrl, USE_MOCK } from '../api'
import { DEMO_CLIENT } from '../demoClient'
import { ChartCard, HBar } from '../components/Charts'
import { segMark } from '../design/palette'
import DrillDonut from '../components/DrillDonut'

const money = (n) => `$${Math.round(n).toLocaleString()}`

function Tile({ tint, label, value, sub }) {
  return (
    <div className={`tile ${tint}`}>
      <p className="caption">{label}</p>
      <p className="big">{value}</p>
      <p className="muted">{sub}</p>
    </div>
  )
}

export default function Store({ run }) {
  const url = storeUrl()
  const [costs, setCosts] = useState(null)
  useEffect(() => {
    if (run) getCosts(run.run_id).then(setCosts).catch(() => setCosts(null))
  }, [run])

  if (!run) return <p className="muted">No stats yet. Click Run again to analyze your store.</p>

  const segs = run.insights.segments
  const by = (n) => segs.find((s) => s.name === n)
  const customers = segs.reduce((n, s) => n + s.count, 0)
  const revenue = segs.reduce((n, s) => n + s.count * s.avg_spend, 0)
  const repeat = (by('Champions')?.count || 0) + (by('Loyal')?.count || 0)
  const pending = run.actions.filter((a) => a.status === 'proposed').length
  const revData = segs.map((s) => ({ name: s.name, value: Math.round(s.count * s.avg_spend), color: segMark(s.name) }))

  return (
    <>
      <div className="card hero">
        <div>
          <h2>{USE_MOCK ? DEMO_CLIENT.name : 'Your store'} at a glance</h2>
          <p>{customers} customers, {money(revenue)} in lifetime revenue, {pending} actions waiting for you.</p>
        </div>
      </div>
      <section className="grid">
        <Tile tint="lavender" label="Customers" value={customers} sub={`${by('New')?.count ?? 0} new recently`} />
        <Tile tint="peach" label="Lifetime revenue" value={money(revenue)} sub={`${money(revenue / customers)} per customer`} />
        <Tile tint="sky" label="Repeat buyers" value={`${Math.round((repeat / customers) * 100)}%`} sub="Champions and Loyal" />
        <Tile tint="pink" label="At risk" value={by('At risk')?.count ?? 0} sub="need a win-back" />
      </section>
      <section className="cols">
        <ChartCard title="Revenue by segment" subtitle="Lifetime, USD" data={revData} format={money}>
          <HBar data={revData} format={money} />
        </ChartCard>
        {costs && (
          <ChartCard
            title="Cost per run"
            subtitle={`${Math.round(costs.savings_pct)}% cheaper than a frontier model`}
            data={[
              { name: 'Atelier', value: costs.total_usd },
              { name: 'Frontier model', value: costs.frontier_equiv_usd },
            ]}
            format={(n) => `$${n.toFixed(3)}`}
          >
            <HBar
              data={[
                { name: 'Atelier', value: costs.total_usd, color: 'var(--seg-champions)' },
                { name: 'Frontier model', value: costs.frontier_equiv_usd, color: 'var(--seg-loyal)' },
              ]}
              format={(n) => `$${n.toFixed(3)}`}
            />
            <p className="muted" style={{ marginTop: 'var(--space-3)' }}>
              {costs.providers.map((p) => `${p.provider} $${p.usd.toFixed(3)}`).join(' · ')}
            </p>
          </ChartCard>
        )}
      </section>
      <section className="cols">
        <DrillDonut
          title="Actions by status"
          subtitle="Where your plan stands"
          centerLabel="actions"
          data={['proposed', 'approved', 'applied'].map((st, i) => ({
            name: st,
            value: run.actions.filter((a) => a.status === st).length,
            color: ['var(--seg-atrisk)', 'var(--seg-loyal)', 'var(--seg-new)'][i],
          })).filter((d) => d.value > 0)}
          renderDetail={(st) => (
            <ul>{run.actions.filter((a) => a.status === st).map((a) => <li key={a.id}>{a.title} <span className="pill">{a.segment}</span></li>)}</ul>
          )}
        />
        {costs && (
          <DrillDonut
            title="Where the spend goes"
            subtitle="Cost per run by provider"
            centerLabel="per run"
            format={(n) => `$${n.toFixed(3)}`}
            data={costs.providers.map((p, i) => ({ name: p.provider, value: p.usd, color: ['var(--seg-champions)', 'var(--seg-loyal)', 'var(--seg-new)'][i % 3] }))}
            renderDetail={(name) => {
              const p = costs.providers.find((x) => x.provider === name)
              return <p>{p.calls} calls · {p.tokens.toLocaleString()} tokens · ${p.usd.toFixed(3)}{p.model ? ` · ${p.model}` : ''}</p>
            }}
          />
        )}
      </section>
      <h2>Storefront</h2>
      {url && (
        <>
          <iframe className="store-frame" src={url} title="Storefront" referrerPolicy="no-referrer" />
          <p className="muted">
            Blank? Some sites block previews. <a href={url} target="_blank" rel="noopener noreferrer">Open the store in a new tab</a>.
          </p>
        </>
      )}
    </>
  )
}
