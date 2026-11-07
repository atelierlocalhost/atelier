import { useState } from 'react'
import { approveAction } from '../api'

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
        <div className="card memory">
          <h3>Used from memory</h3>
          <ul>{run.memory_used.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      <section className="stack">
        {run.actions.map((a) => (
          <div className="card action" key={a.id}>
            <div>
              <span className="pill">{a.type}</span> <span className="pill alt">{a.segment}</span>
              <h3>{a.title}</h3>
              <p className="muted">{a.why}</p>
              {a.result?.message && <p className="muted">{a.result.message}</p>}
            </div>
            {a.status === 'applied' ? (
              <span className="pill ok">Applied</span>
            ) : (
              <button className="btn primary" disabled={pending === a.id} onClick={() => approve(a.id)}>
                {pending === a.id ? 'Applying...' : a.status === 'approved' ? 'Approved' : 'Approve'}
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  )
}
