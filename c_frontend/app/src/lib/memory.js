// Real past results come from run.memory_used, e.g. "Win-back email to At risk: 12% redeemed".
export function parseMemory(items) {
  return items
    .map((m) => {
      const x = m.match(/^(.*?) to (.*?): (\d+(?:\.\d+)?)% (.+)$/)
      return x ? { name: x[1], segment: x[2], value: Number(x[3]), metric: x[4], source: 'memory' } : null
    })
    .filter(Boolean)
}
