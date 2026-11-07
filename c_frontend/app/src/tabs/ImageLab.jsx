import { useRef, useState } from 'react'
import { fileToImage, loadImages, saveImages, sampleStats } from '../images'
import { ChartCard, HBar } from '../components/Charts'

const pct = (n) => `${n.toFixed(1)}%`

function badge(e, avg) {
  if (e >= avg * 1.2) return ['Top performer', 'pill ok']
  if (e <= avg * 0.8) return ['Underperforming', 'pill alt']
  return ['Average', 'pill']
}

export default function ImageLab() {
  const [images, setImages] = useState(loadImages)
  const [err, setErr] = useState('')
  const [concepts, setConcepts] = useState([])
  const fileRef = useRef(null)

  function update(list) {
    setImages(list)
    if (!saveImages(list)) setErr('Browser storage is full, so images will not be kept after a reload.')
  }

  async function onFiles(files) {
    setErr('')
    const added = []
    for (const f of files) {
      try {
        added.push(await fileToImage(f))
      } catch (e) {
        setErr(e.message)
      }
    }
    if (added.length) update([...images, ...added])
  }

  function addTag(id, text) {
    const tag = text.trim().toLowerCase()
    if (!tag) return
    update(images.map((i) => (i.id === id && !i.tags.includes(tag) ? { ...i, tags: [...i.tags, tag] } : i)))
  }

  const rows = images.map((i) => ({ ...i, stats: sampleStats(i.id) }))
  const avg = rows.length ? rows.reduce((n, r) => n + r.stats.engagement, 0) / rows.length : 0
  const ranked = [...rows].sort((a, b) => b.stats.engagement - a.stats.engagement)

  // Average engagement per style tag, compared with the overall average.
  const byTag = {}
  rows.forEach((r) => r.tags.forEach((t) => (byTag[t] = [...(byTag[t] || []), r.stats.engagement])))
  const tagStats = Object.entries(byTag)
    .map(([name, v]) => ({ name, value: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
    .sort((a, b) => b.value - a.value)
  const best = tagStats[0]
  const worst = tagStats[tagStats.length - 1]

  function generate() {
    const top = tagStats.slice(0, 3).map((t) => t.name)
    const base = top.length ? top.join(', ') : 'your best performing style'
    setConcepts(
      [
        `Close-up product shot, ${base}, soft natural light`,
        `Flat lay with two items styled together, ${base}`,
        `Lifestyle shot in a real setting, ${base}, warm tones`,
      ].map((prompt, i) => ({ id: i, prompt, basis: top }))
    )
  }

  return (
    <>
      <h2>Image lab</h2>
      <p className="muted">Add your own photos. Atelier compares how each performs, explains why, and drafts concepts for more of what works.</p>
      <div
        className="dropzone"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles([...e.dataTransfer.files]) }}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
      >
        <strong>Add images</strong>
        <span className="muted">Drop files here or click. JPG or PNG, up to 5 MB each.</span>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = '' }} />
      </div>
      {err && <p className="error">{err}</p>}

      {rows.length === 0 ? (
        <p className="muted">No images yet.</p>
      ) : (
        <>
          <p className="muted"><span className="pill alt">Sample data</span> Stats below are placeholders until the backend reports real post performance.</p>
          <section className="image-grid">
            {ranked.map((r) => {
              const [label, cls] = badge(r.stats.engagement, avg)
              return (
                <div className="card image-card" key={r.id}>
                  <img src={r.src} alt={r.name} />
                  <div className="comp-head">
                    <span className={cls}>{label}</span>
                    <button className="btn small" onClick={() => update(images.filter((i) => i.id !== r.id))}>Remove</button>
                  </div>
                  <p className="big" style={{ fontSize: 'var(--text-xl)' }}>{pct(r.stats.engagement)}</p>
                  <p className="muted">engagement · {r.stats.reach.toLocaleString()} reach · {r.stats.saves} saves · {r.stats.clicks} clicks</p>
                  <div className="chips">
                    {r.tags.map((t) => <span className="pill" key={t}>{t}</span>)}
                  </div>
                  <input
                    className="tag-input" placeholder="Add a style tag, press Enter" aria-label={`Add tag to ${r.name}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') { addTag(r.id, e.target.value); e.target.value = '' } }}
                  />
                </div>
              )
            })}
          </section>

          <section className="cols">
            <ChartCard title="Engagement by image" subtitle="Engagement rate" data={ranked.map((r) => ({ name: r.name, value: r.stats.engagement }))} format={pct}>
              <HBar data={ranked.map((r) => ({ name: r.name.slice(0, 14), value: r.stats.engagement, color: 'var(--seg-champions)' }))} format={pct} />
            </ChartCard>
            <div className="card memory">
              <h3>Why some images win</h3>
              {tagStats.length < 2 ? (
                <p>Tag a few images by style (for example "flat lay", "close-up", "outdoor") and Atelier will compare them.</p>
              ) : (
                <ul>
                  <li><strong>{best.name}</strong> images average {pct(best.value)} engagement across {best.n} image{best.n > 1 ? 's' : ''}, against {pct(avg)} overall.</li>
                  <li><strong>{worst.name}</strong> images average {pct(worst.value)}, the lowest of your styles.</li>
                  <li>Next posts should lean on {best.name} and test fewer {worst.name} shots.</li>
                </ul>
              )}
              <p className="muted">Reasons come from your tags and the sample stats. The agent will add visual analysis once connected.</p>
            </div>
          </section>

          <div className="card">
            <div className="comp-head">
              <div>
                <h3>Generate more of what works</h3>
                <p className="muted">Concept briefs built from your top styles.</p>
              </div>
              <button className="btn primary" onClick={generate}>Generate concepts</button>
            </div>
            {concepts.length > 0 && (
              <div className="grid wide" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
                {concepts.map((c) => (
                  <div className="tile lavender" key={c.id}>
                    <p className="caption">Concept {c.id + 1}</p>
                    <p>{c.prompt}</p>
                    <p className="muted">{c.basis.length ? `Based on: ${c.basis.join(', ')}` : 'Tag images to personalize this'}</p>
                  </div>
                ))}
              </div>
            )}
            {concepts.length > 0 && <p className="muted">These are briefs, not images. Image generation needs a backend endpoint.</p>}
          </div>
        </>
      )}
    </>
  )
}
