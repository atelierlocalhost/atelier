import { useState } from 'react'
import { ChartCard, HBar } from '../components/Charts'
import { segMark } from '../design/palette'
import { parseMemory } from '../lib/memory'

// SAMPLE history so the page is useful before the backend stores campaign results.
const SAMPLE = [
  { name: 'Free shipping weekend', segment: 'Loyal', value: 9, metric: 'redeemed' },
  { name: 'Welcome series email', segment: 'New', value: 14, metric: 'opened and bought' },
  { name: 'Seasonal 20% off', segment: 'Hibernating', value: 3, metric: 'redeemed' },
  { name: 'VIP early access', segment: 'Champions', value: 18, metric: 'redeemed' },
].map((s) => ({ ...s, source: 'sample' }))

export default function MailingList({ run }) {
  const [pick, setPick] = useState(null)
  const segs = run.insights.segments
  const total = segs.reduce((n, s) => n + s.count, 0)
  const subs = segs.map((s) => ({ name: s.name, value: s.count, color: segMark(s.name) }))
  const real = parseMemory(run.memory_used)
  const past = [...real, ...SAMPLE].sort((a, b) => b.value - a.value)
  const chart = past.map((p) => ({ name: p.name.slice(0, 22), value: p.value, color: segMark(p.segment) }))
  const best = past[0]
  const weak = past.filter((p) => p.value <= 3)

  return (
    <>
      <h2>Mailing list</h2>
      <section className="cols">
        <ChartCard title="Subscribers by segment" subtitle={`${total} customers on your list`} data={subs}>
          <HBar data={subs} />
        </ChartCard>
        <div className="card memory">
          <h3>What has worked before</h3>
          <ul>
            <li>Best result: <strong>{best.name}</strong> to {best.segment}, {best.value}% {best.metric}.</li>
            {weak.length > 0 && <li>Weak: {weak.map((w) => `${w.name} (${w.value}%)`).join(', ')}. Send fewer of these.</li>}
            {real.length === 0 && <li>Atelier has no learned results yet. The next run will start from what you approve here.</li>}
          </ul>
        </div>
      </section>

      <ChartCard title="Past campaigns and promos" subtitle="Redemption or conversion rate" data={past.map((p) => ({ name: p.name, value: p.value }))} format={(n) => `${n}%`}>
        <HBar data={chart} format={(n) => `${n}%`} selected={pick} onSelect={(n) => setPick(pick === n ? null : n)} />
      </ChartCard>
      {pick && (() => {
        const p = past.find((x) => x.name.slice(0, 22) === pick)
        const avg = past.reduce((n, x) => n + x.value, 0) / past.length
        return p && (
          <div className="card memory" style={{ marginTop: 'var(--space-3)' }}>
            <h3>{p.name}</h3>
            <p>Sent to {p.segment}: {p.value}% {p.metric}. That is {p.value >= avg ? 'above' : 'below'} your {avg.toFixed(1)}% average across campaigns.</p>
            <p className="muted">{p.source === 'memory' ? 'Recorded by the Strategy agent.' : 'Sample data.'}</p>
          </div>
        )
      })()}
      <div className="card" style={{ marginTop: 'var(--space-3)' }}>
        <table className="data-table history">
          <thead>
            <tr><th>Campaign</th><th>Segment</th><th>Result</th><th>Source</th></tr>
          </thead>
          <tbody>
            {past.map((p) => (
              <tr key={p.name + p.segment}>
                <th>{p.name}</th>
                <td>{p.segment}</td>
                <td>{p.value}% {p.metric}</td>
                <td><span className={p.source === 'memory' ? 'pill ok' : 'pill alt'}>{p.source === 'memory' ? 'From memory' : 'Sample data'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">"From memory" rows are real outcomes the Strategy agent recorded. Sample rows are placeholders until past campaigns are stored.</p>
      </div>
    </>
  )
}
