import SlideCard from '../components/SlideCard'

const COLORS = ['bg', 'surface', 'ink', 'muted', 'line', 'accent', 'accent-ink', 'good', 'bad', 'hl', 'danger']
const SPACE = [1, 2, 3, 4, 5, 6]

// Living reference for the design system. Open with /#design.
export default function StyleGuide() {
  return (
    <div className="app">
      <h1>Atelier design system</h1>
      <p className="muted">Tokens live in src/design/tokens.css. Full rules in c_frontend/DESIGN.md.</p>

      <h2>Brand</h2>
      <div className="brandbar" style={{ margin: 0 }}>
        <img className="logo" src="/logo.png" alt="Atelier" />
      </div>

      <h2>Color tokens</h2>
      <div className="grid">
        {COLORS.map((c) => (
          <div className="card" key={c}>
            <div style={{ background: `var(--${c})`, height: 40, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} />
            <p className="muted">--{c}</p>
          </div>
        ))}
      </div>

      <h2>Type</h2>
      <div className="card">
        <h1>Heading XL</h1>
        <h2>Heading L</h2>
        <h3>Heading M</h3>
        <p>Body text in Georgia.</p>
        <p className="muted">Muted helper text.</p>
      </div>

      <h2>Spacing</h2>
      <div className="card">
        {SPACE.map((n) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
            <div style={{ width: `var(--space-${n})`, height: 12, background: 'var(--accent)' }} />
            <span className="muted">--space-{n}</span>
          </div>
        ))}
      </div>

      <h2>Buttons and pills</h2>
      <div className="card cost-row">
        <button className="btn primary">Primary</button>
        <button className="btn">Secondary</button>
        <button className="btn primary" disabled>Disabled</button>
        <span className="pill">Default</span>
        <span className="pill alt">Highlight</span>
        <span className="pill ok">Success</span>
      </div>

      <h2>Cards</h2>
      <div className="cols">
        <div className="card"><p className="muted">Stat</p><p className="big">42</p><p className="muted">sub label</p></div>
        <div className="card good"><h3>Good</h3><p>Positive callout.</p></div>
        <div className="card bad"><h3>Needs attention</h3><p>Negative callout.</p></div>
      </div>

      <h2>Social slide</h2>
      <SlideCard slide={{ headline: 'New on the rail', body: 'Washed linen.' }} index={0} total={5} />
    </div>
  )
}
