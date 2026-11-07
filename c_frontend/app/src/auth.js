// DEMO ONLY: no password is checked and nothing leaves the browser.
// Real sign-in needs backend endpoints that are not in the API contract yet.
const KEY = 'atelier_session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function signIn(email) {
  const s = { email, at: Date.now() }
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage blocked: session lasts until reload
  }
  return s
}

export function signOut() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

const CKEY = 'atelier_connections'
export function getConnections() {
  try {
    return JSON.parse(localStorage.getItem(CKEY)) || {}
  } catch {
    return {}
  }
}
export function setConnection(name, value) {
  const c = { ...getConnections(), [name]: value }
  try {
    localStorage.setItem(CKEY, JSON.stringify(c))
  } catch {
    // ignore
  }
  return c
}
