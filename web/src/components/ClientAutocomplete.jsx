import { useMemo, useState } from 'react'

// value: { id: string | null, name: string } | null
// id === null means "create a new client with this name".
export default function ClientAutocomplete({ clients, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients.slice(0, 8)
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [clients, query])

  const hasExact = clients.some(
    (c) => c.name.toLowerCase() === query.trim().toLowerCase(),
  )

  if (value) {
    return (
      <div className="flex min-h-[44px] items-center justify-between rounded-lg border border-sage/40 bg-sage/10 px-3 py-2">
        <span className="text-sm text-slate-100">
          {value.name}
          {value.id === null ? (
            <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-xs text-gold">
              new client
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-2 text-slate-400 hover:text-slate-100"
          aria-label="Change client"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="Search clients…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open ? (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/15 bg-navy shadow-xl">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center px-3 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  onChange({ id: c.id, name: c.name })
                  setQuery('')
                }}
              >
                <span className="text-slate-100">{c.name}</span>
                {c.household_name ? (
                  <span className="ml-2 text-xs text-slate-500">
                    {c.household_name}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {query.trim() && !hasExact ? (
            <li>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center border-t border-white/10 px-3 text-left text-sm font-medium text-gold hover:bg-white/10"
                onClick={() => {
                  onChange({ id: null, name: query.trim() })
                  setQuery('')
                }}
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          ) : null}
          {matches.length === 0 && !query.trim() ? (
            <li className="px-3 py-3 text-sm text-slate-500">
              No clients yet — type a name to create one.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
