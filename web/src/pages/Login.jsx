import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

function friendlyError(message) {
  const m = (message || '').toLowerCase()
  if (m.includes('already registered'))
    return 'An account with this email already exists — switch to Sign in.'
  if (m.includes('invalid login credentials'))
    return 'Incorrect email or password.'
  if (m.includes('email not confirmed'))
    return 'Please confirm your email first — check your inbox.'
  if (m.includes('database error'))
    return "This email isn't approved for the app. Ask Carson to add you."
  return message || 'Something went wrong.'
}

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const isSignup = mode === 'signup'

  const switchMode = () => {
    setMode(isSignup ? 'signin' : 'signup')
    setConfirmPassword('')
    setError(null)
    setInfo(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Enter your email.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (isSignup && password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setBusy(true)

    if (isSignup) {
      const { data: allowed, error: rpcError } = await supabase.rpc(
        'is_email_allowed',
        { check_email: cleanEmail },
      )
      if (rpcError) {
        setError(rpcError.message)
        setBusy(false)
        return
      }
      if (!allowed) {
        setError(
          "This email isn't on the approved list. Ask Carson to add you, then try again.",
        )
        setBusy(false)
        return
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      })
      if (signUpError) {
        setError(friendlyError(signUpError.message))
        setBusy(false)
        return
      }
      if (!data.session) {
        setInfo('Account created. Check your email to confirm it, then sign in.')
        setMode('signin')
        setBusy(false)
      }
      // If a session was returned, AuthProvider takes over from here.
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })
      if (signInError) {
        setError(friendlyError(signInError.message))
        setBusy(false)
      }
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-navy px-4 py-8">
      <div className="card w-full max-w-sm bg-white/[0.04] p-8">
        <div className="text-center">
          <Logo variant="full" size="lg" className="justify-center text-slate-100" />
          <h1 className="mt-6 font-display text-xl text-slate-100">
            Trade Instructions
          </h1>
          <p className="mt-1 text-sm text-sage">
            {isSignup ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="first.last@paradiem.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              className="input"
              placeholder={
                isSignup ? 'Choose a password (8+ characters)' : 'Your password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {isSignup ? (
            <div>
              <label className="label" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="input"
                placeholder="Type your password again"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          ) : null}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {info ? <p className="mt-3 text-sm text-sage">{info}</p> : null}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={switchMode}
            className="text-sm font-medium text-gold hover:underline"
          >
            {isSignup
              ? 'Already have an account? Sign in'
              : 'First time here? Create your account'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Access is restricted to approved team members.
        </p>
      </div>
    </div>
  )
}
