import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // session: undefined while loading, then null or a Session object.
  const [session, setSession] = useState(undefined)
  // allowed: null while unknown, then true/false once the allowlist is checked.
  const [allowed, setAllowed] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) {
      setAllowed(null)
      return
    }
    let cancelled = false
    setAllowed(null)
    supabase
      .from('allowed_users')
      .select('email')
      .eq('email', (session.user.email ?? '').toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setAllowed(Boolean(data))
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const loading = session === undefined || (Boolean(session) && allowed === null)

  const value = {
    session,
    user: session?.user ?? null,
    email: session?.user?.email ?? null,
    allowed,
    loading,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
