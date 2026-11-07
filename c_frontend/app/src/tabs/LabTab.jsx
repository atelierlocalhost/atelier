import { useEffect, useState } from 'react'
import { startLabRun, postLabOutcome, USE_MOCK } from '../api'
import mock1 from '../mock_lab.json'
import RetryImg from '../components/RetryImg'

const SEGMENTS = ['Champions', 'Loyal', 'New', 'At risk', 'Hibernating']
const STEPS = [
  'Describing each variant (SIE)',
  'Generating personas from your segments (Tinfoil)',
  'Loading memory lessons (Cognee)',
  'Simulating 20 shoppers (Tinfoil)',
  'Scoring with confidence intervals',
  'Explaining and saving lessons',
]
const pct = (n) => n.toFixed(2)

// Heatmap cell: single-hue purple ramp, light to dark with score. Text flips for contrast.
function heat(score, min, max) {
  const t = max === min ? 0.5 : (score - min) / (max - min)
  const bg = `rgba(60, 32, 79, ${0.1 + t * 0.75})`
  return { background: bg, color: t > 0.5 ? 'var(--cream-100)' : 'var(--ink)' }
}

function Progress({ step }) {
  return (
    <ol className="lab-steps" aria-live="polite">
      {STEPS.map((s, i) => (
        <li key={s} className={i < step ? 'done' : i === step ? 'active' : ''}>
          <span className="dot" />{s}
        </li>
      ))}
    </ol>
  )
}

function Leaderboard({ result }) {
  const lo = 0.2, hi = 0.7 // fixed axis so run 1 and run 2 bars are comparable
  const x = (v) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="card">
      <h3>Leaderboard</h3>
      <p className="muted">Score with 90% interval across personas. Bars that overlap are not clearly different.</p>
      <div className="lb">
        {result.variants.map((v) => (
          <div className="lb-row" key={v.variant_id}>
            <span className="lb-rank">{v.rank}</span>
            <RetryImg src={v.image_url} alt={v.label} />
            <div className="lb-main">
              <strong>{v.label}</strong>
              <div className="lb-axis">
                <div className="lb-ci" style={{ left: x(v.ci[0]), width: `calc(${x(v.ci[1])} - ${x(v.ci[0])})` }} />
                <div className="lb-dot" style={{ left: x(v.score) }} />
              </div>
              <span className="muted">{pct(v.score)} (interval {pct(v.ci[0])} to {pct(v.ci[1])})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Heatmap({ result }) {
  const all = result.variants.flatMap((v) => Object.values(v.by_segment))
  const min = Math.min(...all), max = Math.max(...all)
  return (
    <div className="card">
      <h3>Who prefers what</h3>
      <p className="muted">Score by segment. Darker means the segment responds more.</p>
      <div className="table-scroll">
        <table className="heatmap">
          <thead><tr><th>Variant</th>{SEGMENTS.map((s) => <th key={s}>{s}</th>)}</tr></thead>
          <tbody>
            {result.variants.map((v) => (
              <tr key={v.variant_id}>
                <th>{v.label}</th>
                {SEGMENTS.map((s) => <td key={s} style={heat(v.by_segment[s], min, max)}>{pct(v.by_segment[s])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Shares({ title, items, variants, tone }) {
  const name = (id) => variants.find((v) => v.variant_id === id)?.label
  return (
    <div className={`card ${tone}`}>
      <h3>{title}</h3>
      <ul className="shares">
        {items.map((r) => (
          <li key={r.text}>
            <div className="comp-head"><span>{r.text}</span><strong>{Math.round(r.share * 100)}%</strong></div>
            <div className="share-bar"><i style={{ width: `${r.share * 100}%` }} /></div>
            <span className="muted">{name(r.variant_id)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Result({ result }) {
  const w = result.winner
  const second = result.variants[1]
  return (
    <>
      <div className={`card ${w.call === 'clear' ? 'good' : 'memory'}`}>
        <p className="caption">{result.lab_run_id} · {result.product}</p>
        {w.call === 'clear' ? (
          <h3>Clear winner: {w.label} ({w.lift_pct}% above the runner-up)</h3>
        ) : (
          <h3>Too close to call: {w.label} and {second.label} overlap</h3>
        )}
        <p className="muted">
          {w.call === 'clear'
            ? 'Its interval sits above every other variant, so Strategy, Social and the storefront can use it.'
            : 'Intervals overlap, so no winner is named. Add a stronger variant or more personas.'}
        </p>
      </div>
      <Leaderboard result={result} />
      <div style={{ height: 'var(--space-3)' }} />
      <Heatmap result={result} />
      <div style={{ height: 'var(--space-3)' }} />
      <section className="cols">
        <Shares title="Why shoppers liked it" items={result.reasons} variants={result.variants} tone="good" />
        <Shares title="What put them off" items={result.objections} variants={result.variants} tone="bad" />
      </section>
      <h2>What the shoppers said</h2>
      <section className="cols">
        {result.comments.map((c) => (
          <div className="card" key={c.persona}>
            <p className="caption">{c.persona}</p>
            <p>"{c.text}"</p>
            <span className="pill">{result.variants.find((v) => v.variant_id === c.variant_id)?.label}</span>
          </div>
        ))}
      </section>
      <section className="cols">
        <div className="card">
          <h3>Working</h3>
          <ul>{result.working.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="card">
          <h3>Fix</h3>
          <ul>{result.fix.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </section>
      <p className="muted">
        Cost of this run: SIE ${result.costs.sie_usd.toFixed(3)} · Tinfoil ${(result.costs.tinfoil_usd + result.costs.darkbloom_usd).toFixed(3)} · frontier model equivalent ${result.costs.frontier_equiv_usd.toFixed(2)}
      </p>
    </>
  )
}

function Compare({ a, b }) {
  const rankOf = (r, id) => r.variants.find((v) => v.variant_id === id)
  return (
    <>
      <h2>Run 1 vs run 2: what the lab learned</h2>
      <section className="cols">
        <div className="card memory">
          <h3>Lessons used in run 2</h3>
          <ul>{b.lessons_used.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
        <div className="card">
          <h3>Predicted vs real</h3>
          <p className="big">{b.calibration.mean_abs_error_pct}%</p>
          <p className="muted">average prediction error across {b.calibration.n_observed} real results. The lab now corrects for it.</p>
        </div>
      </section>
      <div className="card">
        <h3>How the ranking moved</h3>
        <table className="data-table history">
          <thead><tr><th>Variant</th><th>Rank</th><th>Score</th></tr></thead>
          <tbody>
            {b.variants.map((v) => {
              const o = rankOf(a, v.variant_id)
              const move = o.rank - v.rank
              return (
                <tr key={v.variant_id}>
                  <th>{v.label}</th>
                  <td>{o.rank} to {v.rank} {move > 0 ? `(up ${move})` : move < 0 ? `(down ${-move})` : '(same)'}</td>
                  <td>{pct(o.score)} to {pct(v.score)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="card good" style={{ marginTop: 'var(--space-3)' }}>
        <h3>New lessons saved</h3>
        <ul>{b.lessons_learned.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </>
  )
}

function Outcomes({ variants }) {
  const [id, setId] = useState(variants[0].variant_id)
  const [val, setVal] = useState('')
  const [sent, setSent] = useState([])
  const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    const n = Number(val)
    if (!(n >= 0 && n <= 1)) return setErr('Enter a rate between 0 and 1, for example 0.41.')
    setErr('')
    try {
      await postLabOutcome({ variant_id: Number(id), observed: n })
      setSent([...sent, { id: Number(id), n }])
      setVal('')
    } catch (e2) {
      setErr(e2.message)
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h3>Report real results</h3>
      <p className="muted">When a variant has run in real life, enter its observed rate so the lab can check its prediction.</p>
      <div className="chat-input">
        <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Variant" className="tag-input">
          {variants.map((v) => <option key={v.variant_id} value={v.variant_id}>{v.label}</option>)}
        </select>
        <input className="tag-input" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Observed rate, 0 to 1" aria-label="Observed rate" />
        <button className="btn primary">Save</button>
      </div>
      {err && <p className="error">{err}</p>}
      {sent.map((s, i) => <p className="muted" key={i}>Saved {variants.find((v) => v.variant_id === s.id)?.label}: {s.n}</p>)}
    </form>
  )
}

export default function LabTab() {
  const [runs, setRuns] = useState([])
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [view, setView] = useState('latest')

  // Step animation while the (up to 90 s) request is in flight.
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), USE_MOCK ? 850 : 9000)
    return () => clearInterval(t)
  }, [busy])

  async function run() {
    setBusy(true)
    setStep(0)
    setErr('')
    try {
      const r = await startLabRun('vs_01')
      setRuns((prev) => [...prev, r])
      setView('latest')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const latest = runs[runs.length - 1]
  const variants = (latest || mock1).variants.slice().sort((a, b) => a.variant_id - b.variant_id)

  return (
    <>
      <p className="muted">
        A panel of 20 synthetic shoppers, built from your customer segments, reacts to four versions of the same product. {USE_MOCK && 'These are simulated results for the demo.'}
      </p>
      <div className="card">
        <div className="comp-head">
          <div>
            <h3 style={{ margin: 0 }}>{mock1.product}</h3>
            <p className="muted">Goal: conversion · 4 image variants · 20 personas</p>
          </div>
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? 'Running...' : runs.length === 0 ? 'Run the lab' : 'Run again with lessons'}
          </button>
        </div>
        <div className="variant-row">
          {variants.map((v) => (
            <div className="variant" key={v.variant_id}>
              <RetryImg src={v.image_url} alt={v.label} />
              <strong>{v.label}</strong>
              <div className="chips">{v.features.map((f) => <span className="pill" key={f}>{f}</span>)}</div>
            </div>
          ))}
        </div>
        {busy && <Progress step={step} />}
        {err && <p className="error">{err}</p>}
      </div>

      {latest && !busy && (
        <>
          {runs.length > 1 && (
            <div className="seg-toggle" style={{ margin: 'var(--space-3) 0' }}>
              <button className={view === 'latest' ? 'btn small primary' : 'btn small'} onClick={() => setView('latest')}>Latest result</button>
              <button className={view === 'compare' ? 'btn small primary' : 'btn small'} onClick={() => setView('compare')}>Run 1 vs run 2</button>
            </div>
          )}
          <div style={{ marginTop: 'var(--space-3)' }}>
            {view === 'compare' && runs.length > 1 ? (
              <Compare a={runs[runs.length - 2]} b={latest} />
            ) : (
              <Result result={latest} />
            )}
          </div>
          {runs.length === 1 && <div style={{ marginTop: 'var(--space-3)' }}><Outcomes variants={variants} /></div>}
          {runs.length === 1 && <p className="muted">After reporting real results, click "Run again with lessons" to see how the lab changes.</p>}
        </>
      )}
    </>
  )
}
