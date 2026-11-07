import { storeUrl } from '../api'

export default function Store() {
  const url = storeUrl()
  if (!url) {
    return <p className="muted">Storefront preview needs the live API. Set VITE_USE_MOCK=false.</p>
  }
  return <iframe className="store-frame" src={url} title="Storefront" />
}
