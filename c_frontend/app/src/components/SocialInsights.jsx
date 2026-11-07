import { loadImages, sampleStats } from '../images'

const pct = (n) => `${n.toFixed(1)}%`

export default function SocialInsights({ run }) {
  const posts = run.social
  const slides = posts.reduce((n, p) => n + p.slides.length, 0)
  const words = posts.length ? Math.round(posts.reduce((n, p) => n + p.caption.split(/\s+/).length, 0) / posts.length) : 0

  const imgs = loadImages().map((i) => ({ ...i, e: sampleStats(i.id).engagement }))
  const byTag = {}
  imgs.forEach((i) => i.tags.forEach((t) => (byTag[t] = [...(byTag[t] || []), i.e])))
  const styles = Object.entries(byTag).map(([name, v]) => ({ name, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length })).sort((a, b) => b.avg - a.avg)
  const overall = imgs.length ? imgs.reduce((n, i) => n + i.e, 0) / imgs.length : 0
  const best = styles[0]
  const worst = styles[styles.length - 1]

  return (
    <>
      <section className="grid">
        <div className="tile lavender"><p className="caption">Planned posts</p><p className="big">{posts.length}</p><p className="muted">{slides} carousel slides</p></div>
        <div className="tile sky"><p className="caption">Caption length</p><p className="big">{words}</p><p className="muted">words on average</p></div>
        <div className="tile peach"><p className="caption">Sounds picked</p><p className="big">{new Set(posts.map((p) => p.sound)).size}</p><p className="muted">{posts[0]?.sound}</p></div>
        <div className="tile mint"><p className="caption">Images tested</p><p className="big">{imgs.length}</p><p className="muted">{styles.length} styles tagged</p></div>
      </section>
      <section className="cols">
        <div className="card good">
          <h3>What is working</h3>
          {best && styles.length > 1 ? (
            <ul>
              <li><strong>{best.name}</strong> images lead at {pct(best.avg)} engagement across {best.n} image{best.n > 1 ? 's' : ''}, against {pct(overall)} overall.</li>
              <li>Your plan reuses the "{posts[0]?.sound}" sound across {posts.length} post{posts.length > 1 ? 's' : ''}.</li>
            </ul>
          ) : (
            <p className="muted">Add and tag images in the Image lab below to see which styles perform best.</p>
          )}
        </div>
        <div className="card bad">
          <h3>What to improve</h3>
          <ul>
            {worst && styles.length > 1 && <li><strong>{worst.name}</strong> images trail at {pct(worst.avg)}. Post fewer of them or change the framing.</li>}
            <li>Competitor social activity is not tracked yet, so you cannot compare posting rhythm or formats.</li>
            <li>Test two caption lengths next week and keep the one with higher saves.</li>
          </ul>
        </div>
      </section>
      <div className="card memory">
        <h3>Do next</h3>
        <ol>
          <li>{best && styles.length > 1 ? `Make the next 3 posts ${best.name}-style, then compare against ${worst.name}.` : 'Tag your images by style so Atelier can rank them.'}</li>
          <li>Pair each carousel with a win-back or promo email to the same segment.</li>
          <li>Connect competitor social pages so Atelier can compare what they post and how it lands.</li>
        </ol>
        <p className="muted">Image performance is sample data until the backend reports real post results.</p>
      </div>
    </>
  )
}
