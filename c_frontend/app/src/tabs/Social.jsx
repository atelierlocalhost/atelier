import SlideCard from '../components/SlideCard'
import Emails from './Emails'
import ImageLab from './ImageLab'

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
      <ImageLab />
      <Emails run={run} onChange={onChange} />
    </>
  )
}
