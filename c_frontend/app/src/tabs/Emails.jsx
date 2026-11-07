import { useState } from 'react'
import { approveAction } from '../api'

const EMAIL_TYPES = ['winback_email', 'coupon']

// Drafts are built here from the action; the contract has no email copy yet.
function draftFor(action, recipients) {
  const code = action.type === 'coupon' ? 'WELCOMEBACK' : 'MISSYOU12'
  const subject =
    action.segment === 'At risk' ? 'We saved your favorites' : `A little something for you`
  const body =
    `Hi {{first_name}},\n\n` +
    `It has been a while, and we have new pieces we think you will love.\n\n` +
    `${action.title}. Use code ${code} at checkout this week.\n\n` +
    `Thank you for being part of the shop.\n\nAtelier`
  return { subject, body, recipients }
}

function Email({ action, recipients, onApplied }) {
  const [d, setD] = useState(() => draftFor(action, recipients))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function approve() {
    setBusy(true)
    setErr('')
    try {
      await approveAction(action.id)
      await onApplied()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const done = action.status === 'applied'
  return (
    <div className="card email">
      <div className="comp-head">
        <div>
          <span className="pill">{action.type === 'coupon' ? 'Promo' : 'Win-back'}</span>{' '}
          <span className="pill alt">{action.segment}</span>
          <h3>{action.title}</h3>
        </div>
        <span className={done ? 'pill ok' : 'pill'}>{done ? 'Applied' : 'Proposed'}</span>
      </div>
      <p className="muted">{action.why}</p>
      <p className="muted">To: {action.segment} segment{recipients ? ` (${recipients} customers)` : ''}</p>
      <label className="field">
        Subject
        <input value={d.subject} disabled={done} onChange={(e) => setD({ ...d, subject: e.target.value })} />
      </label>
      <label className="field">
        Message
        <textarea rows={8} value={d.body} disabled={done} onChange={(e) => setD({ ...d, body: e.target.value })} />
      </label>
      <div className="mail-preview">
        <div className="mail-head">Atelier</div>
        <div className="mail-body">
          <strong>{d.subject}</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{d.body.replace('{{first_name}}', 'Maya')}</p>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      {!done && (
        <button className="btn primary" disabled={busy} onClick={approve}>
          {busy ? 'Approving...' : 'Approve campaign'}
        </button>
      )}
      <p className="muted">Nothing is sent from this screen. Approval applies the action through the backend.</p>
    </div>
  )
}

export default function Emails({ run, onChange }) {
  const emails = run.actions.filter((a) => EMAIL_TYPES.includes(a.type))
  const counts = Object.fromEntries(run.insights.segments.map((s) => [s.name, s.count]))
  if (emails.length === 0) return <p className="muted">No email campaigns proposed in this run.</p>
  return (
    <>
      <h2>Email campaigns</h2>
      <p className="muted">Proposed by the Strategy agent. Edit the draft, then approve.</p>
      <section className="stack">
        {emails.map((a) => (
          <Email key={a.id} action={a} recipients={counts[a.segment]} onApplied={onChange} />
        ))}
      </section>
    </>
  )
}
