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
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)

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

  const addClient = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('clients').insert({ name })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewName('')
    setAdding(false)
  }

  const startEdit = (c) => {
    setEditingId(c.id)
    setEditName(c.name)
  }

  const saveEdit = async () => {
    const name = editName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('clients')
      .update({ name })
      .eq('id', editingId)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setEditingId(null)
    setEditName('')
  }

  const deleteClient = async (c) => {
    const openCount = counts[c.id] ?? 0
    const msg =
      openCount > 0
        ? `${c.name} has ${openCount} open instruction${
            openCount === 1 ? '' : 's'
          }. Deleting the client removes all of their instructions and history. Continue?`
        : `Delete "${c.name}"? This also removes all of their instructions and history.`
    if (!window.confirm(msg)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('clients').delete().eq('id', c.id)
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-7">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-slate-100 md:text-3xl">
            Clients
          </h1>
          <p className="mt-1 text-sm text-slate-400">{clients.length} total</p>
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setNewName('')
            }}
            className="btn-primary"
          >
            Add client
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      ) : null}

      {adding ? (
        <div className="card mb-4 flex items-center gap-2 p-3">
          <input
            autoFocus
            className="input flex-1"
            placeholder="Client name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addClient()
              if (e.key === 'Escape') {
                setAdding(false)
                setNewName('')
              }
            }}
          />
          <button
            type="button"
            onClick={addClient}
            disabled={busy || !newName.trim()}
            className="btn-primary shrink-0"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setNewName('')
            }}
            className="btn-ghost shrink-0"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          hint="Add your first client to get started."
        />
      ) : (
        <div className="card divide-y divide-white/5">
          {clients.map((c) => {
            const open = counts[c.id] ?? 0
            const isEditing = editingId === c.id
            return (
              <div
                key={c.id}
                className="flex min-h-[56px] items-center gap-2 px-4 py-3"
              >
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      className="input flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') {
                          setEditingId(null)
                          setEditName('')
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={busy || !editName.trim()}
                      className="btn-primary shrink-0"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        setEditName('')
                      }}
                      className="btn-ghost shrink-0"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to={`/client/${c.id}`}
                      className="min-w-0 flex-1 hover:text-gold"
                    >
                      <div className="truncate font-medium text-slate-100">
                        {c.name}
                      </div>
                      {c.household_name ? (
                        <div className="truncate text-xs text-slate-500">
                          {c.household_name}
                        </div>
                      ) : null}
                    </Link>
                    <span
                      className={[
                        'shrink-0 rounded-full px-2.5 py-0.5 font-mono text-xs',
                        open > 0
                          ? 'bg-sage/15 text-sage'
                          : 'bg-white/5 text-slate-500',
                      ].join(' ')}
                    >
                      {open} open
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteClient(c)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-400/10"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
