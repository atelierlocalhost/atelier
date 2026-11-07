import { DEMO_CLIENT, DEMO_STORE } from '../demoClient'

const TINTS = ['lavender', 'peach', 'sky', 'pink', 'mint', 'butter', 'lavender', 'peach']

// The client site refuses to be embedded (X-Frame-Options: DENY), so this is Atelier's own
// storefront view built from the site's real collections. Links open the real site.
export default function StorefrontPreview() {
  const open = (children, cls) => (
    <a className={cls} href={DEMO_CLIENT.url} target="_blank" rel="noopener noreferrer">{children}</a>
  )
  return (
    <div className="card storefront">
      <div className="sf-promo">{DEMO_STORE.promo}</div>
      <div className="sf-head">
        <h3>{DEMO_CLIENT.name}</h3>
        <p className="muted">{DEMO_STORE.tagline}</p>
      </div>
      <div className="sf-edits">
        {DEMO_STORE.edits.map((e) => open(e, 'pill'))}
        {DEMO_STORE.occasions.map((e) => open(e, 'pill alt'))}
      </div>
      <div className="grid">
        {DEMO_STORE.collections.map((c, i) => open(<span>{c}</span>, `tile ${TINTS[i]} sf-tile`))}
      </div>
      <p className="muted">
        Collections are read from the live site.{' '}
        <a href={DEMO_CLIENT.url} target="_blank" rel="noopener noreferrer">Open the full store in a new tab</a>.
      </p>
    </div>
  )
}
