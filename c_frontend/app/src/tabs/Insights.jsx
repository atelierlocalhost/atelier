import CompetitorCard from '../components/CompetitorCard'
import { ChartCard, HBar, Donut } from '../components/Charts'
import { segMark, segTint } from '../design/palette'

const TINTS = { 'var(--tint-lavender)': 'lavender', 'var(--tint-sky)': 'sky', 'var(--tint-mint)': 'mint', 'var(--tint-peach)': 'peach', 'var(--tint-pink)': 'pink' }

export default function Insights({ run }) {
  const { segments, working, fix } = run.insights
  const counts = segments.map((s) => ({ name: s.name, value: s.count, color: segMark(s.name) }))
  const rev = segments.map((s) => ({ name: s.name, value: Math.round(s.count * s.avg_spend), color: segMark(s.name) }))
  return (
    <>
      <section className="grid five">
        {segments.map((s) => (
          <div className={`tile ${TINTS[segTint(s.name)] || 'butter'}`} key={s.name}>
            <p className="caption">{s.name}</p>
            <p className="big">{s.count}</p>
            <p className="muted">avg spend ${s.avg_spend.toFixed(2)}</p>
          </div>
        ))}
      </section>
      <section className="cols">
        <ChartCard title="Customers by segment" data={counts}>
          <HBar data={counts} />
        </ChartCard>
        <ChartCard title="Revenue share" subtitle="Lifetime, by segment" data={rev} format={(n) => `$${n.toLocaleString()}`}>
          <Donut data={rev} format={(n) => `$${n.toLocaleString()}`} centerLabel="total" />
        </ChartCard>
      </section>
      <section className="cols">
        <div className="card good">
          <h3>What's working</h3>
          <ul>{working.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
        <div className="card bad">
          <h3>What to fix</h3>
          <ul>{fix.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      </section>
      <h2>Competitors</h2>
      <div className="grid wide">
        {run.competitors.map((c) => <CompetitorCard key={c.url} c={c} />)}
      </div>
    </>
  )
}
