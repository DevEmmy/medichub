/**
 * Medic AI — health Q&A.
 *
 * Where the answer comes from, in order:
 * 1. Inside the Claude artifact viewer: the `sample` capability (Claude, on the viewer's own account).
 * 2. A deployed backend: set VITE_AI_ENDPOINT to a server route that forwards { messages } to your
 *    LLM provider and returns { text } (see server/ask.example.ts). API keys never ship to the browser.
 * 3. Offline / unavailable: answers built from Medic Hub's own first-aid guides.
 */
import { EMERGENCY_GUIDES, HEALTH_RESOURCES } from '../data/firstAid'
import { LANGUAGES, type Lang } from '../i18n/strings'
import type { HealthProfile } from '../types'

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
type Sampler = (input: ChatTurn[], opts: { onText?: (u: { text: string }) => void; signal?: AbortSignal; cache?: boolean }) => Promise<{ text: string; truncated?: boolean }>

declare global { interface Window { claude?: { use: (name: string) => Promise<unknown> } } }

let samplerPromise: Promise<Sampler | null> | null = null
export function getSampler(): Promise<Sampler | null> {
  if (samplerPromise) return samplerPromise
  samplerPromise = (async () => {
    try {
      if (window.claude?.use) {
        const s = (await window.claude.use('sample')) as Sampler | null
        if (s) return s
      }
    } catch { /* fall through */ }
    const endpoint = import.meta.env.VITE_AI_ENDPOINT as string | undefined
    if (endpoint) {
      const viaEndpoint: Sampler = async (input, opts) => {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: input }), signal: opts.signal })
        if (!r.ok) throw { code: 'upstream_error', message: `HTTP ${r.status}` }
        const j = await r.json()
        opts.onText?.({ text: j.text })
        return { text: j.text }
      }
      return viaEndpoint
    }
    return null
  })()
  return samplerPromise
}

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
  const s = q.toLowerCase()
  const all = [...EMERGENCY_GUIDES.map((g) => ({ title: g.title, words: [g.title, g.short, ...g.keywords], steps: g.doNow, dont: g.dont, call: g.call112When })),
    ...HEALTH_RESOURCES.map((r) => ({ title: r.title, words: [r.title, r.summary], steps: r.doNow, dont: r.dont, call: r.call112When }))]
  const scored = all.map((g) => ({ g, score: g.words.join(' ').toLowerCase().split(/\W+/).filter((w) => w.length > 3 && s.includes(w)).length })).sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score === 0) {
    return 'I couldn’t match that to one of our first-aid guides. For symptoms that worry you, book a visit at a hospital near you. If anyone is in danger, call 112 now.'
  }
  const { g } = best
  return `**${g.title}**\n\n${g.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n**Don't:** ${g.dont.join(' ')}\n\n**When to call 112:** ${g.call}`
}

export function buildRules(lang: Lang, vault: HealthProfile | null): string {
  const language = LANGUAGES.find((l) => l.code === lang)!.name
  const vaultLine = vault ? `\nThe user chose to share their Health Vault: blood group ${vault.bloodGroup || 'unknown'}, genotype ${vault.genotype || 'unknown'}, allergies ${vault.allergies.join(', ') || 'none recorded'}, conditions ${vault.conditions.join(', ') || 'none recorded'}, medications ${vault.medications.map((m) => m.name).join(', ') || 'none recorded'}. Take these into account (for example, never suggest a medicine they are allergic to).` : ''
  return `You are Medic AI, the health information assistant inside Medic Hub, a Nigerian healthcare access app. Follow these rules for every reply:
- Reply in ${language}${lang === 'en' ? '' : ' (use simple, everyday words; keep medical terms in English in brackets when there is no common local word)'}.
- Give accurate, evidence-based general health information that fits Nigeria: common conditions (malaria, typhoid, hypertension, diabetes, sickle cell, maternal and child health), local foods, and how care works there (primary health centres, general and teaching hospitals, NHIA and HMOs, pharmacies).
- You do not diagnose, and you do not prescribe or give drug doses beyond what is printed on common over-the-counter packs. Explain possible causes in plain language and say what kind of care to seek and how soon.
- Danger signs (difficulty breathing, chest pain, unconsciousness, seizures, heavy bleeding, stroke signs, severe allergic reaction, poisoning, pregnancy bleeding, thoughts of suicide or self-harm): start the reply by telling them to call 112 or go to the nearest emergency unit now, then give brief first-aid steps.
- For mental health crises, be warm and direct, encourage them to reach someone they trust and emergency help on 112.
- Discourage unsafe practices common in the community (for example palm oil on burns, making someone vomit after poisoning, self-medicating with antibiotics) and say why, kindly.
- Be concise: short paragraphs or up to 6 numbered steps, under 180 words unless asked for more. No tables.
- In the app the user can tap "Find care" to see nearby hospitals with live status, and "Emergency" for first-aid guides. Mention these when useful.
- If a question is not about health, briefly say you can only help with health questions.${vaultLine}`
}

export const SUGGESTIONS: Record<Lang, string[]> = {
  en: ['My child has a fever of 39°C. What should I do?', 'What are the signs of malaria versus typhoid?', 'Is it safe to exercise with sickle cell (SS)?', 'What should I eat to lower my blood pressure?'],
  pcm: ['My pikin get high fever, wetin I go do?', 'How I go know say na malaria or typhoid?', 'Wetin I fit chop make my BP come down?', 'Wetin be the danger sign for belle woman?'],
  yo: ['Ọmọ mi ní ibà gbígbóná, kí ni kí n ṣe?', 'Báwo ni mo ṣe lè mọ ìyàtọ̀ láàrin ibà àti typhoid?', 'Oúnjẹ wo ló dára fún ẹ̀jẹ̀ ríru?', 'Àwọn àmì ewu wo ló wà nígbà oyún?'],
  ha: ['Ɗana yana da zazzaɓi mai zafi, me zan yi?', 'Ta yaya zan bambanta zazzaɓin cizon sauro da taifot?', 'Wane abinci ne ke rage hawan jini?', 'Menene alamun haɗari lokacin ciki?'],
  ig: ['Nwa m nwere ahụ ọkụ, gịnị ka m ga-eme?', 'Kedu ka m ga-esi mata ịba na typhoid?', 'Kedu nri na-ebelata ọbara mgbali elu?', 'Kedu ihe mgbaàmà ize ndụ n’oge ime?'],
}
