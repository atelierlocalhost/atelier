import { useState } from 'react'

// Only allow http(s) links so a bad value can never become a javascript: URL.
function safeUrl(u) {
  try {
    const url = new URL(u)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export default function CompetitorCard({ c }) {
  const [open, setOpen] = useState(false)
  const href = safeUrl(c.url)
  const gap = c.price_gap_pct
  return (
    <div className="card competitor">
      <div className="comp-head">
        <strong>{c.name}</strong>
        {gap == null ? (
          <span className="pill">Price gap not measured</span>
        ) : (
          <span className={gap < 0 ? 'pill alt' : 'pill ok'}>
            {gap < 0 ? `${Math.abs(gap)}% cheaper` : gap > 0 ? `${gap}% pricier` : 'same price'}
          </span>
        )}
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">{c.url}</a>
      ) : (
        <p className="muted">{c.url}</p>
      )}
      <div className="chips">
        {c.promos.map((p) => <span className="pill" key={p}>{p}</span>)}
      </div>
      {href && (
        <>
          <button className="btn" onClick={() => setOpen(!open)}>
            {open ? 'Hide preview' : 'Show preview'}
          </button>
          {open && (
            <>
              <iframe
                className="comp-frame"
                src={href}
                title={`${c.name} preview`}
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <p className="muted">Blank? Some sites block previews. <a href={href} target="_blank" rel="noopener noreferrer">Open in a new tab</a>.</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
