import { useState } from 'react'

const fmtDefault = (n) => n.toLocaleString()

// Panel with a title, a chart/table toggle, and the chart body.
export function ChartCard({ title, subtitle, data, format = fmtDefault, children, className = '' }) {
  const [table, setTable] = useState(false)
  return (
    <div className={`card chart-card ${className}`}>
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button className="btn small" onClick={() => setTable(!table)}>
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <table className="data-table">
          <tbody>
            {data.map((d) => (
              <tr key={d.name}><th>{d.name}</th><td>{format(d.value)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </div>
  )
}

// Horizontal bars: thin (<=24px), rounded data end, value at the tip, hover tooltip.
export function HBar({ data, format = fmtDefault, selected, onSelect }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...data.map((d) => d.value)) || 1
  return (
    <div className="hbar">
      {data.map((d) => (
        <div
          className={`hbar-row${onSelect ? ' clickable' : ''}${selected && selected !== d.name ? ' dim' : ''}`}
          key={d.name}
          onMouseEnter={() => setHover(d.name)}
          onMouseLeave={() => setHover(null)}
          onClick={onSelect ? () => onSelect(d.name) : undefined}
          onKeyDown={onSelect ? (e) => e.key === 'Enter' && onSelect(d.name) : undefined}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
        >
          <span className="hbar-label"><i style={{ background: d.color }} />{d.name}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
            <span className="hbar-val">{format(d.value)}</span>
          </div>
          {hover === d.name && <span className="tip">{d.name}: {format(d.value)}</span>}
        </div>
      ))}
    </div>
  )
}

// Donut with 2px surface gaps between slices, center total, and a legend.
export function Donut({ data, format = fmtDefault, centerLabel, selected, onSelect }) {
  const [hover, setHover] = useState(null)
  const total = data.reduce((n, d) => n + d.value, 0) || 1
  const R = 70, C = 2 * Math.PI * R
  const starts = data.map((_, i) => data.slice(0, i).reduce((n, d) => n + d.value, 0) / total * C)
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" className="donut" role="img" aria-label={centerLabel}>
        <g transform="rotate(-90 90 90)">
          {data.map((d, i) => {
            const len = (d.value / total) * C
            return (
              <circle
                key={d.name} cx="90" cy="90" r={R} fill="none" stroke={d.color}
                strokeWidth={hover === d.name || selected === d.name ? 27 : 22}
                opacity={selected && selected !== d.name ? 0.35 : 1}
                onClick={onSelect ? () => onSelect(d.name) : undefined}
                strokeDasharray={`${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`}
                strokeDashoffset={-starts[i]}
                onMouseEnter={() => setHover(d.name)} onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </g>
        <text x="90" y="86" textAnchor="middle" className="donut-n">
          {format((data.find((d) => d.name === (hover || selected)) || { value: total }).value)}
        </text>
        <text x="90" y="106" textAnchor="middle" className="donut-l">{hover || selected || centerLabel}</text>
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li
            key={d.name}
            className={onSelect ? 'clickable' : undefined}
            onClick={onSelect ? () => onSelect(d.name) : undefined}
            style={selected && selected !== d.name ? { opacity: 0.5 } : undefined}
          >
            <i style={{ background: d.color }} />
            {d.name} <span className="muted">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Before/after bars per row. Before is muted, after carries the row color. Values in the tooltip and table view.
export function GroupedBars({ rows, format = fmtDefault }) {
  const max = Math.max(...rows.flatMap((r) => [r.before, r.after])) || 1
  return (
    <div className="hbar">
      {rows.map((r) => (
        <div className="grouped-row" key={r.name}>
          <span className="hbar-label"><i style={{ background: r.color }} />{r.name}</span>
          <div className="grouped-bars">
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(r.before / max) * 100}%`, background: 'var(--line)', border: '1px solid var(--border-strong)' }} />
              <span className="hbar-val muted">{format(r.before)}</span>
            </div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(r.after / max) * 100}%`, background: r.color }} />
              <span className="hbar-val">{format(r.after)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
