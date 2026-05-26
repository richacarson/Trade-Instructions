import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { compressImage } from '../lib/images'
import OwnerSelect from '../components/OwnerSelect'
import ClientAutocomplete from '../components/ClientAutocomplete'
import { ErrorBox } from '../components/States'
import { BackIcon } from '../components/Icons'

export default function NewInstruction() {
  const navigate = useNavigate()
  const { email } = useAuth()
  const [clients, setClients] = useState([])
  const [clientChoice, setClientChoice] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('Carson')
  const [meetingDate, setMeetingDate] = useState('')
  const [steps, setSteps] = useState([''])
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id,name,household_name')
      .order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  const setStep = (idx, value) =>
    setSteps((s) => s.map((v, i) => (i === idx ? value : v)))
  const addStep = () => setSteps((s) => [...s, ''])
  const removeStep = (idx) =>
    setSteps((s) => (s.length === 1 ? [''] : s.filter((_, i) => i !== idx)))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!clientChoice) {
      setError('Choose or create a client.')
      return
    }
    if (!title.trim()) {
      setError('A title is required.')
      return
    }
    setSaving(true)
    try {
      let clientId = clientChoice.id
      if (!clientId) {
        const { data, error } = await supabase
          .from('clients')
          .insert({ name: clientChoice.name })
          .select('id')
          .single()
        if (error) throw error
        clientId = data.id
      }

      const { data: created, error: insErr } = await supabase
        .from('instructions')
        .insert({
          client_id: clientId,
          title: title.trim(),
          description: description.trim() || null,
          owner: owner || null,
          meeting_date: meetingDate || null,
          source: 'manual',
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      const cleaned = steps.map((s) => s.trim()).filter(Boolean)
      if (cleaned.length > 0) {
        const { error: stepErr } = await supabase
          .from('instruction_steps')
          .insert(
            cleaned.map((d, i) => ({
              instruction_id: created.id,
              step_order: i + 1,
              description: d,
            })),
          )
        if (stepErr) throw stepErr
      }

      // Upload any attached reference screenshots, link them to the new instruction.
      if (pendingFiles.length > 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const userId = user?.id ?? 'anon'
        for (const file of pendingFiles) {
          if (!file.type.startsWith('image/')) continue
          const blob = await compressImage(file)
          const path = `${userId}/attachments/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.jpg`
          const { error: upErr } = await supabase.storage
            .from('screenshots')
            .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
          if (upErr) throw new Error(`Attachment upload failed: ${upErr.message}`)
          await supabase
            .from('instruction_attachments')
            .insert({
              instruction_id: created.id,
              storage_path: path,
              uploaded_by: email,
            })
        }
      }

      navigate(`/instruction/${created.id}`)
    } catch (err) {
      setError(err.message ?? 'Could not save the instruction.')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-7">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100"
      >
        <BackIcon width={16} height={16} /> All open
      </Link>
      <h1 className="mb-3 font-display text-2xl text-slate-100 md:text-3xl">
        New Instruction
      </h1>

      <Link
        to="/new/screenshot"
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold hover:bg-gold/20"
      >
        Import from screenshot
      </Link>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Client</label>
          <ClientAutocomplete
            clients={clients}
            value={clientChoice}
            onChange={setClientChoice}
          />
        </div>

        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className="input"
            placeholder="e.g. Liquidate $40k from Simpson 5487"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="desc">
            Description
          </label>
          <textarea
            id="desc"
            rows={3}
            className="input"
            placeholder="Context, special notes…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Owner</label>
            <OwnerSelect value={owner} onChange={setOwner} />
          </div>
          <div>
            <label className="label" htmlFor="mdate">
              Meeting date
            </label>
            <input
              id="mdate"
              type="date"
              className="input"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Steps</label>
          <div className="space-y-2">
            {steps.map((value, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right font-mono text-xs text-slate-500">
                  {idx + 1}
                </span>
                <input
                  className="input"
                  placeholder={`Step ${idx + 1}`}
                  value={value}
                  onChange={(e) => setStep(idx, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  className="min-h-[44px] px-2 text-slate-500 hover:text-red-300"
                  aria-label={`Remove step ${idx + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="btn-ghost mt-2">
            + Add step
          </button>
        </div>

        <div>
          <label className="label">Reference screenshots</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              setPendingFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost"
          >
            + Attach screenshot
          </button>
          {pendingFiles.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {pendingFiles.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="ml-2 shrink-0 text-slate-500 hover:text-red-300"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? <ErrorBox message={error} /> : null}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Create instruction'}
          </button>
          <Link to="/" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
