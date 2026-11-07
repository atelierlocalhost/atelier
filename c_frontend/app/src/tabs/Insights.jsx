import CompetitorCard from '../components/CompetitorCard'

export default function Insights({ run }) {
  const { segments, working, fix } = run.insights
  return (
    <>
      <section className="grid">
        {segments.map((s) => (
          <div className="card" key={s.name}>
            <p className="muted">{s.name}</p>
            <p className="big">{s.count}</p>
            <p className="muted">avg spend ${s.avg_spend.toFixed(2)}</p>
          </div>
        ))}
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
      <section>
        <h3>Competitors</h3>
        <div className="grid wide">
          {run.competitors.map((c) => <CompetitorCard key={c.url} c={c} />)}
        </div>
      </section>
    </>
  )
}
