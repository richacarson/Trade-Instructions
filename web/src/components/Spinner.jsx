export default function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-sage/30 border-t-sage" />
      {label ? <span className="text-sm text-slate-400">{label}</span> : null}
    </div>
  )
}
