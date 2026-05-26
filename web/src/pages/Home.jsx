import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { OPEN_STATUSES } from '../lib/constants'
import { relativeTime } from '../lib/format'
import Spinner from '../components/Spinner'
import StaleBadge from '../components/StaleBadge'
import StatusBadge from '../components/StatusBadge'
import { ErrorBox, EmptyState } from '../components/States'

const GRID = 'md:grid md:grid-cols-[1.3fr_2.2fr_0.9fr_0.9fr_0.9fr] md:gap-3'

export default function Home() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState(null)
  const [clientFilter, setClientFilter] = useState(null)
  const [tab, setTab] = useState('open') // 'open' | 'completed'

  const load = useCallback(async () => {
    const statuses = tab === 'open' ? OPEN_STATUSES : ['done']
    const order = tab === 'open'
      ? { col: 'updated_at', asc: true } // stalest first
      : { col: 'completed_at', asc: false } // most recent first
    const { data, error } = await supabase
      .from('instructions')
      .select(
        'id,title,owner,status,created_at,updated_at,completed_at,amount,account_last4,deadline_text,client_id,clients(name,household_name)',
      )
      .in('status', statuses)
      .order(order.col, { ascending: order.asc })
    if (error) setError(error.message)
    else {
      setItems(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [tab])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('home-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instructions' },
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
  }, [load])

  const owners = useMemo(
    () => [...new Set(items.map((i) => i.owner).filter(Boolean))].sort(),
    [items],
  )
  const clientOptions = useMemo(() => {
    const map = new Map()
    items.forEach((i) => {
      if (i.client_id) map.set(i.client_id, i.clients?.name ?? 'Unknown')
    })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])

  const filtered = items.filter(
    (i) =>
      (!ownerFilter || i.owner === ownerFilter) &&
      (!clientFilter || i.client_id === clientFilter),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-7">
      <header className="mb-4">
        <h1 className="font-display text-2xl text-slate-100 md:text-3xl">
          Instructions
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {filtered.length} {tab === 'open' ? 'open · stalest first' : 'completed · most recent first'}
        </p>
      </header>

      <div className="mb-4 inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab('open')}
          className={`min-h-[36px] rounded-md px-3 text-sm font-medium transition ${
            tab === 'open' ? 'bg-gold text-navy' : 'text-slate-300 hover:text-slate-100'
          }`}
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`min-h-[36px] rounded-md px-3 text-sm font-medium transition ${
            tab === 'completed' ? 'bg-gold text-navy' : 'text-slate-300 hover:text-slate-100'
          }`}
        >
          Completed
        </button>
      </div>

      {owners.length > 0 || clientOptions.length > 1 ? (
        <div className="mb-4 space-y-2">
          {owners.length > 0 ? (
            <ChipRow
              label="Owner"
              options={owners.map((o) => ({ value: o, label: o }))}
              active={ownerFilter}
              onChange={setOwnerFilter}
            />
          ) : null}
          {clientOptions.length > 1 ? (
            <ChipRow
              label="Client"
              options={clientOptions.map(([id, name]) => ({
                value: id,
                label: name,
              }))}
              active={clientFilter}
              onChange={setClientFilter}
            />
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading instructions…" />
        </div>
      ) : error ? (
        <ErrorBox message={error} />
      ) : filtered.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            title={tab === 'open' ? 'No open instructions' : 'No completed instructions'}
            hint={tab === 'open' ? 'The team is all caught up.' : 'Completed instructions will show up here.'}
          />
        ) : (
          <EmptyState
            title="No matches"
            hint="No open instructions match the selected filters."
          />
        )
      ) : (
        <div className="card divide-y divide-white/5">
          <div
            className={`hidden px-4 py-2 text-xs uppercase tracking-wide text-slate-500 ${GRID}`}
          >
            <span>Client</span>
            <span>Title</span>
            <span>Owner</span>
            <span>Status</span>
            <span>Days / Activity</span>
          </div>
          {filtered.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ item }) {
  const done = item.status === 'done'
  const amountFmt =
    item.amount != null
      ? `$${Number(item.amount).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : null
  const meta = [
    amountFmt,
    item.account_last4 ? `xxxx-${item.account_last4}` : null,
    item.deadline_text,
  ].filter(Boolean)
  return (
    <Link
      to={`/instruction/${item.id}`}
      className={`block px-4 py-3 transition hover:bg-white/[0.04] md:items-start ${GRID}`}
    >
      <div className="text-sm text-sage md:truncate">
        {item.clients?.name ?? 'Unknown client'}
      </div>
      <div className="mt-0.5 md:mt-0">
        <div className="font-medium leading-snug text-slate-100">
          {item.title}
        </div>
        {meta.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {amountFmt ? (
              <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-xs text-gold">
                {amountFmt}
              </span>
            ) : null}
            {item.account_last4 ? (
              <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                xxxx-{item.account_last4}
              </span>
            ) : null}
            {item.deadline_text ? (
              <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-xs text-red-200">
                {item.deadline_text}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-1 text-sm text-slate-400 md:mt-0">
        {item.owner ?? 'Unassigned'}
      </div>
      <div className="mt-2 md:mt-0">
        <StatusBadge status={item.status} />
      </div>
      <div className="mt-2 flex items-center gap-2 md:mt-0 md:flex-col md:items-start md:gap-0.5">
        {done ? (
          <span className="rounded-full bg-sage/15 px-2 py-0.5 font-mono text-xs text-sage">
            Done
          </span>
        ) : (
          <StaleBadge createdAt={item.created_at} />
        )}
        <span className="text-xs text-slate-500">
          {done && item.completed_at
            ? `done ${relativeTime(item.completed_at)}`
            : relativeTime(item.updated_at)}
        </span>
      </div>
    </Link>
  )
}

function ChipRow({ label, options, active, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <Chip selected={!active} onClick={() => onChange(null)}>
        All
      </Chip>
      {options.map((o) => (
        <Chip
          key={o.value}
          selected={active === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  )
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1 text-xs font-medium transition',
        selected
          ? 'bg-gold text-navy'
          : 'bg-white/5 text-slate-300 hover:bg-white/10',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
