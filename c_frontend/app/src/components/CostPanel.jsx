import { useEffect, useState } from 'react'
import { getCosts } from '../api'

export default function CostPanel({ runKey }) {
  const [c, setC] = useState(null)
  useEffect(() => {
    getCosts().then(setC).catch(() => setC(null))
  }, [runKey])
  if (!c || c.sie_usd === undefined) return null
  const ours = c.sie_usd + c.tinfoil_usd + c.darkbloom_usd
  const rows = [
    ['SIE', c.sie_usd],
    ['Tinfoil', c.tinfoil_usd],
    ['Darkbloom', c.darkbloom_usd],
  ]
  return (
    <footer className="costs card">
      <h3>Cost per run</h3>
      <div className="cost-row">
        {rows.map(([n, v]) => <span key={n}>{n}: ${v.toFixed(3)}</span>)}
        <strong>Atelier total: ${ours.toFixed(3)}</strong>
        <strong>Frontier model: ${c.frontier_equiv_usd.toFixed(2)}</strong>
        <span className="pill ok">{Math.round((1 - ours / c.frontier_equiv_usd) * 100)}% cheaper</span>
      </div>
    </footer>
  )
}
