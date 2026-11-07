import SlideCard from '../components/SlideCard'
import Emails from './Emails'
import ImageLab from './ImageLab'
import { BOA_PRODUCTS, BOA_SOCIAL_LINKS } from '../demoData'
import { USE_MOCK } from '../api'

export default function Social({ run, onChange }) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Social posts</h2>
      <section className="stack">
        {run.social.map((post, i) => (
          <div className="card" key={i}>
            <p>{post.caption}</p>
            <p className="muted">Sound: {post.sound}</p>
            <div className="carousel">
              {post.slides.map((s, j) => (
                <SlideCard key={j} slide={s} index={j} total={post.slides.length} />
              ))}
            </div>
          </div>
        ))}
      </section>
      {USE_MOCK && (
        <>
          <h2>From the website</h2>
          <p className="muted">
            Product imagery from the live site, ready to use in posts. Instagram and TikTok require sign-in, so their posts could not be read.
            View them directly:{' '}
            {BOA_SOCIAL_LINKS.map((l, i) => (
              <span key={l.label}>{i > 0 && ', '}<a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></span>
            ))}.
          </p>
          <div className="product-grid">
            {BOA_PRODUCTS.map((p) => (
              <a className="product-card" key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.image} alt={p.name} loading="lazy" referrerPolicy="no-referrer" />
                <span className="product-name">{p.name}</span>
              </a>
            ))}
          </div>
        </>
      )}
      <ImageLab />
      <Emails run={run} onChange={onChange} />
    </>
  )
}
