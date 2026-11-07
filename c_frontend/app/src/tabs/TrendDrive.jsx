import { useCallback, useEffect, useState } from 'react'
import { apiUrl, approveTrendShop, getTrendShop, getTrendShops, getTrendSummary, startTrendSearch } from '../api'
import { ChartCard, HBar } from '../components/Charts'
import LabTab from './LabTab'

const money = (n) => `$${Math.round(n).toLocaleString()}`
const SOCIAL_COLORS = ['var(--seg-champions)', 'var(--seg-loyal)', 'var(--seg-new)', 'var(--seg-atrisk)', 'var(--seg-hibernating)', 'var(--purple-500)']

// Real details from the shop's own website and the map, plus simulated social and competitor stats.
function ShopProfile({ d }) {
  const pr = d.profile || {}
  const range = pr.price_range ? `${money(pr.price_range[0])}–${money(pr.price_range[1])}` : 'Not listed'
  return (
    <>
      <section className="grid">
        <Tile tint="lavender" label="Website score" value={`${pr.website_score ?? '—'}/100`} sub={pr.load_ms ? `loads in ${(pr.load_ms / 1000).toFixed(1)} s` : 'our audit'} />
        <Tile tint="pink" label="Reviews" value={`${d.reviews?.rating ?? '—'}★`} sub={`${d.reviews?.count ?? '—'} reviews (simulated)`} />
        <Tile tint="sky" label="Price range" value={range} sub={pr.price_range ? `median ${money(pr.price_range[2])}, from their site` : 'no prices on the homepage'} />
        <Tile tint="butter" label="Opening hours" value={pr.hours ? 'Listed' : '—'} sub={pr.hours || 'not on the map'} />
      </section>
      {pr.categories?.length > 0 && (
        <div className="card">
          <p className="caption">What they sell (from their website)</p>
          <div className="chips">{pr.categories.map((c) => <span className="pill" key={c}>{c}</span>)}</div>
        </div>
      )}
      {pr.site_images?.length > 0 && (
        <>
          <h2>From their website</h2>
          <div className="product-grid">
            {pr.site_images.map((src) => (
              <a className="product-card" key={src} href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} alt={`${d.name} website`} loading="lazy" referrerPolicy="no-referrer" />
              </a>
            ))}
          </div>
        </>
      )}
      {d.social && (
        <>
          <p className="caption">Social history · simulated</p>
          <h2>What performed best on their posts</h2>
          <section className="cols">
            {[['theme', 'By content type'], ['palette', 'By colour palette'], ['format', 'By format']].map(([k, title]) => {
              const data = (d.social[k] || []).map((x, i) => ({ ...x, color: SOCIAL_COLORS[i % SOCIAL_COLORS.length] }))
              return (
                <ChartCard key={k} title={title} subtitle="avg engagement per post" data={data}>
                  <HBar data={data} />
                </ChartCard>
              )
            })}
          </section>
        </>
      )}
    </>
  )
}

const TINTS = ['lavender', 'sky', 'mint', 'peach', 'pink', 'butter']

function Tile({ tint, label, value, sub }) {
  return (
    <div className={`tile ${tint}`}>
      <p className="caption">{label}</p>
      <p className="big">{value}</p>
      <p className="muted">{sub}</p>
    </div>
  )
}

function ShopCard({ shop, onOpen }) {
  return (
    <button className="card shop-card" onClick={() => onOpen(shop.id)}>
      <span className="pill alt">{statusLabel(shop.status)}</span>
      <h3>{shop.name}</h3>
      <p>{shop.address || 'Brooklyn'}</p>
      <p className="muted">{shop.domain}{shop.email ? ` · ${shop.email}` : ' · no public email'}</p>
      <div className="chips">{shop.weak.map((w) => <span className="pill" key={w}>{w}</span>)}</div>
    </button>
  )
}

const statusLabel = (s) => ({ PLAN_READY: 'Plan ready', APPROVED: 'Approved', EMAILED: 'Sent', PAID: 'Paid', CLIENT: 'In Atelier' })[s] || s

// One section of the proposal: cards in a grid, each with a title, a line and an example.
function PlanSection({ caption, title, items, render }) {
  if (!items?.length) return null
  return (
    <>
      <p className="caption">{caption}</p>
      <h2>{title}</h2>
      <section className="cols">{items.map((it, i) => <div className={`card tint ${TINTS[i % TINTS.length]}-card`} key={i}>{render(it)}</div>)}</section>
    </>
  )
}

function ShopPlan({ id, onBack, onChanged }) {
  const [d, setD] = useState(null)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const shop = await getTrendShop(id)
      setD(shop)
      setTo(shop?.email || '')
    } catch (e) {
      setErr(e.message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function approve() {
    setBusy(true)
    setErr('')
    try {
      const r = await approveTrendShop(id, to)
      setMsg(r.email_result)
      await load()
      onChanged()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (err && !d) return <p className="error">{err}</p>
  if (!d) return <p className="muted">Loading plan…</p>
  const p = d.plan || {}
  const pending = d.status === 'PLAN_READY'

  return (
    <>
      <button className="btn small" onClick={onBack}>← All shops</button>
      <div className="card hero" style={{ marginTop: 'var(--space-3)' }}>
        <div>
          <h2>{d.name}</h2>
          <p>{d.address || 'Brooklyn'} · <a href={d.website} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{d.domain}</a></p>
          <p>{d.email || 'No public email on their site'}{d.phone ? ` · ${d.phone}` : ''}{d.instagram ? ` · ${d.instagram}` : ''}</p>
        </div>
        <span className="pill">{statusLabel(d.status)}</span>
      </div>

      <ShopProfile d={d} />

      <h2>Why we chose them</h2>
      <div className="card">
        <table className="data-table plan-table">
          <thead><tr><th>Weak area</th><th>What we'll focus on</th></tr></thead>
          <tbody>{d.why.map((w) => <tr key={w.weak}><th>{w.weak}</th><td>{w.focus}</td></tr>)}</tbody>
        </table>
      </div>
      {p.summary && <p className="prose">{p.summary}</p>}

      {p.trend_gap?.length > 0 && (
        <>
          <p className="caption">Trend gap · simulated competitors</p>
          <h2>Trending colours and designs</h2>
          <div className="card">
            <table className="data-table plan-table">
              <thead><tr><th>Trend</th><th>Your website</th><th>Competitor with it</th><th>Why it matters</th></tr></thead>
              <tbody>
                {p.trend_gap.map((g) => (
                  <tr key={g.trend}><th>{g.trend} <span className="pill">{g.type}</span></th>
                    <td>{g.on_your_site ? 'Shown' : 'Not on your site'}</td><td>{g.competitor_with_it}</td><td>{g.why_it_matters}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PlanSection caption="Buying behaviour · simulated" title="Who shops near you" items={p.buying_behaviour} render={(b) => (
        <><p className="caption">{b.share} of area shoppers</p><h3>{b.persona}</h3><p>Buys {b.what_they_buy}. Finds shops via {b.how_they_find_shops}.</p>
          <p className="muted">Your site today: {b.your_site_today}</p><p><strong>Lost opportunity:</strong> {b.lost_opportunity}</p></>
      )} />
      <PlanSection caption="a · Collaboration" title="Partner with nearby stores" items={p.collaborations} render={(c) => (
        <><h3>{c.partner}</h3><p>{c.idea}</p><p className="muted">e.g. {c.example}</p></>
      )} />
      {d.concepts?.length > 0 && (
        <div className="image-grid">
          {d.concepts.map((c) => (
            <figure className="card image-card" key={c.image_url}>
              <img src={apiUrl(c.image_url)} alt={c.headline} className="concept-img" />
              <figcaption className="muted">{c.partner}: {c.why}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <PlanSection caption="b · Discounts" title="Promotions to run" items={p.discounts} render={(x) => (
        <><h3>{x.title}</h3><p>{x.mechanic}</p><p className="muted">e.g. {x.example}</p></>
      )} />
      <PlanSection caption="c · Website and fashion" title="Website improvements" items={p.website_fashion} render={(w) => (
        <><h3>{w.finding}</h3><p>{w.fix}</p><p className="muted">e.g. {w.example}</p></>
      )} />
      {d.competitors?.length > 0 && (
        <>
          <p className="caption">Nearby boutiques · simulated</p>
          <h2>How they compare</h2>
          <div className="card">
            <table className="data-table plan-table">
              <thead><tr><th>Boutique</th><th>Distance</th><th>Reviews</th><th>Instagram</th><th>Online shop</th><th>Price vs them</th><th>Promotions</th></tr></thead>
              <tbody>
                <tr className="hl"><th>{d.name} (them)</th><td>—</td><td>{d.reviews?.rating}★ ({d.reviews?.count})</td><td>{d.instagram || '—'}</td><td>{d.audit?.online_shop ? 'yes' : 'not found'}</td><td>—</td><td>{d.audit?.not_found_on_homepage?.includes('promotion') ? 'none found' : 'some'}</td></tr>
                {d.competitors.map((c) => (
                  <tr key={c.name}><th>{c.name}</th><td>{c.distance_m} m</td><td>{c.rating}★ ({c.reviews})</td><td>{c.instagram_followers.toLocaleString()}</td>
                    <td>{c.online_shop ? 'yes' : 'no'}</td><td>{c.price_position_pct > 0 ? '+' : ''}{c.price_position_pct}%</td><td>{c.promos.join('; ')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <PlanSection caption="d · Competitors · simulated" title="What nearby boutiques did" items={p.competitors_did} render={(c) => (
        <><h3>{c.competitor}</h3><p>{c.what}</p><p className="muted">Takeaway: {c.takeaway}</p>{c.impact && <p><strong>Impact:</strong> {c.impact}</p>}</>
      )} />

      <p className="caption">Shopper lab · simulated</p>
      <h2>Test their product photos with a shopper panel</h2>
      <div className="shop-section lab-in-plan"><LabTab shopId={d.id} /></div>

      <p className="caption">e · Approve and send</p>
      <h2>What they'll receive</h2>
      <div className="send-wrap">
        <div className="mail-preview">
          <div className="mail-meta muted">
            <div><strong>From</strong> {d.outreach.from}</div>
            <div><strong>To</strong> {to || '(add the shop email)'}</div>
            <div><strong>Subject</strong> {d.outreach.subject}</div>
          </div>
          <iframe
            title="Email preview"
            srcDoc={d.outreach.html}
            className="mail-frame"
            // Grow to the full email so nothing is cut off (srcdoc is same-origin).
            onLoad={(e) => {
              const doc = e.currentTarget.contentDocument
              if (doc) e.currentTarget.style.height = `${doc.documentElement.scrollHeight + 4}px`
            }}
          />
        </div>
        {(msg || d.outreach.result) && <p className={err ? 'error' : 'muted'}>{msg || d.outreach.result}</p>}
        {err && <p className="error">{err}</p>}
        {pending ? (
          <div className="send-row">
            {!d.outreach.to && (
              <label className="field">Shop email<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="owner@boutique.com" /></label>
            )}
            <button className="btn primary" onClick={approve} disabled={busy || !to}>{busy ? 'Sending…' : 'Approve and send'}</button>
          </div>
        ) : (
          <p className="muted">Status: {statusLabel(d.status)}{d.outreach.emailed_at ? ` · emailed ${d.outreach.emailed_at.slice(0, 16).replace('T', ' ')}` : ''}</p>
        )}
      </div>
    </>
  )
}

export default function TrendDrive() {
  const [summary, setSummary] = useState(null)
  const [shops, setShops] = useState({ latest: [], earlier: [] })
  // Deep link: #shop=<id> opens that shop's plan directly.
  const [open, setOpenState] = useState(() => (window.location.hash.match(/shop=([\w-]+)/) || [])[1] || null)
  const setOpen = (id) => {
    window.location.hash = id ? `shop=${id}` : ''
    setOpenState(id)
  }
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([getTrendSummary(), getTrendShops()])
      setSummary(s)
      setShops(list)
      setErr('')
    } catch (e) {
      setErr(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // While a search runs (3 to 4 minutes), refresh every 5 seconds.
  useEffect(() => {
    if (!summary?.busy) return undefined
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [summary?.busy, load])

  async function search() {
    try {
      await startTrendSearch()
      await load()
    } catch (e) {
      setErr(e.message)
    }
  }

  if (open) return <ShopPlan id={open} onBack={() => setOpen(null)} onChanged={load} />

  return (
    <>
      <div className="card hero">
        <div>
          <h2>Find boutiques that need us</h2>
          <p>Agents search Brooklyn boutiques, review their website and reviews, and write a plan for the ones underperforming.</p>
        </div>
        <button className="btn primary" onClick={search} disabled={summary?.busy}>{summary?.busy ? 'Searching…' : 'Search for boutiques'}</button>
      </div>
      {err && <p className="error">{err}</p>}
      {summary?.error && <p className="error">{summary.error}</p>}
      {summary && (
        <section className="grid">
          <Tile tint="lavender" label="Shops searched" value={summary.searched} sub="latest search, on the map" />
          <Tile tint="sky" label="Shops reviewed" value={summary.reviewed} sub="website and reviews" />
          <Tile tint="pink" label="Underperforming" value={summary.underperforming} sub="each has a plan" />
        </section>
      )}
      <h2>Underperforming shops</h2>
      {shops.latest.length ? (
        <div className="grid wide">{shops.latest.map((s) => <ShopCard key={s.id} shop={s} onOpen={setOpen} />)}</div>
      ) : (
        <p className="muted">No shops yet. Start a search.</p>
      )}
    </>
  )
}
