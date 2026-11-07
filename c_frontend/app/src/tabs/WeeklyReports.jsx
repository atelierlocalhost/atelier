import { useCallback, useEffect, useState } from 'react'
import { apiUrl, backfillReports, getReports, sendReportNow } from '../api'

// The weekly PDF report emailed to the boutique (to the operator while the payment is a placeholder).
export default function WeeklyReports({ client }) {
  const [reports, setReports] = useState([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!client) return
    try {
      setReports(await getReports(client.id))
    } catch (e) {
      setErr(e.message)
    }
  }, [client])

  useEffect(() => {
    load()
  }, [load])

  // Backfill runs in the background (about 20 s per week): poll for a minute and a half.
  useEffect(() => {
    if (busy !== 'backfill') return undefined
    const t = setInterval(load, 6000)
    const stop = setTimeout(() => setBusy(''), 90_000)
    return () => { clearInterval(t); clearTimeout(stop) }
  }, [busy, load])

  async function backfill() {
    setErr('')
    setBusy('backfill')
    try {
      await backfillReports(client.id, 4)
      setMsg('Building the last 4 weekly reports. Each one is emailed as it finishes.')
    } catch (e) {
      setErr(e.message)
      setBusy('')
    }
  }

  async function sendNow() {
    setErr('')
    setBusy('send')
    try {
      const r = await sendReportNow(client.id)
      setMsg(r.detail)
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
    }
  }

  if (!client) return <p className="muted">Open a signed boutique first.</p>
  return (
    <>
      <div className="card hero">
        <div>
          <h2>Weekly report for {client.name}</h2>
          <p>A PDF with charts, actions, next week's posts and the competitor watch, emailed every week.
            {client.real_paid ? '' : ' While the payment is a placeholder, it goes to you, not the boutique.'}</p>
        </div>
        <button className="btn primary" onClick={backfill} disabled={!!busy}>{busy === 'backfill' ? 'Building…' : 'Create last 4 weeks'}</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="card">
        <div className="chart-head">
          <h3>Reports sent</h3>
          <button className="btn small" onClick={sendNow} disabled={!!busy}>{busy === 'send' ? 'Sending…' : "Send this week's now"}</button>
        </div>
        {reports.length ? (
          <table className="data-table plan-table">
            <thead><tr><th>Week</th><th>Status</th><th>Sent to</th><th>PDF</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <th>{r.label || r.created.slice(0, 10)}</th>
                  <td>{r.status}</td>
                  <td>{r.sent_to || r.detail}</td>
                  <td>{r.pdf_url ? <a href={apiUrl(r.pdf_url)} target="_blank" rel="noreferrer">View</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No reports yet.</p>
        )}
      </div>
    </>
  )
}
