import { statusLabel } from '../lib/constants'

const STYLES = {
  open: 'bg-sage/15 text-sage ring-1 ring-sage/30',
  in_progress: 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30',
  blocked: 'bg-red-500/15 text-red-300 ring-1 ring-red-400/40',
  done: 'bg-white/10 text-slate-400 ring-1 ring-white/10',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? STYLES.open}`}
    >
      {statusLabel(status)}
    </span>
  )
}
