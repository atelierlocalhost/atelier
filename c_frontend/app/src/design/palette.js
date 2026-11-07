// Fixed segment order, same color for the same entity everywhere (charts, cards, board).
export const SEGMENTS = {
  Champions: { mark: 'var(--seg-champions)', tint: 'var(--tint-lavender)' },
  Loyal: { mark: 'var(--seg-loyal)', tint: 'var(--tint-sky)' },
  New: { mark: 'var(--seg-new)', tint: 'var(--tint-mint)' },
  'At risk': { mark: 'var(--seg-atrisk)', tint: 'var(--tint-peach)' },
  Hibernating: { mark: 'var(--seg-hibernating)', tint: 'var(--tint-pink)' },
}
export const segMark = (n) => SEGMENTS[n]?.mark || 'var(--purple-500)'
export const segTint = (n) => SEGMENTS[n]?.tint || 'var(--tint-butter)'
