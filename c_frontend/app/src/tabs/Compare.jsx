import { ChartCard, GroupedBars } from '../components/Charts'
import { segMark } from '../design/palette'
import { parseMemory } from '../lib/memory'

const money = (n) => `$${Math.round(n).toLocaleString()}`
const sign = (n) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString())
const signMoney = (n) => `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`

// Name a run by what happened in it, not by its id.
export function runName(run, isFirst) {
  const done = parseMemory(run.memory_used).map((m) => m.name)
  if (isFirst || done.length === 0) return 'Baseline, before any campaign'
  return `After ${done.slice(0, 2).join(' and ').toLowerCase()}`
}

const totals = (run) => {
  const segs = run.insights.segments
  return { customers: segs.reduce((n, s) => n + s.count, 0), revenue: segs.reduce((n, s) => n + s.count * s.avg_spend, 0) }
}

function Tile({ tint, label, value, sub }) {
  return <div className={`tile ${tint}`}><p className="caption">{label}</p><p className="big">{value}</p><p className="muted">{sub}</p></div>
}

export default function Compare({ runs }) {
  if (runs.length < 2) {
    return <p className="muted">Only one run so far. Approve actions, then click Run again to see what changed.</p>
  }
  const [a, b] = runs.slice(-2)
  const nameA = runName(a, true)
  const nameB = runName(b, false)
  const ta = totals(a), tb = totals(b)
  const seg = (run, n) => run.insights.segments.find((s) => s.name === n) || { count: 0, avg_spend: 0 }
  const names = b.insights.segments.map((s) => s.name)
  const rows = names.map((n) => ({ name: n, color: segMark(n), before: seg(a, n).count, after: seg(b, n).count }))

  const worked = parseMemory(b.memory_used).filter((m) => m.value >= 5)
  const flopped = parseMemory(b.memory_used).filter((m) => m.value < 5)
  const titleSet = (r) => new Set(r.actions.map((x) => x.title))
  const added = b.actions.filter((x) => !titleSet(a).has(x.title))
  const dropped = a.actions.filter((x) => !titleSet(b).has(x.title))

  const atRisk = seg(b, 'At risk').count - seg(a, 'At risk').count
  const fresh = seg(b, 'New').count - seg(a, 'New').count
  const loyal = seg(b, 'Loyal').count + seg(b, 'Champions').count - seg(a, 'Loyal').count - seg(a, 'Champions').count
  const hib = seg(b, 'Hibernating').count - seg(a, 'Hibernating').count

  return (
    <>
      <section className="cols">
        <div className="card"><p className="caption">Before</p><h3>{nameA}</h3><p className="muted">{a.run_id}</p></div>
        <div className="card"><p className="caption">After</p><h3>{nameB}</h3><p className="muted">{b.run_id}</p></div>
      </section>

      <section className="grid">
        <Tile tint="lavender" label="Customers" value={sign(tb.customers - ta.customers)} sub={`${ta.customers.toLocaleString()} to ${tb.customers.toLocaleString()}`} />
        <Tile tint="peach" label="Lifetime revenue" value={signMoney(tb.revenue - ta.revenue)} sub={`${money(ta.revenue)} to ${money(tb.revenue)}`} />
        <Tile tint="mint" label="New customers" value={sign(fresh)} sub="attracted since the last run" />
        <Tile tint="pink" label="At risk" value={sign(atRisk)} sub={atRisk < 0 ? 'fewer lapsing' : 'more lapsing'} />
      </section>

      <section className="cols">
        <ChartCard title="Customer profile, before and after" subtitle="Customers per segment. Pale bar is before." data={rows.map((r) => ({ name: r.name, value: r.after }))}>
          <GroupedBars rows={rows} />
        </ChartCard>
        <div className="card">
          <h3>How the customer profile changed</h3>
          <table className="data-table history">
            <thead><tr><th>Segment</th><th>Customers</th><th>Avg spend</th></tr></thead>
            <tbody>
              {names.map((n) => (
                <tr key={n}>
                  <th>{n}</th>
                  <td>{seg(a, n).count} to {seg(b, n).count} ({sign(seg(b, n).count - seg(a, n).count)})</td>
                  <td>{money(seg(a, n).avg_spend)} to {money(seg(b, n).avg_spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cols">
        <div className="card good">
          <h3>What worked</h3>
          {worked.length === 0 ? <p className="muted">No campaign beat 5% yet.</p> : (
            <ul>{worked.map((m) => <li key={m.name}><strong>{m.name}</strong> to {m.segment}: {m.value}% {m.metric}.</li>)}</ul>
          )}
          <p>{atRisk < 0 ? `At risk fell by ${Math.abs(atRisk)}, so some lapsed customers came back.` : 'At risk did not shrink.'} {loyal > 0 && `Loyal and Champions grew by ${loyal}.`}</p>
        </div>
        <div className="card bad">
          <h3>What did not work</h3>
          {flopped.length === 0 ? <p className="muted">No weak campaigns recorded.</p> : (
            <ul>{flopped.map((m) => <li key={m.name}><strong>{m.name}</strong> to {m.segment}: only {m.value}% {m.metric}.</li>)}</ul>
          )}
          <p>{hib >= 0 ? 'Hibernating did not shrink, so that group needs a different offer.' : `Hibernating shrank by ${Math.abs(hib)}.`}</p>
        </div>
      </section>

      <div className="card memory">
        <h3>What changed in the plan</h3>
        {added.length === 0 && dropped.length === 0 ? <p className="muted">The plan is the same as last time.</p> : (
          <ul>
            {added.map((x) => <li key={x.id}><strong>Added:</strong> {x.title} <span className="pill">{x.segment}</span><p className="muted">{x.why}</p></li>)}
            {dropped.map((x) => <li key={x.id}><strong>Dropped:</strong> {x.title} <span className="pill">{x.segment}</span></li>)}
          </ul>
        )}
        <p className="muted">Movement between segments follows the campaigns but is not proof they caused it. Other factors can contribute.</p>
      </div>
    </>
  )
}
