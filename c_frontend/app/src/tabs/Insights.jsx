import CompetitorCard from '../components/CompetitorCard'
import CompetitorAnalysis from '../components/CompetitorAnalysis'
import SocialInsights from '../components/SocialInsights'
import MailingList from './MailingList'
import SegmentExplorer from '../components/SegmentExplorer'
import { segTint } from '../design/palette'

const TINTS = { 'var(--tint-lavender)': 'lavender', 'var(--tint-sky)': 'sky', 'var(--tint-mint)': 'mint', 'var(--tint-peach)': 'peach', 'var(--tint-pink)': 'pink' }

export default function Insights({ run }) {
  const { segments, working, fix } = run.insights
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
      <SegmentExplorer run={run} />
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
      <h2>Social media</h2>
      <SocialInsights run={run} />
      <MailingList run={run} />
      <h2>Competitors</h2>
      <div className="grid wide">
        {run.competitors.map((c) => <CompetitorCard key={c.url} c={c} />)}
      </div>
      <CompetitorAnalysis run={run} />
    </>
  )
}
