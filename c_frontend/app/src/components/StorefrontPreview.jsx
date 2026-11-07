import { DEMO_CLIENT, DEMO_STORE } from '../demoClient'
import { BOA_PRODUCTS } from '../demoData'

// The client site refuses to be embedded (X-Frame-Options: DENY), so this is Atelier's own
// storefront view built from the site's public product feed. Images load from the brand's CDN.
export default function StorefrontPreview() {
  return (
    <div className="card storefront">
      <div className="sf-promo">{DEMO_STORE.promo}</div>
      <div className="sf-head">
        <h3>{DEMO_CLIENT.name}</h3>
        <p className="muted">{DEMO_STORE.tagline}</p>
      </div>
      <div className="product-grid">
        {BOA_PRODUCTS.map((p) => (
          <a className="product-card" key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
            <img src={p.image} alt={p.name} loading="lazy" referrerPolicy="no-referrer" />
            <span className="product-name">{p.name}</span>
            <span className="muted">£{p.price.toFixed(0)}</span>
          </a>
        ))}
      </div>
      <p className="muted">
        Newest products from the live site.{' '}
        <a href={DEMO_CLIENT.url} target="_blank" rel="noopener noreferrer">Open the full store in a new tab</a>.
      </p>
    </div>
  )
}
