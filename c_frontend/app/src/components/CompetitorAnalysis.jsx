import { analyse, benchmark } from '../lib/competitors'
import { BOA_METRICS } from '../demoData'
import { OWN_OFFERS } from '../demoClient'
import { USE_MOCK } from '../api'

const PILL = { 'They lead': 'pill alt', 'You lead': 'pill ok', 'Both offer': 'pill', 'Check yours': 'pill' }

export default function CompetitorAnalysis({ run }) {
  const own = USE_MOCK ? OWN_OFFERS : {}
  return (
    <>
      <h2>Competitor analysis</h2>
      {run.competitors.map((c) => {
        const rows = analyse(c, own)
        const behind = rows.filter((r) => r.status === 'They lead')
        const ahead = rows.filter((r) => r.status === 'You lead')
        return (
          <section key={c.url} className="stack">
            <h3 style={{ marginBottom: 0 }}>{c.name}</h3>
            <div className="cols">
              <div className="card bad">
                <h3>What they do better</h3>
                {behind.length === 0 ? <p className="muted">Nothing clear from their current promos.</p> : (
                  <ul>{behind.map((r) => <li key={r.mechanic}><strong>{r.mechanic}:</strong> {r.theirs}. You: {r.yours}.</li>)}</ul>
                )}
              </div>
              <div className="card good">
                <h3>Where you are ahead</h3>
                {ahead.length === 0 ? <p className="muted">No clear lead from the offers we can see.</p> : (
                  <ul>{ahead.map((r) => <li key={r.mechanic}><strong>{r.mechanic}:</strong> {r.yours}. They: {r.theirs}.</li>)}</ul>
                )}
              </div>
            </div>
            <div className="card">
              <h3>Offer comparison</h3>
              <table className="data-table history">
                <thead><tr><th>Mechanic</th><th>{c.name}</th><th>You</th><th>Result</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.mechanic}><th>{r.mechanic}</th><td>{r.theirs}</td><td>{r.yours}</td><td><span className={PILL[r.status]}>{r.status}</span></td></tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">
                Their offers are read from {c.url}. {USE_MOCK ? 'Your offers are read from your public site.' : 'Your own offers are not connected yet, so they show as not known.'}
                {c.price_gap_pct == null && ' Price gap is not measured yet.'}
              </p>
            </div>
            {c.metrics && USE_MOCK && (() => {
              const bm = benchmark(c.metrics, BOA_METRICS, c.name)
              const lag = bm.filter((r) => r.lead === 'They lead')
              return (
                <>
                  <div className="card">
                    <h3>Catalogue and pricing benchmark</h3>
                    <table className="data-table history">
                      <thead><tr><th>Metric</th><th>{c.name}</th><th>You</th><th>Result</th></tr></thead>
                      <tbody>
                        {bm.map((r) => (
                          <tr key={r.metric}><th>{r.metric}</th><td>{r.them}</td><td>{r.you}</td><td><span className={r.lead === 'They lead' ? 'pill alt' : 'pill ok'}>{r.lead}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="muted">From both brands' public product feeds (about {c.metrics.sampled} products each, GBP). Median price is for dresses and gowns.</p>
                  </div>
                  <div className="cols">
                    <div className="card bad">
                      <h3>Insights: where they beat you</h3>
                      <ul>{lag.map((r) => <li key={r.metric}>{r.insight}</li>)}</ul>
                    </div>
                    <div className="card good">
                      <h3>Insights: where you beat them</h3>
                      <ul>{bm.filter((r) => r.lead === 'You lead').map((r) => <li key={r.metric}>{r.insight}</li>)}</ul>
                    </div>
                  </div>
                  <div className="card memory">
                    <h3>Actions against {c.name}</h3>
                    <ol>
                      {bm.map((r) => (
                        <li key={r.metric}>
                          <strong>{r.action}</strong> <span className="pill">{r.segment}</span>
                          <p className="muted">{r.lead === 'They lead' ? 'Respond' : 'Press the advantage'}: {r.metric.toLowerCase()} is {r.you} for you and {r.them} for them.</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )
            })()}
            {behind.length > 0 && (
              <div className="card memory">
                <h3>Promo actions in response</h3>
                <ol>
                  {behind.map((r) => (
                    <li key={r.mechanic}>
                      <strong>{r.response.action}</strong> <span className="pill">{r.response.segment}</span>
                      <p className="muted">{r.response.detail} Because: {c.name} offers "{r.theirs}".</p>
                    </li>
                  ))}
                </ol>
                <p className="muted">These are suggestions from the comparison. They become approvable actions once the Strategy agent receives competitor data.</p>
              </div>
            )}
          </section>
        )
      })}
    </>
  )
}
