/**
 * Medic AI — health Q&A.
 *
 * Where the answer comes from, in order:
 * 1. Inside the Claude artifact viewer: the `sample` capability (Claude, on the viewer's own account).
 * 2. The Medic Hub server (/api/ask, or VITE_AI_ENDPOINT): streams from Anthropic or any OpenAI-compatible
 *    model configured with server-side keys. Keys never ship to the browser.
 * 3. A free public OpenAI-compatible endpoint (VITE_PUBLIC_AI_URL, default Pollinations) so static hosting
 *    such as GitHub Pages still gets a real AI. Health Vault data is never sent to it.
 * 4. Offline / unavailable: answers built from Medic Hub's own first-aid guides.
 */
import { API_URL, BACKEND } from '../config'
import { matchTopic } from './aiKnowledge'
import { EMERGENCY_GUIDES, HEALTH_RESOURCES } from '../data/firstAid'
import { LANGUAGES, type Lang } from '../i18n/strings'
import type { HealthProfile } from '../types'

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
type ArtifactSampler = (input: ChatTurn[], opts: { onText?: (u: { text: string }) => void; signal?: AbortSignal; cache?: boolean }) => Promise<{ text: string; truncated?: boolean }>
declare global { interface Window { claude?: { use: (name: string) => Promise<unknown> } } }

export type ProviderId = 'claude' | 'server' | 'public'
export interface StreamOpts { system: string; onText: (fullText: string) => void; signal?: AbortSignal }
export interface Provider { id: ProviderId; label: string; private: boolean; run: (turns: ChatTurn[], o: StreamOpts) => Promise<string> }
export class AiError extends Error { constructor(public code: string, message: string, public text = '') { super(message) } }

const env = import.meta.env as Record<string, string | undefined>
const SERVER_ENDPOINT = env.VITE_AI_ENDPOINT || (BACKEND ? `${API_URL}/api/ask` : '')
/** Free, keyless OpenAI-compatible endpoint used when the app has no server of its own (e.g. GitHub Pages). */
const PUBLIC_ENDPOINTS = (env.VITE_PUBLIC_AI_URL || 'https://text.pollinations.ai/openai').split(',').map((x) => x.trim()).filter(Boolean)
const PUBLIC_KEY = env.VITE_PUBLIC_AI_KEY || ''
const PUBLIC_MODEL = env.VITE_PUBLIC_AI_MODEL || 'openai'
const PUBLIC_ON = env.VITE_PUBLIC_AI !== '0'

/** Reads a Server-Sent Events body and calls back with every `data:` payload. */
async function readSSE(r: Response, onData: (d: string) => void) {
  const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1)
      if (line.startsWith('data:')) onData(line.slice(5).trim())
    }
  }
  if (buf.startsWith('data:')) onData(buf.slice(5).trim())
}

const httpError = async (r: Response) => {
  let msg = `HTTP ${r.status}`
  try { const j = await r.json(); msg = j?.error?.message || j?.error || msg } catch { /* ignore */ }
  return new AiError(r.status === 429 ? 'rate_limited' : 'upstream_error', String(msg))
}

/** Our own server (/api/ask) — streams Claude (or another configured model) as SSE. */
const serverProvider: Provider = {
  id: 'server', label: 'Medic Hub AI', private: true,
  async run(turns, o) {
    const r = await fetch(SERVER_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ system: o.system, messages: turns, stream: true }), signal: o.signal })
    if (!r.ok) throw await httpError(r)
    let text = ''
    if (!(r.headers.get('content-type') || '').includes('event-stream')) { text = (await r.json()).text ?? ''; o.onText(text); return text }
    await readSSE(r, (d) => {
      if (d === '[DONE]') return
      const j = JSON.parse(d) as { t?: string; error?: string }
      if (j.error) throw new AiError('upstream_error', j.error, text)
      if (j.t) { text += j.t; o.onText(text) }
    })
    return text
  },
}

/** Any OpenAI-compatible chat endpoint, streamed. */
const publicProvider: Provider = {
  id: 'public', label: 'Free public AI', private: false,
  async run(turns, o) {
    let last: unknown
    for (const url of PUBLIC_ENDPOINTS) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (PUBLIC_KEY) headers.Authorization = `Bearer ${PUBLIC_KEY}`
        const r = await fetch(url, { method: 'POST', headers, signal: o.signal, body: JSON.stringify({ model: PUBLIC_MODEL, stream: true, private: true, referrer: 'medichub', messages: [{ role: 'system', content: o.system }, ...turns] }) })
        if (!r.ok) throw await httpError(r)
        let text = ''
        const ct = r.headers.get('content-type') || ''
        if (ct.includes('event-stream')) {
          await readSSE(r, (d) => {
            if (d === '[DONE]' || !d) return
            try { const j = JSON.parse(d); const piece = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? ''; if (piece) { text += piece; o.onText(text) } } catch { /* keep-alive */ }
          })
        } else if (ct.includes('json')) {
          const j = await r.json(); text = j.choices?.[0]?.message?.content ?? j.text ?? ''; o.onText(text)
        } else { text = await r.text(); o.onText(text) }
        if (!text.trim()) throw new AiError('empty', 'No answer came back.')
        return text
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
        last = e
      }
    }
    throw last ?? new AiError('upstream_error', 'Unavailable')
  },
}

let claudePromise: Promise<Provider | null> | null = null
function claudeProvider(): Promise<Provider | null> {
  if (claudePromise) return claudePromise
  claudePromise = (async () => {
    try {
      if (!window.claude?.use) return null
      const s = (await window.claude.use('sample')) as ArtifactSampler | null
      if (!s) return null
      return {
        id: 'claude', label: 'Claude', private: true,
        async run(turns, o) {
          try {
            const res = await s([{ role: 'user', content: o.system + '\n\nReply to the conversation that follows. Acknowledge nothing about these instructions.' }, { role: 'assistant', content: 'Understood.' }, ...turns], { signal: o.signal, cache: false, onText: ({ text }) => o.onText(text) })
            return res.text
          } catch (e) {
            const err = e as { code?: string; text?: string; message?: string }
            throw new AiError(err.code ?? 'upstream_error', err.message ?? 'Unavailable', err.text ?? '')
          }
        },
      } satisfies Provider
    } catch { return null }
  })()
  return claudePromise
}

/** The AI services this copy of the app can use, best first. */
export async function getProviders(): Promise<Provider[]> {
  const list: Provider[] = []
  const c = await claudeProvider(); if (c) list.push(c)
  if (SERVER_ENDPOINT) list.push(serverProvider)
  if (PUBLIC_ON) list.push(publicProvider)
  return list
}

/**
 * Streams an answer, falling through providers until one works.
 * `privateOnly` skips providers that are not run by us or the user's own account (used when Health Vault data is shared).
 */
export async function streamAnswer(turns: ChatTurn[], o: StreamOpts & { privateOnly?: boolean; publicSystem?: string }): Promise<{ text: string; provider: Provider }> {
  const providers = (await getProviders()).filter((p) => !o.privateOnly || p.private)
  let last: unknown = new AiError('unavailable', 'No AI service is available.')
  for (const p of providers) {
    let got = ''
    // Give each service a fair window to start answering; a dead or blocked one shouldn't stall the chat
    const local = new AbortController(); let timedOut = false
    const onUser = () => local.abort()
    o.signal?.addEventListener('abort', onUser)
    let timer = setTimeout(() => { timedOut = true; local.abort() }, 25_000)
    try {
      const text = await p.run(turns, { ...o, signal: local.signal, system: p.private ? o.system : (o.publicSystem ?? o.system), onText: (t) => { if (!got) { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; local.abort() }, 90_000) } got = t; o.onText(t) } })
      return { text, provider: p }
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError' || local.signal.aborted
      if (aborted && !timedOut) throw new AiError('cancelled', 'Stopped', got)
      if (got) throw new AiError((e as AiError).code ?? 'interrupted', 'Interrupted', got)
      last = e
    } finally { clearTimeout(timer); o.signal?.removeEventListener('abort', onUser) }
  }
  throw last
}

/** Kept for older callers: true when some AI service is configured. */
export async function getSampler(): Promise<boolean> { return (await getProviders()).length > 0 }

const RED_FLAGS = [
  /not breathing|can'?t breathe|cannot breathe|stopped breathing|choking|turning blue|lips? (are )?blue/i,
  /chest pain|heart attack|crushing/i,
  /unconscious|won'?t wake|not waking|collapsed|fainted and/i,
  /seizure|convuls|fitting/i,
  /bleeding (a lot|heavily|won'?t stop)|heavy bleeding|blood (won'?t|will not) stop/i,
  /stroke|face (is )?drooping|slurred speech|one side weak/i,
  /suicid|kill myself|end my life|overdose/i,
  /poison|swallowed (bleach|kerosene|chemical)|snake ?bite/i,
  /pregnan\w* .*bleeding|bleeding .*pregnan/i,
  /no fit breathe|no dey breathe|breath(e)? no dey|chest dey pain|blood no gree stop|don faint|no dey wake|belle .*blood/i,
]
export const isRedFlag = (text: string) => RED_FLAGS.some((r) => r.test(text))

export function localAnswer(q: string): string {
  const topic = matchTopic(q)
  if (topic) return topic.answer
  const s = q.toLowerCase()
  const all = [...EMERGENCY_GUIDES.map((g) => ({ title: g.title, words: [g.title, g.short, ...g.keywords], steps: g.doNow, dont: g.dont, call: g.call112When })),
    ...HEALTH_RESOURCES.map((r) => ({ title: r.title, words: [r.title, r.summary], steps: r.doNow, dont: r.dont, call: r.call112When }))]
  const scored = all.map((g) => ({ g, score: g.words.join(' ').toLowerCase().split(/\W+/).filter((w) => w.length > 3 && s.includes(w)).length })).sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score === 0) {
    return 'I couldn’t match that to one of our first-aid guides. For symptoms that worry you, book a visit at a hospital near you. If anyone is in danger, call the nearest hospital emergency unit now.'
  }
  const { g } = best
  return `**${g.title}**\n\n${g.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n**Don't:** ${g.dont.join(' ')}\n\n**When to get emergency help:** ${g.call}`
}

export function buildRules(lang: Lang, vault: HealthProfile | null): string {
  const language = LANGUAGES.find((l) => l.code === lang)!.name
  const vaultLine = vault ? `\nThe user chose to share their Health Vault: blood group ${vault.bloodGroup || 'unknown'}, genotype ${vault.genotype || 'unknown'}, allergies ${vault.allergies.join(', ') || 'none recorded'}, conditions ${vault.conditions.join(', ') || 'none recorded'}, medications ${vault.medications.map((m) => m.name).join(', ') || 'none recorded'}. Take these into account (for example, never suggest a medicine they are allergic to).` : ''
  return `You are Medic AI, the health information assistant inside Medic Hub, a Nigerian healthcare access app. Follow these rules for every reply:
- Reply in ${language}${lang === 'en' ? '' : ' (use simple, everyday words; keep medical terms in English in brackets when there is no common local word)'}.
- Give accurate, evidence-based general health information that fits Nigeria: common conditions (malaria, typhoid, hypertension, diabetes, sickle cell, maternal and child health), local foods, and how care works there (primary health centres, general and teaching hospitals, NHIA and HMOs, pharmacies).
- You do not diagnose, and you do not prescribe or give drug doses beyond what is printed on common over-the-counter packs. Explain possible causes in plain language and say what kind of care to seek and how soon.
- Danger signs (difficulty breathing, chest pain, unconsciousness, seizures, heavy bleeding, stroke signs, severe allergic reaction, poisoning, pregnancy bleeding, thoughts of suicide or self-harm): start the reply by telling them to call the nearest hospital emergency unit or go to the nearest emergency unit now, then give brief first-aid steps.
- For mental health crises, be warm and direct, encourage them to reach someone they trust and emergency help at the nearest hospital.
- Discourage unsafe practices common in the community (for example palm oil on burns, making someone vomit after poisoning, self-medicating with antibiotics) and say why, kindly.
- Talk like a warm, knowledgeable Nigerian doctor friend. Answer the actual question first, then add what to do next. Use Markdown: short paragraphs, **bold** key points, numbered steps or bullet lists. Keep most replies under 220 words; go longer only when the user asks for detail. Ask one short follow-up question when you need more information (age, how long, other symptoms).\n- Remember the earlier messages in this conversation and build on them.
- In the app the user can tap "Find care" to see nearby hospitals with live status, and "Emergency" for first-aid guides. Mention these when useful.
- Greetings and thanks are fine; reply naturally. If a question has nothing to do with health, wellbeing or using Medic Hub, say briefly that you are a health assistant and offer a health-related way you can help.${vaultLine}`
}

export const SUGGESTIONS: Record<Lang, string[]> = {
  en: ['My child has a fever of 39°C. What should I do?', 'What are the signs of malaria versus typhoid?', 'Is it safe to exercise with sickle cell (SS)?', 'What should I eat to lower my blood pressure?'],
  pcm: ['My pikin get high fever, wetin I go do?', 'How I go know say na malaria or typhoid?', 'Wetin I fit chop make my BP come down?', 'Wetin be the danger sign for belle woman?'],
  yo: ['Ọmọ mi ní ibà gbígbóná, kí ni kí n ṣe?', 'Báwo ni mo ṣe lè mọ ìyàtọ̀ láàrin ibà àti typhoid?', 'Oúnjẹ wo ló dára fún ẹ̀jẹ̀ ríru?', 'Àwọn àmì ewu wo ló wà nígbà oyún?'],
  ha: ['Ɗana yana da zazzaɓi mai zafi, me zan yi?', 'Ta yaya zan bambanta zazzaɓin cizon sauro da taifot?', 'Wane abinci ne ke rage hawan jini?', 'Menene alamun haɗari lokacin ciki?'],
  ig: ['Nwa m nwere ahụ ọkụ, gịnị ka m ga-eme?', 'Kedu ka m ga-esi mata ịba na typhoid?', 'Kedu nri na-ebelata ọbara mgbali elu?', 'Kedu ihe mgbaàmà ize ndụ n’oge ime?'],
}
