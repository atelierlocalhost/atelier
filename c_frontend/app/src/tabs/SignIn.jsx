import { useState } from 'react'

export default function SignIn({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.')
    onSignIn(email.trim())
  }

  return (
    <div className="signin">
      <form className="card signin-card" onSubmit={submit}>
        <div className="logo-block"><img className="logo" src="/logo.png" alt="Atelier" /></div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to see your store.</p>
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary" type="submit">Sign in</button>
        <p className="muted">Demo sign-in: no password is checked yet.</p>
      </form>
    </div>
  )
}
