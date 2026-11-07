// Turns competitor promo strings into comparable mechanics and suggested responses.
export const MECHANICS = ['Delivery', 'Returns', 'Multi-buy', 'Percent off', 'First-order offer']

export function classify(promo) {
  const p = promo.toLowerCase()
  if (/first order|sign.?up|welcome/.test(p)) return 'First-order offer'
  if (/return/.test(p)) return 'Returns'
  if (/deliver|shipping/.test(p)) return 'Delivery'
  if (/\b\d\s*for\b|buy \d|bundle|multi/.test(p)) return 'Multi-buy'
  if (/\d+\s*%|off\b|sale/.test(p)) return 'Percent off'
  return null
}

const RESPONSE = {
  Delivery: {
    action: 'Test free delivery above a spend threshold',
    detail: 'Offer free delivery over a threshold close to your average order value. Start with Loyal and New customers and compare conversion against a control week.',
    segment: 'Loyal',
  },
  Returns: {
    action: 'Publish an easy returns promise',
    detail: 'State returns terms clearly on product pages and in the win-back email. Easy returns reduce hesitation on higher-priced dresses and tailoring.',
    segment: 'At risk',
  },
  'Multi-buy': {
    action: 'Launch a multi-buy bundle',
    detail: 'Pair tops, knitwear or co-ords at a bundle price to raise order value and answer their multi-buy offers.',
    segment: 'Loyal',
  },
  'Percent off': {
    action: 'Run a time-boxed percentage promo',
    detail: 'Use a short, targeted discount for Hibernating customers instead of sitewide sales, so margin is protected.',
    segment: 'Hibernating',
  },
  'First-order offer': {
    action: 'Promote your first-order offer harder',
    detail: 'They do not advertise one. Feature yours in paid social and the sign-up popup to win comparison shoppers.',
    segment: 'New',
  },
}

// One row per mechanic either side uses: who leads, and what to do about it.
export function analyse(competitor, own) {
  const theirs = {}
  competitor.promos.forEach((p) => {
    const m = classify(p)
    if (m && !theirs[m]) theirs[m] = p
  })
  const hasOwn = (m) => own[m] && !/^none|no free/i.test(own[m])
  return MECHANICS.filter((m) => theirs[m] || own[m]).map((m) => {
    const they = theirs[m]
    const you = hasOwn(m)
    const unknown = they && own[m] === undefined
    const status = unknown ? 'Check yours' : they && !you ? 'They lead' : they && you ? 'Both offer' : 'You lead'
    return { mechanic: m, theirs: they || 'Nothing seen', yours: own[m] || 'Not known', status, response: status === 'They lead' ? RESPONSE[m] : null }
  })
}

const gbp = (n) => `£${Math.round(n)}`

// Compare catalogue metrics from the two public product feeds. Returns who leads on each, with insight and action.
export function benchmark(theirs, mine, name) {
  const gap = Math.round(((theirs.dressMedian - mine.dressMedian) / mine.dressMedian) * 100)
  return [
    {
      metric: 'Median dress price',
      them: gbp(theirs.dressMedian), you: gbp(mine.dressMedian),
      lead: theirs.dressMedian < mine.dressMedian ? 'They lead' : 'You lead',
      insight: `${name} dresses are ${Math.abs(gap)}% ${gap < 0 ? 'cheaper' : 'pricier'} at the median. You sit in the premium tier, so competing on price would hurt margin.`,
      action: 'Hold price, but justify it: lead product pages and ads with tailoring, fabric and fit, and show the price per wear.',
      segment: 'New',
    },
    {
      metric: 'Share of catalogue on sale',
      them: `${theirs.onSalePct}%`, you: `${mine.onSalePct}%`,
      lead: theirs.onSalePct < mine.onSalePct ? 'They lead' : 'You lead',
      insight: `You mark down ${mine.onSalePct}% of products against ${theirs.onSalePct}% for ${name}. Frequent markdowns train customers to wait for sales and weaken a premium position.`,
      action: 'Cut blanket markdowns. Replace them with targeted offers (win-back for At risk, early access for Champions).',
      segment: 'At risk',
    },
    {
      metric: 'Products in stock',
      them: `${theirs.inStockPct}%`, you: `${mine.inStockPct}%`,
      lead: theirs.inStockPct > mine.inStockPct ? 'They lead' : 'You lead',
      insight: `${mine.inStockPct}% of your range is available against ${theirs.inStockPct}%. Availability is a strength.`,
      action: 'Mention availability in campaigns: "in stock, ships now".',
      segment: 'Loyal',
    },
    {
      metric: 'Photos per product',
      them: theirs.avgImages, you: mine.avgImages,
      lead: theirs.avgImages > mine.avgImages ? 'They lead' : 'You lead',
      insight: `You show ${mine.avgImages} photos per product against ${theirs.avgImages}. Richer imagery supports a higher price.`,
      action: 'Reuse your extra product photography in social carousels and email.',
      segment: 'New',
    },
    {
      metric: 'Variants per product',
      them: theirs.avgVariants, you: mine.avgVariants,
      lead: theirs.avgVariants > mine.avgVariants ? 'They lead' : 'You lead',
      insight: `${name} lists ${theirs.avgVariants} size and colour variants per product against your ${mine.avgVariants}. A wider size run can reduce lost sales and returns.`,
      action: 'Review your size range and restock the sizes that sell out first.',
      segment: 'Loyal',
    },
  ]
}
