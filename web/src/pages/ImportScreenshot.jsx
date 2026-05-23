import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ClientAutocomplete from '../components/ClientAutocomplete'
import OwnerSelect from '../components/OwnerSelect'
import { ErrorBox } from '../components/States'
import Spinner from '../components/Spinner'
import { BackIcon } from '../components/Icons'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const result = r.result || ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// Downscale + JPEG-encode an image so the request body stays under the
// Supabase Edge Function payload cap (~6 MB) while keeping text readable
// for Gemini's OCR.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

async function compressImage(file, maxDim = 1280, quality = 0.8) {
  const img = await loadImage(file)
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  return blob
}

function buildTitle(item) {
  const amt = item.amount
    ? `$${Number(item.amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : ''
  const acct = item.account_last4 ? `xxxx-${item.account_last4}` : ''
  const who = item.client_name || acct || 'Unknown'
  const parts = [item.action || 'Trade instruction', amt, '—', who]
    .filter(Boolean)
    .join(' ')
  return parts.trim().slice(0, 200)
}

export default function ImportScreenshot() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [clients, setClients] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [status, setStatus] = useState(null)
  const [items, setItems] = useState([]) // editable extracted rows
  const [compressedBlob, setCompressedBlob] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id,name,household_name')
      .order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setItems([])
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setExtracting(true)
    setStatus('Loading…')
    try {
      const compressed = await compressImage(file)
      setCompressedBlob(compressed)
      const base64 = await fileToBase64(compressed)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in.')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const resp = await fetch(
        `${supabaseUrl}/functions/v1/extract-instructions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
        },
      )
      const text = await resp.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Non-JSON ${resp.status}: ${text.slice(0, 200)}`)
      }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${data?.error || text.slice(0, 200)}`)
      }
      if (data?.error) throw new Error(data.error)
      const rows = Array.isArray(data?.instructions) ? data.instructions : []
      if (rows.length === 0) {
        setError(
          'No instructions could be extracted. Try a clearer screenshot or enter the instruction manually.',
        )
      }
      setItems(
        rows.map((r) => ({
          ...r,
          title: buildTitle(r),
          owner: null,
          clientChoice: prefillClient(clients, r.client_name),
          include: true,
        })),
      )
    } catch (err) {
      setError(err.message ?? 'Could not extract instructions.')
    } finally {
      setExtracting(false)
      setStatus(null)
    }
  }

  const updateItem = (idx, patch) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const submitAll = async () => {
    setError(null)
    const toCreate = items.filter((it) => it.include)
    if (toCreate.length === 0) {
      setError('Select at least one instruction to create.')
      return
    }
    for (const it of toCreate) {
      if (!it.clientChoice) {
        setError('Each selected row needs a client. Pick one or create new.')
        return
      }
      if (!it.title.trim()) {
        setError('Each selected row needs a title.')
        return
      }
    }
    setSaving(true)
    try {
      // Upload the screenshot once, then attach the same path to every
      // instruction created from it.
      let screenshotPath = null
      if (compressedBlob) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const userId = user?.id ?? 'anon'
        screenshotPath = `${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`
        const { error: upErr } = await supabase.storage
          .from('screenshots')
          .upload(screenshotPath, compressedBlob, {
            contentType: 'image/jpeg',
            upsert: false,
          })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
      }

      let createdId = null
      for (const it of toCreate) {
        let clientId = it.clientChoice.id
        if (!clientId) {
          const { data, error } = await supabase
            .from('clients')
            .insert({ name: it.clientChoice.name })
            .select('id')
            .single()
          if (error) throw error
          clientId = data.id
        }
        const description = [
          it.account_last4 ? `Account: xxxx-${it.account_last4}` : '',
          it.amount ? `Amount: $${it.amount}` : '',
          it.deadline ? `Deadline: ${it.deadline}` : '',
          it.notes || '',
        ]
          .filter(Boolean)
          .join('\n')

        const { data: created, error: insErr } = await supabase
          .from('instructions')
          .insert({
            client_id: clientId,
            title: it.title.trim(),
            description: description || null,
            owner: it.owner || null,
            source: 'screenshot',
            raw_text: it.raw_text || null,
            screenshot_path: screenshotPath,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        createdId = created.id
      }
      if (toCreate.length === 1 && createdId) {
        navigate(`/instruction/${createdId}`)
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message ?? 'Could not save instructions.')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-7">
      <Link
        to="/new"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100"
      >
        <BackIcon width={16} height={16} /> Back
      </Link>
      <h1 className="mb-2 font-display text-2xl text-slate-100 md:text-3xl">
        Import from screenshot
      </h1>
      <p className="mb-5 text-sm text-slate-400">
        Upload a screenshot of a Teams message. We&rsquo;ll extract each
        instruction so you can review and confirm before creating them.
      </p>

      <div className="card mb-5 flex flex-col gap-3 p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-primary"
          disabled={extracting || saving}
        >
          {previewUrl ? 'Choose a different screenshot' : 'Upload screenshot'}
        </button>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Screenshot preview"
            className="max-h-72 w-full rounded-md object-contain"
          />
        ) : null}
      </div>

      {extracting ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <Spinner label={status || 'Reading screenshot…'} />
        </div>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}

      {items.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-slate-400">
            {items.length} instruction{items.length === 1 ? '' : 's'} found —
            review, edit, then create.
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="card space-y-3 p-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={it.include}
                  onChange={(e) => updateItem(idx, { include: e.target.checked })}
                />
                Include this instruction
              </label>
              <div>
                <label className="label">Client</label>
                <ClientAutocomplete
                  clients={clients}
                  value={it.clientChoice}
                  onChange={(v) => updateItem(idx, { clientChoice: v })}
                />
                {it.client_name && !it.clientChoice ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(idx, {
                        clientChoice: { id: null, name: it.client_name },
                      })
                    }
                    className="mt-1 text-xs text-gold hover:underline"
                  >
                    Use &ldquo;{it.client_name}&rdquo; as a new client
                  </button>
                ) : null}
              </div>
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  value={it.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Account (last 4)</label>
                  <input
                    className="input"
                    value={it.account_last4}
                    onChange={(e) =>
                      updateItem(idx, { account_last4: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Amount ($)</label>
                  <input
                    className="input"
                    value={it.amount}
                    onChange={(e) => updateItem(idx, { amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Deadline</label>
                  <input
                    className="input"
                    value={it.deadline}
                    onChange={(e) =>
                      updateItem(idx, { deadline: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label">Owner</label>
                <OwnerSelect
                  value={it.owner}
                  onChange={(v) => updateItem(idx, { owner: v })}
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  rows={2}
                  className="input"
                  value={it.notes}
                  onChange={(e) => updateItem(idx, { notes: e.target.value })}
                />
              </div>
              {it.raw_text ? (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer">Original text</summary>
                  <p className="mt-1 whitespace-pre-wrap">{it.raw_text}</p>
                </details>
              ) : null}
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={submitAll}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving
                ? 'Saving…'
                : `Create ${items.filter((i) => i.include).length} instruction${
                    items.filter((i) => i.include).length === 1 ? '' : 's'
                  }`}
            </button>
            <Link to="/" className="btn-ghost">
              Cancel
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function prefillClient(clients, name) {
  if (!name) return null
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  const match = clients.find((c) => c.name.toLowerCase() === lower)
  if (match) return { id: match.id, name: match.name }
  // No existing client matches — pre-select "create new client with this name"
  // so the operator doesn't have to pick anything.
  return { id: null, name: trimmed }
}
