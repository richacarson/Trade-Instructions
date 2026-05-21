import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { relativeTime } from '../lib/format'
import Spinner from '../components/Spinner'
import StaleBadge from '../components/StaleBadge'
import StatusBadge from '../components/StatusBadge'
import { ChevronDown, BackIcon } from '../components/Icons'
import { ErrorBox, EmptyState } from '../components/States'

const GROUPS = [
  { status: 'open', label: 'Open', defaultOpen: true },
  { status: 'in_progress', label: 'In Progress', defaultOpen: true },
  { status: 'blocked', label: 'Blocked', defaultOpen: true },
  { status: 'done', label: 'Done', defaultOpen: false },
]

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const [clientRes, insRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id,name,household_name')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('instructions')
        .select('id,title,owner,status,created_at,updated_at')
        .eq('client_id', id)
        .order('updated_at', { ascending: true }),
    ])
    if (clientRes.error || insRes.error) {
      setError((clientRes.error || insRes.error).message)
    } else {
      setClient(clientRes.data)
      setItems(insRes.data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`client-detail-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instructions',
          filter: `client_id=eq.${id}`,
        },
        load,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instruction_steps' },
        load,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, id])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-7">
      <Link
        to="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100"
      >
        <BackIcon width={16} height={16} /> Clients
      </Link>

      {error ? (
        <ErrorBox message={error} />
      ) : !client ? (
        <EmptyState
          title="Client not found"
          actionTo="/clients"
          actionLabel="Back to clients"
        />
      ) : (
        <>
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl text-slate-100 md:text-3xl">
                {client.name}
              </h1>
              {client.household_name ? (
                <p className="mt-1 text-sm text-slate-400">
                  {client.household_name}
                </p>
              ) : null}
            </div>
            <Link to="/new" className="btn-primary shrink-0">
              New
            </Link>
          </header>

          {items.length === 0 ? (
            <EmptyState
              title="No instructions yet"
              hint="Add the first instruction for this client."
              actionTo="/new"
              actionLabel="New instruction"
            />
          ) : (
            <div className="space-y-3">
              {GROUPS.map((g) => {
                const groupItems = items.filter((i) => i.status === g.status)
                if (groupItems.length === 0) return null
                return (
                  <Section
                    key={g.status}
                    label={g.label}
                    count={groupItems.length}
                    defaultOpen={g.defaultOpen}
                    items={groupItems}
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({ label, count, defaultOpen, items }) {
  return (
    <details open={defaultOpen} className="card group overflow-hidden">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 py-3">
        <span className="font-display text-lg text-slate-100">
          {label}
          <span className="ml-2 font-sans text-sm text-slate-500">{count}</span>
        </span>
        <ChevronDown
          width={18}
          height={18}
          className="text-slate-500 transition group-open:rotate-180"
        />
      </summary>
      <div className="divide-y divide-white/5 border-t border-white/5">
        {items.map((i) => (
          <Link
            key={i.id}
            to={`/instruction/${i.id}`}
            className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.04]"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-100">
                {i.title}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {i.owner ?? 'Unassigned'} · {relativeTime(i.updated_at)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StaleBadge createdAt={i.created_at} />
              <StatusBadge status={i.status} />
            </div>
          </Link>
        ))}
      </div>
    </details>
  )
}
