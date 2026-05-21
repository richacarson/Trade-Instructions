import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { OPEN_STATUSES } from '../lib/constants'
import Spinner from '../components/Spinner'
import { ErrorBox, EmptyState } from '../components/States'

export default function ClientList() {
  const [clients, setClients] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const [clientRes, openRes] = await Promise.all([
      supabase.from('clients').select('id,name,household_name').order('name'),
      supabase.from('instructions').select('client_id').in('status', OPEN_STATUSES),
    ])
    if (clientRes.error || openRes.error) {
      setError((clientRes.error || openRes.error).message)
    } else {
      setClients(clientRes.data ?? [])
      const tally = {}
      ;(openRes.data ?? []).forEach((row) => {
        tally[row.client_id] = (tally[row.client_id] ?? 0) + 1
      })
      setCounts(tally)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('clients-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instructions' },
        load,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        load,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-7">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-slate-100 md:text-3xl">
            Clients
          </h1>
          <p className="mt-1 text-sm text-slate-400">{clients.length} total</p>
        </div>
        <Link to="/new" className="btn-primary">
          New
        </Link>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorBox message={error} />
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          hint="Create your first instruction to add a client."
          actionTo="/new"
          actionLabel="New instruction"
        />
      ) : (
        <div className="card divide-y divide-white/5">
          {clients.map((c) => {
            const open = counts[c.id] ?? 0
            return (
              <Link
                key={c.id}
                to={`/client/${c.id}`}
                className="flex min-h-[44px] items-center justify-between px-4 py-3.5 transition hover:bg-white/[0.04]"
              >
                <div>
                  <div className="font-medium text-slate-100">{c.name}</div>
                  {c.household_name ? (
                    <div className="text-xs text-slate-500">
                      {c.household_name}
                    </div>
                  ) : null}
                </div>
                <span
                  className={[
                    'rounded-full px-2.5 py-0.5 font-mono text-xs',
                    open > 0
                      ? 'bg-sage/15 text-sage'
                      : 'bg-white/5 text-slate-500',
                  ].join(' ')}
                >
                  {open} open
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
