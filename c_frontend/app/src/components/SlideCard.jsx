export default function SlideCard({ slide, index, total }) {
  return (
    <div className="slide">
      <span className="slide-n">{index + 1}/{total}</span>
      <h4>{slide.headline}</h4>
      <p>{slide.body}</p>
    </div>
  )
}
