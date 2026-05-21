import { daysOpen, staleLevel } from '../lib/format'

const STYLES = {
  fresh: 'bg-white/10 text-slate-300',
  warn: 'bg-gold/20 text-gold ring-1 ring-gold/40',
  stale: 'bg-red-500/20 text-red-200 ring-1 ring-red-400/50',
}

export default function StaleBadge({ createdAt }) {
  const days = daysOpen(createdAt)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs ${STYLES[staleLevel(days)]}`}
    >
      {days}d open
    </span>
  )
}
