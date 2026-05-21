import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const signIn = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email',
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-navy px-4">
      <div className="card w-full max-w-sm bg-white/[0.04] p-8 text-center">
        <Logo variant="full" size="lg" className="justify-center text-slate-100" />
        <h1 className="mt-6 font-display text-xl text-slate-100">
          Trade Instructions
        </h1>
        <p className="mt-1 text-sm text-sage">IOWN investment team</p>

        <button onClick={signIn} disabled={busy} className="btn-primary mt-8 w-full">
          {busy ? 'Redirecting…' : 'Sign in with Microsoft'}
        </button>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        <p className="mt-6 text-xs text-slate-500">
          Access is restricted to approved team members.
        </p>
      </div>
    </div>
  )
}
