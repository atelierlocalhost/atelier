import { useState } from 'react'
import { ChartCard, HBar, Donut } from './Charts'
import { segMark } from '../design/palette'
import { parseMemory } from '../tabs/MailingList'

const METRICS = {
  customers: { label: 'Customers', get: (s) => s.count, fmt: (n) => n.toLocaleString(), donut: true },
  revenue: { label: 'Revenue', get: (s) => Math.round(s.count * s.avg_spend), fmt: (n) => `$${n.toLocaleString()}`, donut: true },
  spend: { label: 'Avg spend', get: (s) => s.avg_spend, fmt: (n) => `$${n.toFixed(0)}`, donut: false },
}

const money = (n) => `$${Math.round(n).toLocaleString()}`

// Pick a metric, click a slice or bar, and the panel breaks that segment down.
export default function SegmentExplorer({ run }) {
  const [metric, setMetric] = useState('customers')
  const [selected, setSelected] = useState(null)
  const segs = run.insights.segments
  const m = METRICS[metric]
  const data = segs.map((s) => ({ name: s.name, value: m.get(s), color: segMark(s.name) }))
  const toggle = (n) => setSelected(selected === n ? null : n)

  const totalCust = segs.reduce((n, s) => n + s.count, 0)
  const totalRev = segs.reduce((n, s) => n + s.count * s.avg_spend, 0)
  const sel = segs.find((s) => s.name === selected)
  const actions = run.actions.filter((a) => a.segment === selected)
  const past = parseMemory(run.memory_used).filter((p) => p.segment === selected)

  return (
    <section className="cols explorer">
      <div className="card chart-card">
        <div className="chart-head">
          <div>
            <h3>Segment breakdown</h3>
            <p className="muted">Click a segment for details</p>
          </div>
          <div className="seg-toggle" role="group" aria-label="Metric">
            {Object.entries(METRICS).map(([k, v]) => (
              <button key={k} className={k === metric ? 'btn small primary' : 'btn small'} onClick={() => setMetric(k)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {m.donut ? (
          <Donut data={data} format={m.fmt} centerLabel="total" selected={selected} onSelect={toggle} />
        ) : (
          <HBar data={data} format={m.fmt} selected={selected} onSelect={toggle} />
        )}
      </div>

      <div className="card detail">
        {!sel ? (
          <>
            <h3>Pick a segment</h3>
            <p className="muted">Select a slice or bar to see its share, the actions proposed for it and what worked before.</p>
          </>
        ) : (
          <>
            <div className="comp-head">
              <h3 style={{ margin: 0 }}>{sel.name}</h3>
              <button className="btn small" onClick={() => setSelected(null)}>Clear</button>
            </div>
            <div className="detail-stats">
              <div><p className="caption">Customers</p><p className="big small-big">{sel.count}</p><p className="muted">{Math.round((sel.count / totalCust) * 100)}% of list</p></div>
              <div><p className="caption">Revenue</p><p className="big small-big">{money(sel.count * sel.avg_spend)}</p><p className="muted">{Math.round(((sel.count * sel.avg_spend) / totalRev) * 100)}% of total</p></div>
              <div><p className="caption">Avg spend</p><p className="big small-big">{money(sel.avg_spend)}</p><p className="muted">overall {money(totalRev / totalCust)}</p></div>
            </div>
            <h4>Proposed actions</h4>
            {actions.length === 0 ? <p className="muted">None for this segment.</p> : (
              <ul>{actions.map((a) => <li key={a.id}>{a.title} <span className="pill">{a.status}</span></li>)}</ul>
            )}
            <h4>What worked before</h4>
            {past.length === 0 ? <p className="muted">No recorded results for this segment yet.</p> : (
              <ul>{past.map((p) => <li key={p.name}>{p.name}: {p.value}% {p.metric}</li>)}</ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}
