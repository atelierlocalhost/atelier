import SlideCard from '../components/SlideCard'
import Emails from './Emails'

export default function Social({ run, onChange }) {
  return (
    <>
      <Emails run={run} onChange={onChange} />
      <h2>Social posts</h2>
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
    </>
  )
}
