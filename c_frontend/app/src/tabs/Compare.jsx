import { useEffect, useState } from 'react'
import { getRun } from '../api'
import mock1 from '@shared/mock_run.json'
import mock2 from '@shared/mock_run_2.json'

function Col({ title, run }) {
  return (
    <div className="card">
      <h3>{title} ({run.run_id})</h3>
      <h4>Memory used</h4>
      {run.memory_used.length === 0 ? (
        <p className="muted">Nothing yet</p>
      ) : (
        <ul className="hl">{run.memory_used.map((m) => <li key={m}>{m}</li>)}</ul>
      )}
      <h4>Plan</h4>
      <ul>
        {run.actions.map((a) => (
          <li key={a.id}><strong>{a.title}</strong><br /><span className="muted">{a.why}</span></li>
        ))}
      </ul>
    </div>
  )
}

export default function Compare({ runs }) {
  const [a, setA] = useState(runs[0] || mock1)
  const [b, setB] = useState(runs[1] || mock2)

  useEffect(() => {
    if (runs.length >= 2) {
      getRun(runs[runs.length - 2].run_id).then((r) => r && setA(r))
      getRun(runs[runs.length - 1].run_id).then((r) => r && setB(r))
    }
  }, [runs])

  return (
    <>
      <p className="muted">Run 2 starts from what worked in run 1, so the plan changes.</p>
      <section className="cols">
        <Col title="Before" run={a} />
        <Col title="After" run={b} />
      </section>
    </>
  )
}
