import { useState } from 'react'

// Hotlinked images can fail once in a while. Retry twice with a cache-busting param, then show the alt text.
export default function RetryImg({ src, alt, ...rest }) {
  const [tries, setTries] = useState(0)
  const url = tries === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}r=${tries}`
  return (
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => tries < 2 && setTimeout(() => setTries(tries + 1), 600)}
      {...rest}
    />
  )
}
