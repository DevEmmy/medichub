// Text-to-speech built on the browser's own voices (works offline on most phones).
// Long text is split into sentences because some browsers stop a single utterance after ~15 seconds.
import type { Lang } from '../i18n/strings'

export const SPEECH_LANG: Record<Lang, string> = { en: 'en-NG', pcm: 'en-NG', yo: 'yo-NG', ha: 'ha-NG', ig: 'ig-NG' }
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

type Listener = (state: { speaking: boolean; paused: boolean; id: string | null }) => void
const listeners = new Set<Listener>()
let state = { speaking: false, paused: false, id: null as string | null }
let session = 0
const set = (s: Partial<typeof state>) => { state = { ...state, ...s }; listeners.forEach((l) => l(state)) }
export const onSpeech = (l: Listener) => { listeners.add(l); l(state); return () => { listeners.delete(l) } }
export const speechState = () => state

let rate = 1
export const setRate = (r: number) => { rate = r }

/** Best voice for a language: exact match, then same language, then Nigerian/British/any English. */
export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null
  const voices = window.speechSynthesis.getVoices()
  const base = lang.split('-')[0]
  return voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase())
    ?? voices.find((v) => v.lang.toLowerCase().startsWith(base + '-') || v.lang.toLowerCase() === base)
    ?? voices.find((v) => /en-NG/i.test(v.lang))
    ?? voices.find((v) => /en-GB/i.test(v.lang))
    ?? voices.find((v) => /^en/i.test(v.lang))
    ?? null
}
export const hasVoiceFor = (lang: string) => { const v = pickVoice(lang); return !!v && v.lang.split('-')[0] === lang.split('-')[0] }

export function chunk(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const parts = clean.match(/[^.!?。]+[.!?。]*\s*/g) ?? [clean]
  const out: string[] = []
  for (const p of parts) {
    if (p.length <= 220) { out.push(p.trim()); continue }
    for (let i = 0; i < p.length; i += 200) out.push(p.slice(i, i + 200).trim())
  }
  return out.filter(Boolean)
}

/**
 * Speaks a list of segments in order. `onSegment(i)` fires as each one starts (used to highlight
 * what is being read). Resolves when finished or stopped.
 */
export function speakSegments(segments: string[], o: { lang: string; id?: string; onSegment?: (i: number) => void }): Promise<void> {
  if (!canSpeak()) return Promise.resolve()
  const synth = window.speechSynthesis
  synth.cancel()
  const my = ++session
  set({ speaking: true, paused: false, id: o.id ?? null })
  const voice = pickVoice(o.lang)
  return new Promise((resolve) => {
    let i = 0
    const next = () => {
      if (my !== session) return resolve()
      if (i >= segments.length) { set({ speaking: false, paused: false, id: null }); return resolve() }
      const idx = i++
      const pieces = chunk(segments[idx])
      if (!pieces.length) return next()
      o.onSegment?.(idx)
      let j = 0
      const say = () => {
        if (my !== session) return resolve()
        if (j >= pieces.length) return next()
        const u = new SpeechSynthesisUtterance(pieces[j++])
        u.lang = voice?.lang ?? o.lang
        if (voice) u.voice = voice
        u.rate = rate
        u.onend = say
        u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') return resolve(); say() }
        synth.speak(u)
      }
      say()
    }
    next()
  })
}

export const speak = (text: string, lang: string, id?: string) => speakSegments([text], { lang, id })
export function stopSpeaking() { session++; if (canSpeak()) window.speechSynthesis.cancel(); set({ speaking: false, paused: false, id: null }) }
export function pauseSpeaking() { if (canSpeak()) { window.speechSynthesis.pause(); set({ paused: true }) } }
export function resumeSpeaking() { if (canSpeak()) { window.speechSynthesis.resume(); set({ paused: false }) } }

// Voices load asynchronously in Chrome
if (canSpeak()) { try { window.speechSynthesis.getVoices(); window.speechSynthesis.addEventListener?.('voiceschanged', () => {}) } catch { /* ignore */ } }
