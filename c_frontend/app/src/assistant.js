import { BASE_URL, USE_MOCK } from './api'

const money = (n) => `$${Math.round(n).toLocaleString()}`

export const SUGGESTIONS = [
  'Give me a summary of my store',
  'Which segment makes the most revenue?',
  'Who is at risk and what should I do?',
  'How do my competitors compare?',
  'What has worked in past campaigns?',
  'How much does Atelier cost to run?',
]

// Rule-based answers grounded in the latest run. This is NOT an LLM: it is the fallback
// until POST /api/chat exists. Every number comes from the run JSON.
export function localAnswer(q, run, costs) {
  const t = q.toLowerCase()
  const segs = run.insights.segments
  const customers = segs.reduce((n, s) => n + s.count, 0)
  const revenue = segs.reduce((n, s) => n + s.count * s.avg_spend, 0)
  const top = [...segs].sort((a, b) => b.count * b.avg_spend - a.count * a.avg_spend)[0]
  const atRisk = segs.find((s) => s.name === 'At risk')

  if (/risk|churn|lapsed|win.?back/.test(t) && atRisk) {
    const a = run.actions.filter((x) => x.segment === 'At risk')
    return `${atRisk.count} customers are At risk, each spending about ${money(atRisk.avg_spend)} before they lapsed (${money(atRisk.count * atRisk.avg_spend)} in total). ` +
      (a.length ? `Proposed: ${a.map((x) => x.title).join('; ')}.` : 'No action is proposed for them yet.')
  }
  if (/competit|oh polly|rival/.test(t)) {
    return run.competitors.map((c) => `${c.name} (${c.url}): ${c.promos.join('; ')}.`).join(' ') || 'No competitors tracked yet.'
  }
  if (/past|worked|history|campaign|promo/.test(t)) {
    return run.memory_used.length ? `From memory: ${run.memory_used.join('; ')}.` : 'No campaign results have been recorded yet. Approve actions and the next run will learn from them.'
  }
  if (/cost|spend on|price of atelier|cheaper/.test(t) && costs) {
    return `A run costs ${'$' + costs.total_usd.toFixed(3)} against about ${'$' + costs.frontier_equiv_usd.toFixed(2)} on a frontier model, ${Math.round(costs.savings_pct)}% cheaper.`
  }
  if (/revenue|best|top|most|money|sales/.test(t)) {
    return `${top.name} brings in the most: ${money(top.count * top.avg_spend)} lifetime from ${top.count} customers (${Math.round((top.count * top.avg_spend / revenue) * 100)}% of ${money(revenue)}).`
  }
  if (/action|todo|next|should/.test(t)) {
    return `Proposed actions: ${run.actions.map((a) => `${a.title} (${a.segment}, ${a.status})`).join('; ')}.`
  }
  if (/summary|overview|how am i|store/.test(t)) {
    return `${customers} customers and ${money(revenue)} in lifetime revenue. ${run.insights.working[0]} ${run.insights.fix[0]} ${run.actions.length} actions are proposed.`
  }
  return 'I can answer from your latest run: summary, revenue by segment, at-risk customers, competitors, past campaigns, actions and costs. Try one of the suggestions.'
}

// Tries the live endpoint (not in the contract yet), falls back to local answers.
export async function ask(messages, run, costs) {
  const q = messages[messages.length - 1].content
  if (!USE_MOCK) {
    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, run_id: run.run_id }),
        signal: AbortSignal.timeout(60_000),
      })
      if (res.ok) return { text: (await res.json()).reply, source: 'llm' }
    } catch {
      // fall through to local answer
    }
  }
  return { text: localAnswer(q, run, costs), source: 'local' }
}
