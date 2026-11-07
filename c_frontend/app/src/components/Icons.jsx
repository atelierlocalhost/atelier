const P = {
  store: 'M3 9l1.5-5h15L21 9M4 9v11h16V9M9 20v-6h6v6',
  insights: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  actions: 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9',
  emails: 'M3 6h18v12H3zM3 7l9 7 9-7',
  social: 'M12 21s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z',
  compare: 'M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4',
  chat: 'M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z',
  lab: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2.2h12.4a1.5 1.5 0 001.3-2.2L14 9V3M7 15h10',
  arrow: 'M7 17L17 7M8 7h9v9',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.35-4.35',
  clients: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1a4 4 0 00-3-3.85M15.5 4.2a3.5 3.5 0 010 6.6',
  report: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6',
}
export default function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
