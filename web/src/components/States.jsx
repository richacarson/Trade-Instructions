import { Link } from 'react-router-dom'

export function ErrorBox({ message }) {
  return (
    <div className="card border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
      {message || 'Something went wrong.'}
    </div>
  )
}

export function EmptyState({ title, hint, actionTo, actionLabel }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-display text-lg text-slate-200">{title}</p>
      {hint ? <p className="text-sm text-slate-400">{hint}</p> : null}
      {actionTo ? (
        <Link to={actionTo} className="btn-primary mt-3">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
