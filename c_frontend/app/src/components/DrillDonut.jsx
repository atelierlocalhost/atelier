import { useState } from 'react'
import { Donut } from './Charts'

// A donut where clicking a slice shows details for it. renderDetail(name) returns the panel body.
export default function DrillDonut({ title, subtitle, data, format, centerLabel, renderDetail }) {
  const [selected, setSelected] = useState(null)
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      {subtitle && <p className="muted">{subtitle}</p>}
      <Donut data={data} format={format} centerLabel={centerLabel} selected={selected} onSelect={(n) => setSelected(selected === n ? null : n)} />
      <div className="drill-body">
        {selected ? (
          <>
            <h4>{selected}</h4>
            {renderDetail(selected)}
          </>
        ) : (
          <p className="muted">Click a slice for the breakdown.</p>
        )}
      </div>
    </div>
  )
}
