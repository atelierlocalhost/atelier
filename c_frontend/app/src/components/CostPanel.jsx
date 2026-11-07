import { useEffect, useState } from 'react'
import { getCosts } from '../api'

const LABELS = { sie: 'SIE', tinfoil: 'Tinfoil', darkbloom: 'Darkbloom' }

export default function CostPanel({ runId }) {
  const [c, setC] = useState(null)
  useEffect(() => {
    getCosts(runId).then(setC).catch(() => setC(null))
  }, [runId])
  if (!c) return null
  return (
    <footer className="costs card">
      <h3>Cost per run</h3>
      <div className="cost-row">
        {c.providers.map((p) => (
          <span key={p.provider}>{LABELS[p.provider] || p.provider}: ${p.usd.toFixed(3)}</span>
        ))}
        <strong>Atelier total: ${c.total_usd.toFixed(3)}</strong>
        <strong>Frontier model: ${c.frontier_equiv_usd.toFixed(2)}</strong>
        <span className="pill ok">{Math.round(c.savings_pct)}% cheaper</span>
      </div>
    </footer>
  )
}
