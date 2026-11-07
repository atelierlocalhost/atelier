// Demo client for the pitch: Because Of Alice (contemporary British womenswear).
// Figures below are INVENTED for the demo, not the brand's real numbers.
// Competitor name, URL and promos were read from the competitor's public site.
export const DEMO_CLIENT = { name: 'Because Of Alice', url: 'https://www.becauseofalice.com/' }

const SEGMENTS_BEFORE = [
  { name: 'Champions', count: 142, avg_spend: 640 },
  { name: 'Loyal', count: 318, avg_spend: 310 },
  { name: 'New', count: 205, avg_spend: 118 },
  { name: 'At risk', count: 236, avg_spend: 142 },
  { name: 'Hibernating', count: 489, avg_spend: 64 },
]

// Demo only: invented customer base after the win-back email ran, so Compare has a story.
const SEGMENTS_AFTER = [
  { name: 'Champions', count: 149, avg_spend: 652 },
  { name: 'Loyal', count: 346, avg_spend: 318 },
  { name: 'New', count: 231, avg_spend: 126 },
  { name: 'At risk', count: 198, avg_spend: 148 },
  { name: 'Hibernating', count: 466, avg_spend: 66 },
]

const COMPETITORS = [
  {
    name: 'Oh Polly',
    url: 'https://www.ohpolly.com/',
    promos: [
      'Free UK next day delivery over £120',
      'Free UK returns with store credit or exchange',
      'Tops: 2 for £40',
      'Swim: buy 2 or more, save 40%',
    ],
    price_gap_pct: null, // not measured yet
  },
]

const SOCIAL = [
  {
    caption: 'Tailored for the evening. New eveningwear edit, now live.',
    sound: 'Golden Hour (slowed)',
    slides: [
      { headline: 'The evening edit', body: 'Sharp tailoring, soft drape.' },
      { headline: 'Made to move', body: 'From dinner to the dance floor.' },
      { headline: 'Style it three ways', body: 'Blazer, midi, co-ord.' },
      { headline: 'Wedding guest ready', body: 'Dresses for every dress code.' },
      { headline: 'Shop now', body: 'Contemporary British womenswear.' },
    ],
  },
]

export function applyClient(run) {
  const r = structuredClone(run)
  const SEGMENTS = run.run_id === 'r_002' ? SEGMENTS_AFTER : SEGMENTS_BEFORE
  const total = SEGMENTS.reduce((n, s) => n + s.count, 0)
  const by = (n) => SEGMENTS.find((s) => s.name === n)
  const revenue = SEGMENTS.reduce((n, s) => n + s.count * s.avg_spend, 0)
  const champShare = Math.round((by('Champions').count * by('Champions').avg_spend / revenue) * 100)
  r.insights.segments = SEGMENTS.map((s) => ({ ...s }))
  r.insights.working = [
    `Champions (${by('Champions').count} customers) drive ${champShare}% of revenue with avg spend $${by('Champions').avg_spend}`,
    `New customers are arriving steadily: ${by('New').count} in the last 60 days`,
  ]
  r.insights.fix = [
    `${by('At risk').count} At risk customers haven't ordered in 90+ days but used to spend $${by('At risk').avg_spend} on average`,
    `Hibernating is the largest segment (${by('Hibernating').count} of ${total}) with low avg spend`,
  ]
  r.competitors = COMPETITORS.map((c) => ({ ...c, promos: [...c.promos] }))
  r.actions = r.actions.map((a) => ({
    ...a,
    why: a.why.replace(/Maison Verte's linen promo/g, "Oh Polly's multi-buy promos").replace(/linen/gi, 'tailoring'),
    title: a.title.replace(/Linen essentials/g, 'Tailoring essentials').replace(/linen/gi, 'tailoring'),
  }))
  r.social = SOCIAL
  return r
}

// Collections and promo read from the public homepage. No products or prices are invented.
export const DEMO_STORE = {
  tagline: 'Contemporary British Womenswear',
  promo: 'Sign up to get 10% off your first order',
  collections: ['Outerwear', 'Knitwear', 'Co-ords', 'Dresses', 'Blazers', 'Trousers', 'Tops & Bodysuits', 'Skirts'],
  edits: ['Tailoring', 'Leather', 'Eveningwear'],
  occasions: ['Partywear', 'Bridal', 'Vacation', 'Wedding Guest'],
}

// What the demo client offers today, read from its public homepage. Missing keys mean "not known".
export const OWN_OFFERS = {
  'First-order offer': 'Sign-up gets 10% off the first order',
  'Percent off': 'Outlet section',
  Delivery: 'No free delivery offer stated (calculated at checkout)',
  'Multi-buy': 'None seen',
}
