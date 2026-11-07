import { useEffect, useRef, useState } from 'react'
import { ask, SUGGESTIONS } from '../assistant'
import { getCosts } from '../api'
import { REPORTS, buildReport, toMarkdown, toCsv, download, printPdf } from '../lib/reports'
import { DEMO_CLIENT } from '../demoClient'
import { USE_MOCK } from '../api'

export default function Assistant({ run }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: 'Ask me about your store, customers, competitors or campaigns. I can also prepare reports to download.', source: 'local' }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [costs, setCosts] = useState(null)
  const [note, setNote] = useState('')
  const end = useRef(null)

  useEffect(() => {
    if (run) getCosts(run.run_id).then(setCosts).catch(() => setCosts(null))
  }, [run])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [msgs])

  if (!run) return <p className="muted">Run an analysis first so the assistant has data to answer from.</p>

  async function send(text) {
    const q = text.trim()
    if (!q || busy) return
    const next = [...msgs, { role: 'user', content: q }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    const r = await ask(next.map(({ role, content }) => ({ role, content })), run, costs)
    setMsgs([...next, { role: 'assistant', content: r.text, source: r.source }])
    setBusy(false)
  }

  const client = USE_MOCK ? DEMO_CLIENT.name : 'Your store'
  const get = (k) => buildReport(k, run, costs, client)
  const slug = (k) => `${k}-${run.run_id}`

  return (
    <div className="assistant">
      <div className="card chat">
        <div className="chat-log" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              <p>{m.content}</p>
              {m.role === 'assistant' && i > 0 && (
                <span className="caption">{m.source === 'llm' ? 'Answered by the LLM' : 'From your run data'}</span>
              )}
            </div>
          ))}
          {busy && <div className="bubble assistant"><p className="muted">Thinking...</p></div>}
          <div ref={end} />
        </div>
        <div className="chips">
          {SUGGESTIONS.map((s) => <button key={s} className="btn small" onClick={() => send(s)}>{s}</button>)}
        </div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your store" aria-label="Ask the assistant" />
          <button className="btn primary" disabled={busy || !input.trim()}>Send</button>
        </form>
      </div>

      <div className="stack" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>Reports</h2>
        {Object.entries(REPORTS).map(([k, label]) => (
          <div className="card" key={k}>
            <h3>{label}</h3>
            <div className="chips">
              <button className="btn small primary" onClick={() => { if (!printPdf(get(k))) setNote('Allow pop-ups to save as PDF.') }}>PDF</button>
              <button className="btn small" onClick={() => download(`${slug(k)}.csv`, toCsv(get(k)), 'text/csv')}>CSV</button>
              <button className="btn small" onClick={() => download(`${slug(k)}.md`, toMarkdown(get(k)), 'text/markdown')}>Summary (.md)</button>
            </div>
          </div>
        ))}
        {note && <p className="error">{note}</p>}
        <p className="muted">PDF opens the print dialog: choose Save as PDF. Reports are built from your latest run.</p>
      </div>
    </div>
  )
}
