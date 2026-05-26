// Supabase Edge Function: extract-instructions
// Receives an image (base64) and returns an array of structured trade
// instructions extracted by Google's Gemini API.
//
// Deploy:   supabase functions deploy extract-instructions
// Secret:   supabase secrets set GEMINI_API_KEY=...
//           (or add GEMINI_API_KEY in the Supabase dashboard:
//            Project Settings -> Edge Functions -> Secrets)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = `You are extracting trade / operational instructions from a screenshot of a Microsoft Teams chat message between members of a wealth-management firm.

A SINGLE screenshot can contain MULTIPLE separate instructions (one per client, account, or task). Return ONE entry per discrete actionable item.

For each instruction extract these fields (use an empty string when a field is absent):
- client_name: full client first + last name if present, e.g. "Garry Brown", "Linda Brown", "Jeanne Nicol". If only an account number is given, leave empty.
- account_last4: last 4 digits of the account number, e.g. "9961" from "xxxx-9961" or "...9961".
- amount: dollar amount as a plain decimal with no $ or commas, e.g. "3820.59".
- action: short description of what's being asked, under 80 chars, e.g. "Raise cash for RMD", "Liquidate for QCD", "Set up trade for cash availability".
- deadline: any time constraint mentioned verbatim, e.g. "Before market close today", "Before end of day today", "ASAP next week".
- notes: any extra context that doesn't fit the above (purpose, related paperwork, special instructions).
- raw_text: the relevant sentence(s) from the message that describe THIS specific instruction (so the operator can audit the extraction).

Return ONLY a JSON array. If the image contains no actionable instructions, return [].`

const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      client_name: { type: 'string' },
      account_last4: { type: 'string' },
      amount: { type: 'string' },
      action: { type: 'string' },
      deadline: { type: 'string' },
      notes: { type: 'string' },
      raw_text: { type: 'string' },
    },
    required: [
      'client_name',
      'account_last4',
      'amount',
      'action',
      'deadline',
      'notes',
      'raw_text',
    ],
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY is not configured' }, 500)
  }

  try {
    const body = await req.json()
    const image: string | undefined = body.image
    const mimeType: string = body.mimeType || 'image/png'
    if (!image) return json({ error: 'Missing image' }, 400)

    const r = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: image } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.1,
        },
      }),
    })

    if (!r.ok) {
      const errText = await r.text()
      return json({ error: `Gemini error: ${errText}` }, 502)
    }

    const result = await r.json()
    const text: string =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'

    let instructions: unknown
    try {
      instructions = JSON.parse(text)
    } catch {
      return json({ error: 'Gemini returned non-JSON', raw: text }, 502)
    }

    return json({ instructions })
  } catch (err) {
    return json({ error: (err as Error).message }, 400)
  }
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
