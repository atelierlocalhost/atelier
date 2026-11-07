import { shopNumbers, hasNumber } from '../lib/simulated'

const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const wholeUsd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function RevenueEstimate({ baseline, name }) {
  const monthly = hasNumber(baseline) ? baseline : shopNumbers(name).revenue_90d / 3
  const extra = monthly * 0.05
  // Partition the simulated opportunity once: channels never overlap.
  const cents = Math.round(extra * 100)
  const collab = Math.round(cents * 0.4)
  const ads = Math.round(cents * 0.35)
  const streams = [
    { name: 'Collaborations', cents: collab },
    { name: 'Ads', cents: ads },
    { name: 'Influencer collaborations', cents: cents - collab - ads },
  ].map((s) => ({ ...s, fee: Math.round(s.cents * 0.1) }))
  const fee = streams.reduce((sum, s) => sum + s.fee, 0) / 100
  const attributed = cents / 100
  return (
    <>
      <div className="grid revenue-estimate" aria-label={`Potential extra revenue for ${name}`}>
        <div className="tile mint">
          <p className="caption">Potential extra revenue / month</p>
          <p className="big">{wholeUsd(extra)}</p>
          <p className="muted">{wholeUsd(monthly)} × 5% assumed growth · simulated</p>
        </div>
        <div className="tile sky">
          <p className="caption">Potential extra revenue / year</p>
          <p className="big">{wholeUsd(extra * 12)}</p>
          <p className="muted">If the same monthly increase lasts 12 months.</p>
        </div>
      </div>
      <div className="card revenue-estimate">
        <p className="caption">Subscription + 10% revenue share</p>
        <h3>Our share of the sales our campaigns generate</h3>
        <p>Subscription: $5 first month. Plus 10% of revenue attributed to our collaborations, ads and influencer collaborations. Existing shop sales and organic revenue are excluded.</p>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Our revenue stream</th><th>Shop revenue / month</th><th>Our cut · 10%</th></tr></thead>
          <tbody>{streams.map((s) => <tr key={s.name}><th>{s.name}</th><td>{usd(s.cents / 100)}</td><td>{usd(s.fee / 100)}</td></tr>)}</tbody>
          <tfoot><tr><th>Total attributed revenue</th><td>{usd(attributed)}</td><td>{usd(fee)}</td></tr></tfoot>
        </table></div>
        <p><strong>Shop keeps {usd(attributed - fee)}</strong> of campaign revenue before subscription and campaign costs. <strong>We receive {usd(fee + 5)}</strong> in the first month, including the $5 subscription.</p>
        <small className="muted">Simulated projection: the assumed extra sales above are split 40% collaborations, 35% ads and 25% influencers. Each sale is counted once. Actual revenue share requires tracked, attributable sales; these figures do not create charges.</small>
      </div>
    </>
  )
}
