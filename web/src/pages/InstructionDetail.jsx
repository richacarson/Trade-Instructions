import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { STATUSES } from '../lib/constants'
import { formatDate, formatDateTime, relativeTime } from '../lib/format'
import Spinner from '../components/Spinner'
import StaleBadge from '../components/StaleBadge'
import OwnerSelect from '../components/OwnerSelect'
import { BackIcon } from '../components/Icons'
import { ErrorBox, EmptyState } from '../components/States'

const ACTION_TEXT = {
  created: 'created this instruction',
  status_change: 'changed status',
  owner_change: 'reassigned owner',
  step_done: 'completed a step',
  step_reopened: 'reopened a step',
}

export default function InstructionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { email } = useAuth()
  const [data, setData] = useState(null)
  const [steps, setSteps] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState(null)

  const load = useCallback(async () => {
    const [insRes, stepRes, actRes] = await Promise.all([
      supabase
        .from('instructions')
        .select('*, clients(id,name,household_name)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('instruction_steps')
        .select('*')
        .eq('instruction_id', id)
        .order('step_order'),
      supabase
        .from('activity_log')
        .select('*')
        .eq('instruction_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (insRes.error) {
      setError(insRes.error.message)
      setLoading(false)
      return
    }
    if (!insRes.data) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setData(insRes.data)
    setSteps(stepRes.data ?? [])
    setActivity(actRes.data ?? [])
    setError(null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (!data?.screenshot_path) {
      setScreenshotUrl(null)
      return
    }
    let cancelled = false
    supabase.storage
      .from('screenshots')
      .createSignedUrl(data.screenshot_path, 60 * 60)
      .then(({ data: signed }) => {
        if (!cancelled) setScreenshotUrl(signed?.signedUrl ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [data?.screenshot_path])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`instruction-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instructions',
          filter: `id=eq.${id}`,
        },
        load,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instruction_steps',
          filter: `instruction_id=eq.${id}`,
        },
        load,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_log',
          filter: `instruction_id=eq.${id}`,
        },
        load,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, id])

  const patchInstruction = async (patch) => {
    setData((d) => ({ ...d, ...patch }))
    const { error } = await supabase
      .from('instructions')
      .update(patch)
      .eq('id', id)
    if (error) {
      setError(error.message)
      load()
    }
  }

  const toggleStep = async (step) => {
    const next = step.status === 'done' ? 'open' : 'done'
    setSteps((list) =>
      list.map((s) => (s.id === step.id ? { ...s, status: next } : s)),
    )
    const { error } = await supabase
      .from('instruction_steps')
      .update({ status: next })
      .eq('id', step.id)
    if (error) {
      setError(error.message)
      load()
    }
  }

  const deleteInstruction = async () => {
    if (!window.confirm('Delete this instruction permanently? This cannot be undone.')) {
      return
    }
    if (data?.screenshot_path) {
      await supabase.storage.from('screenshots').remove([data.screenshot_path])
    }
    const { error } = await supabase.from('instructions').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  const submitNote = async (e) => {
    e.preventDefault()
    const text = note.trim()
    if (!text) return
    setSavingNote(true)
    const { error } = await supabase.from('activity_log').insert({
      instruction_id: id,
      user_email: email,
      action: 'note',
      note: text,
    })
    if (error) setError(error.message)
    else setNote('')
    setSavingNote(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }
  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <EmptyState
          title="Instruction not found"
          actionTo="/"
          actionLabel="Back to all open"
        />
      </div>
    )
  }

  const doneCount = steps.filter((s) => s.status === 'done').length

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-7">
      <Link
        to={data.clients ? `/client/${data.clients.id}` : '/'}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100"
      >
        <BackIcon width={16} height={16} /> {data.clients?.name ?? 'Back'}
      </Link>

      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100 md:text-3xl">
            {data.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {data.status !== 'done' ? <StaleBadge createdAt={data.created_at} /> : null}
            {data.meeting_date ? (
              <span>· Meeting {formatDate(data.meeting_date)}</span>
            ) : null}
            <span>· Source: {data.source}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={deleteInstruction}
          className="shrink-0 rounded-md border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/10"
        >
          Delete
        </button>
      </header>

      {(data.amount != null || data.account_last4 || data.deadline_text) ? (
        <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          {data.amount != null ? (
            <div>
              <div className="label">Amount</div>
              <div className="mt-0.5 font-mono text-lg text-gold">
                ${Number(data.amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          ) : null}
          {data.account_last4 ? (
            <div>
              <div className="label">Account</div>
              <div className="mt-0.5 font-mono text-lg text-slate-100">
                xxxx-{data.account_last4}
              </div>
            </div>
          ) : null}
          {data.deadline_text ? (
            <div>
              <div className="label">Deadline</div>
              <div className="mt-0.5 text-base text-red-200">
                {data.deadline_text}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="input"
            value={data.status}
            onChange={(e) => patchInstruction({ status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="owner">
            Owner
          </label>
          <OwnerSelect
            value={data.owner}
            onChange={(v) => patchInstruction({ owner: v })}
          />
        </div>
      </div>

      {data.description ? (
        <div className="card mb-4 p-4">
          <h2 className="label">Details</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-200">
            {data.description}
          </p>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <div className="card mb-4 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg text-slate-100">Steps</h2>
            <span className="font-mono text-xs text-slate-400">
              {doneCount}/{steps.length} done
            </span>
          </div>
          <ul className="space-y-1">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                onToggle={() => toggleStep(step)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {data.raw_text ? (
        <details className="card mb-4 overflow-hidden">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center px-4 py-3 text-sm font-medium text-sage">
            Original message
          </summary>
          <p className="whitespace-pre-wrap border-t border-white/5 px-4 py-3 text-sm text-slate-400">
            {data.raw_text}
          </p>
        </details>
      ) : null}

      {screenshotUrl ? (
        <div className="card mb-4 p-4">
          <h2 className="label mb-2">Screenshot</h2>
          <a href={screenshotUrl} target="_blank" rel="noreferrer">
            <img
              src={screenshotUrl}
              alt="Source screenshot"
              className="max-h-[480px] w-full rounded-md object-contain"
            />
          </a>
        </div>
      ) : null}

      <div className="card p-4">
        <h2 className="mb-3 font-display text-lg text-slate-100">Activity</h2>
        <form onSubmit={submitNote} className="mb-4 flex gap-2">
          <input
            className="input"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="submit"
            disabled={savingNote || !note.trim()}
            className="btn-primary shrink-0"
          >
            Post
          </button>
        </form>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StepRow({ step, onToggle }) {
  const done = step.status === 'done'
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]"
      >
        <span
          className={[
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border',
            done ? 'border-sage bg-sage text-navy' : 'border-white/25',
          ].join(' ')}
        >
          {done ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          ) : null}
        </span>
        <span className="min-w-0">
          <span
            className={
              done
                ? 'text-sm text-slate-500 line-through'
                : 'text-sm text-slate-100'
            }
          >
            {step.description}
          </span>
          {done && step.completed_by ? (
            <span className="mt-0.5 block text-xs text-slate-500">
              {step.completed_by} · {relativeTime(step.completed_at)}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

function ActivityRow({ entry }) {
  const isNote = entry.action === 'note'
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sage/60" />
      <div className="min-w-0">
        {isNote ? (
          <p className="whitespace-pre-wrap text-sm text-slate-200">
            {entry.note}
          </p>
        ) : (
          <p className="text-sm text-slate-300">
            {ACTION_TEXT[entry.action] ?? entry.action}
            {entry.note ? (
              <span className="text-slate-500"> — {entry.note}</span>
            ) : null}
          </p>
        )}
        <p className="mt-0.5 text-xs text-slate-500">
          {entry.user_email} · {formatDateTime(entry.created_at)}
        </p>
      </div>
    </li>
  )
}
