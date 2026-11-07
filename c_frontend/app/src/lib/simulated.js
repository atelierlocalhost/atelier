// Stable demo values: the same boutique keeps the same figures on refresh.
export function shopNumbers(key = '') {
  const seed = [...String(key)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)
  const orders = 60 + seed % 240
  const basket = 35 + seed % 85
  return { orders_90d: orders, revenue_90d: orders * basket, repeat_rate_pct: 25 + seed % 46, basket }
}
export const hasNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0

export function fillShopNumbers(client) {
  const fallback = shopNumbers(client.id || client.name)
  const result = { ...client }
  const simulated = []
  for (const key of ['orders_90d', 'revenue_90d', 'repeat_rate_pct']) {
    if (!hasNumber(result[key])) {
      result[key] = fallback[key]
      simulated.push(key)
    }
  }
  if (!Array.isArray(result.monthly) || !result.monthly.length) {
    const now = new Date()
    result.monthly = Array.from({ length: 6 }, (_, i) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      return { name: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`, value: Math.round(result.revenue_90d / 3 * [0.8, 0.9, 0.85, 0.95, 1, 1.05][i]) }
    })
    simulated.push('monthly')
  } else {
    result.monthly = result.monthly.map((m) => {
      if (hasNumber(m.value)) return m
      simulated.push('monthly')
      return { ...m, value: Math.round(result.revenue_90d / 3) }
    })
  }
  return { ...result, simulatedFields: simulated }
}
