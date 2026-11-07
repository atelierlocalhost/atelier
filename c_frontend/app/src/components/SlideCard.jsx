export default function SlideCard({ slide, index, total }) {
  return (
    <div className={slide.image ? 'slide with-image' : 'slide'}>
      {slide.image && <img src={slide.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <span className="slide-n">{index + 1}/{total}</span>
      <div className="slide-text">
        <h4>{slide.headline}</h4>
        <p>{slide.body}</p>
      </div>
    </div>
  )
}
