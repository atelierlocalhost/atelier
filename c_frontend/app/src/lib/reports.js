// Builds downloadable reports from run data. Everything is computed in the browser.
const money = (n) => `$${Math.round(n).toLocaleString()}`

export const REPORTS = {
  financial: 'Financial summary',
  insights: 'Customer insights',
  campaigns: 'Campaigns and actions',
}

export function buildReport(kind, run, costs, client = 'Your store') {
  const segs = run.insights.segments
  const customers = segs.reduce((n, s) => n + s.count, 0)
  const revenue = segs.reduce((n, s) => n + s.count * s.avg_spend, 0)
  const date = new Date().toISOString().slice(0, 10)
  const head = { title: `${REPORTS[kind]}: ${client}`, subtitle: `Run ${run.run_id}, generated ${date}` }

  if (kind === 'financial') {
    return {
      ...head,
      sections: [
        { heading: 'Totals', rows: [['Metric', 'Value'], ['Customers', customers], ['Lifetime revenue', money(revenue)], ['Revenue per customer', money(revenue / customers)]] },
        { heading: 'Revenue by segment', rows: [['Segment', 'Customers', 'Avg spend', 'Lifetime revenue', 'Share'], ...segs.map((s) => [s.name, s.count, money(s.avg_spend), money(s.count * s.avg_spend), `${Math.round((s.count * s.avg_spend / revenue) * 100)}%`])] },
        ...(costs ? [{ heading: 'Cost of running Atelier (per run)', rows: [['Provider', 'Cost'], ...costs.providers.map((p) => [p.provider, `$${p.usd.toFixed(3)}`]), ['Total', `$${costs.total_usd.toFixed(3)}`], ['Frontier model equivalent', `$${costs.frontier_equiv_usd.toFixed(2)}`]] }] : []),
        { heading: 'Note', text: 'Revenue is lifetime spend by segment. Profit, margins and cash flow need accounting data that is not connected yet.' },
      ],
    }
  }
  if (kind === 'insights') {
    return {
      ...head,
      sections: [
        { heading: 'Segments', rows: [['Segment', 'Customers', 'Avg spend'], ...segs.map((s) => [s.name, s.count, money(s.avg_spend)])] },
        { heading: 'What is working', list: run.insights.working },
        { heading: 'What to fix', list: run.insights.fix },
        { heading: 'Competitors', rows: [['Competitor', 'URL', 'Promos'], ...run.competitors.map((c) => [c.name, c.url, c.promos.join('; ')])] },
      ],
    }
  }
  return {
    ...head,
    sections: [
      { heading: 'Proposed and applied actions', rows: [['Action', 'Type', 'Segment', 'Status', 'Why'], ...run.actions.map((a) => [a.title, a.type, a.segment, a.status, a.why])] },
      { heading: 'Used from memory', list: run.memory_used.length ? run.memory_used : ['Nothing recorded yet.'] },
    ],
  }
}

export function toMarkdown(r) {
  const out = [`# ${r.title}`, r.subtitle, '']
  for (const s of r.sections) {
    out.push(`## ${s.heading}`)
    if (s.text) out.push(s.text)
    if (s.list) out.push(...s.list.map((x) => `- ${x}`))
    if (s.rows) {
      out.push(`| ${s.rows[0].join(' | ')} |`, `|${s.rows[0].map(() => '---').join('|')}|`)
      s.rows.slice(1).forEach((row) => out.push(`| ${row.join(' | ')} |`))
    }
    out.push('')
  }
  return out.join('\n')
}

const csvCell = (v) => {
  let t = String(v)
  if (/^[=+\-@]/.test(t)) t = `'${t}` // stop spreadsheet formula injection
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
export function toCsv(r) {
  const out = []
  for (const s of r.sections) {
    if (!s.rows) continue
    out.push(csvCell(s.heading), ...s.rows.map((row) => row.map(csvCell).join(',')), '')
  }
  return out.join('\n')
}

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export function toHtml(r) {
  const body = r.sections.map((s) => `<h2>${esc(s.heading)}</h2>` +
    (s.text ? `<p>${esc(s.text)}</p>` : '') +
    (s.list ? `<ul>${s.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
    (s.rows ? `<table><tr>${s.rows[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${s.rows.slice(1).map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '')).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
body{font-family:Georgia,serif;color:#2b1838;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6}
h1{color:#3c204f;font-weight:400}h2{margin-top:1.6rem;font-weight:400;border-bottom:1px solid #ddd}
table{border-collapse:collapse;width:100%;font-size:.875rem}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f3eefa}
.sub{color:#6f6479}</style></head><body><h1>${esc(r.title)}</h1><p class="sub">${esc(r.subtitle)}</p>${body}</body></html>`
}

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Opens a print-ready page; choose "Save as PDF" in the print dialog.
export function printPdf(r) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(toHtml(r))
  w.document.close()
  w.focus()
  w.print()
  return true
}
