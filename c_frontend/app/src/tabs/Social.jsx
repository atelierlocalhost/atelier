import SlideCard from '../components/SlideCard'

export default function Social({ run }) {
  return (
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
  )
}
