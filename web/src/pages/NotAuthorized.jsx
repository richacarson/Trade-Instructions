import { useAuth } from '../lib/auth'
import Logo from '../components/Logo'

export default function NotAuthorized() {
  const { email, signOut } = useAuth()

  return (
    <div className="flex h-full items-center justify-center bg-navy px-4">
      <div className="card w-full max-w-sm bg-white/[0.04] p-8 text-center">
        <Logo variant="mark" size="lg" className="justify-center text-slate-100" />
        <h1 className="mt-5 font-display text-xl text-slate-100">Not authorized</h1>
        <p className="mt-3 text-sm text-slate-400">
          <span className="text-slate-200">{email}</span> is not on the approved
          list for this dashboard.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Ask Carson to add you to the allowlist, then sign in again.
        </p>
        <button onClick={signOut} className="btn-ghost mt-6 w-full">
          Sign out
        </button>
      </div>
    </div>
  )
}
