import { useState } from 'react'
import { approveAction } from '../api'
import { segTint } from '../design/palette'

const COLUMNS = [
  ['proposed', 'To approve'],
  ['approved', 'Approved'],
  ['applied', 'Applied'],
]

export default function Actions({ run, onChange }) {
  const [pending, setPending] = useState(null)
  const [err, setErr] = useState('')

  async function approve(id) {
    setPending(id)
    setErr('')
    try {
      await approveAction(id)
      await onChange()
    } catch (e) {
      setErr(e.message)
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      {err && <p className="error">{err}</p>}
      {run.memory_used.length > 0 && (
        <div className="card memory" style={{ marginBottom: 'var(--space-4)' }}>
          <h3>Why this plan: used from memory</h3>
          <ul>{run.memory_used.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      <section className="board">
        {COLUMNS.map(([status, title]) => {
          const items = run.actions.filter((a) => a.status === status)
          return (
            <div className="column" key={status}>
              <p className="caption">{title} ({items.length})</p>
              {items.map((a) => (
                <div className="card tint action-card" key={a.id} style={{ background: `color-mix(in srgb, ${segTint(a.segment)} 85%, transparent)` }}>
                  <div className="chips">
                    <span className="pill">{a.type.replace('_', ' ')}</span>
                    <span className="pill">{a.segment}</span>
                  </div>
                  <h3>{a.title}</h3>
                  <p className="muted">{a.why}</p>
                  {a.result?.message && <p className="muted">{a.result.message}</p>}
                  {status === 'proposed' && (
                    <button className="btn primary" disabled={pending === a.id} onClick={() => approve(a.id)}>
                      {pending === a.id ? 'Applying...' : 'Approve'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </section>
    </>
  )
}
