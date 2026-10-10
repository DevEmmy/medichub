import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Accessibility, Pause, Play, Square, Volume2, Contrast, Type, Wind, Underline, Ear, RotateCcw } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { Toggle } from '../components/ui/Field'
import { useT } from '../i18n/LanguageContext'
import { canSpeak, hasVoiceFor, onSpeech, pauseSpeaking, resumeSpeaking, setRate, speak, speakSegments, SPEECH_LANG, stopSpeaking } from '../lib/speech'
import { cn } from '../utils/cn'
import { startScreenReader } from '../lib/screenReader'

export interface A11ySettings { textScale: 1 | 1.15 | 1.3; contrast: boolean; reduceMotion: boolean; underlineLinks: boolean; talkBack: boolean; rate: number }
const DEFAULTS: A11ySettings = { textScale: 1, contrast: false, reduceMotion: false, underlineLinks: false, talkBack: false, rate: 1 }
const KEY = 'medichub.a11y.v1'

interface Ctx {
  settings: A11ySettings
  update: (p: Partial<A11ySettings>) => void
  openPanel: () => void
  readPage: (from?: HTMLElement | null) => void
  /** Read any text aloud in the current app language. */
  say: (text: string, id?: string) => void
  reading: { speaking: boolean; paused: boolean; id: string | null }
}
const A11yCtx = createContext<Ctx | null>(null)
export const useA11y = () => {
  const c = useContext(A11yCtx)
  if (!c) throw new Error('useA11y outside A11yProvider')
  return c
}

const BLOCKS = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,blockquote,figcaption,label,legend,button,a,summary,[role=heading],[role=alert],[role=status],[data-read]'
const SKIP = 'script,style,noscript,svg,[aria-hidden="true"],[data-no-read],textarea,select'

/** Splits the page into readable pieces in reading order, each tied to the element to highlight. */
function collect(root: Element): { el: HTMLElement; text: string }[] {
  const groups = new Map<HTMLElement, string[]>()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement
      if (!p || !n.textContent?.trim() || p.closest(SKIP)) return NodeFilter.FILTER_REJECT
      const vis = (p as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility?.() ?? p.getClientRects().length > 0
      return vis || p.closest('.sr-only') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement!
    let el = p.closest<HTMLElement>(BLOCKS)
    if (!el || !root.contains(el)) {
      el = p
      while (el.parentElement && el.parentElement !== root && getComputedStyle(el).display.startsWith('inline')) el = el.parentElement
    }
    const list = groups.get(el) ?? []
    list.push(n.textContent!.trim())
    groups.set(el, list)
  }
  return [...groups.entries()].map(([el, parts]) => {
    let text = parts.join(' ')
    if (el.matches('button,a,[role=button]')) text = (el.getAttribute('aria-label') || text) + (el.matches('a') ? ', link.' : ', button.')
    if (/^h[1-6]$/i.test(el.tagName) || el.getAttribute('role') === 'heading') text += '.'
    return { el, text }
  }).filter((x) => x.text.replace(/[\s.,]/g, '').length > 0)
}

export function A11yProvider({ children }: { children: ReactNode }) {
  const { lang } = useT()
  const [settings, setSettings] = useState<A11ySettings>(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
  })
  const [panel, setPanel] = useState(false)
  const [reading, setReading] = useState({ speaking: false, paused: false, id: null as string | null })
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null)
  const [announce, setAnnounce] = useState('')
  const marked = useRef<HTMLElement | null>(null)
  const readFromRef = useRef<(el: HTMLElement | null) => void>(() => {})
  const voiceLang = SPEECH_LANG[lang]

  useEffect(() => onSpeech(setReading), [])
  useEffect(() => { setRate(settings.rate) }, [settings.rate])
  const update = useCallback((p: Partial<A11ySettings>) => setSettings((s) => { const n = { ...s, ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* ignore */ } return n }), [])

  // Apply visual settings to the whole document
  useEffect(() => {
    const r = document.documentElement
    r.classList.toggle('a11y-contrast', settings.contrast)
    r.classList.toggle('a11y-motion', settings.reduceMotion)
    r.classList.toggle('a11y-links', settings.underlineLinks)
    ;(r.style as CSSStyleDeclaration & { zoom: string }).zoom = settings.textScale === 1 ? '' : String(settings.textScale)
  }, [settings])

  const unmark = () => { marked.current?.classList.remove('a11y-reading'); marked.current = null }
  const say = useCallback((text: string, id?: string) => { unmark(); setProgress(null); void speak(text, voiceLang, id) }, [voiceLang])

  const readPage = useCallback((from?: HTMLElement | null) => {
    const root = document.querySelector('main') ?? document.body
    let items = collect(root)
    if (from) { const i = items.findIndex((x) => x.el === from || x.el.contains(from) || !!(from.compareDocumentPosition(x.el) & Node.DOCUMENT_POSITION_FOLLOWING)); if (i > 0) items = items.slice(i) }
    if (!items.length) return
    setPanel(false)
    setProgress({ i: 0, n: items.length })
    void speakSegments(items.map((x) => x.text), {
      lang: voiceLang, id: 'page',
      onSegment: (i) => {
        unmark()
        const el = items[i].el
        el.classList.add('a11y-reading'); marked.current = el
        el.scrollIntoView({ block: 'center', behavior: settings.reduceMotion ? 'auto' : 'smooth' })
        setProgress({ i, n: items.length })
      },
    }).then(() => { unmark(); setProgress(null) })
  }, [voiceLang, settings.reduceMotion])
  const stop = () => { stopSpeaking(); unmark(); setProgress(null) }
  readFromRef.current = readPage

  // Screen reader mode (NVDA-style keys on a computer, TalkBack-style gestures on a phone)
  useEffect(() => {
    if (!settings.talkBack) return
    const stopAll = startScreenReader({
      say: (t) => { unmark(); setProgress(null); void speak(t, voiceLang, 'sr') },
      stop: () => { stopSpeaking(); unmark(); setProgress(null) },
      readFrom: (el) => readFromRef.current(el),
    })
    void speak('Screen reader on. Press Tab or the down arrow to move, Enter to open. On a phone, swipe right to move and double-tap to open.', voiceLang, 'sr')
    return stopAll
  }, [settings.talkBack, voiceLang])

  // Screen readers: announce each new page and move focus to its heading
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    stop()
    const t = setTimeout(() => {
      setAnnounce(`${document.title.replace(/ · Medic Hub$/, '')} page`)
      const h = document.querySelector<HTMLElement>('main h1')
      if (h && !document.activeElement?.closest('main')) {
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1')
        h.focus({ preventScroll: true })
      }
      if (settings.talkBack) void speak(`${document.title.replace(/ · Medic Hub$/, '')} page. ${h?.innerText ? h.innerText + ', heading level 1.' : ''}`, voiceLang, 'route')
    }, 450)
    return () => clearTimeout(t)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Alt+Shift+A opens accessibility, Alt+Shift+R reads the page
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey) return
      if (e.code === 'KeyA') { e.preventDefault(); setPanel(true) }
      if (e.code === 'KeyR') { e.preventDefault(); readPage() }
      if (e.code === 'KeyS') { e.preventDefault(); update({ talkBack: !settings.talkBack }) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [readPage, settings.talkBack, update])

  const voiceOk = hasVoiceFor(voiceLang)
  return (
    <A11yCtx.Provider value={{ settings, update, openPanel: () => setPanel(true), readPage, say, reading }}>
      <MotionConfig reducedMotion={settings.reduceMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="route-announcer">{announce}</div>

      {reading.speaking && reading.id === 'page' && (
        <div className="fixed inset-x-0 bottom-28 z-[60] flex justify-center px-3 lg:bottom-6" data-no-read>
          <div className="flex items-center gap-1.5 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-white shadow-lift ring-1 ring-white/10" role="region" aria-label="Read aloud controls" data-testid="reader-bar">
            <Volume2 size={16} className="text-lime-400" aria-hidden />
            <span className="mr-1 text-[13px] font-semibold tabular">Reading {progress ? `${progress.i + 1} of ${progress.n}` : ''}</span>
            <button onClick={() => (reading.paused ? resumeSpeaking() : pauseSpeaking())} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={reading.paused ? 'Resume reading' : 'Pause reading'}>{reading.paused ? <Play size={15} /> : <Pause size={15} />}</button>
            <button onClick={() => update({ rate: settings.rate >= 1.25 ? 0.8 : settings.rate >= 1 ? 1.25 : 1 })} className="h-9 rounded-full bg-white/10 px-2.5 text-[12px] font-bold hover:bg-white/20" aria-label={`Reading speed ${settings.rate} times. Change speed`}>{settings.rate}×</button>
            <button onClick={stop} className="grid h-9 w-9 place-items-center rounded-full bg-lime-400 text-ink" aria-label="Stop reading" data-testid="reader-stop"><Square size={13} fill="currentColor" /></button>
          </div>
        </div>
      )}

      <Modal open={panel} onClose={() => setPanel(false)} title="Accessibility">
        <div className="space-y-5" data-testid="a11y-panel" data-no-read>
          <section className="rounded-2xl bg-ink p-4 text-white">
            <p className="flex items-center gap-2 text-[15px] font-bold"><Volume2 size={17} className="text-lime-400" /> Read aloud</p>
            <p className="mt-1 text-[13px] text-white/70">Medic Hub reads the page to you, highlighting each part as it goes.</p>
            {canSpeak() ? (
              <>
                <button onClick={() => readPage()} className="btn btn-lime mt-3 w-full justify-center" data-testid="read-page"><Play size={16} /> Read this page aloud</button>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="text-white/70">Speed</span>
                  {[0.8, 1, 1.25, 1.5].map((r) => <button key={r} onClick={() => update({ rate: r })} aria-pressed={settings.rate === r} className={cn('rounded-full px-2.5 py-1 font-bold', settings.rate === r ? 'bg-lime-400 text-ink' : 'bg-white/10 hover:bg-white/20')}>{r}×</button>)}
                </div>
                {!voiceOk && lang !== 'en' && lang !== 'pcm' && <p className="mt-2 text-[12px] text-amber-200">Your phone has no {lang === 'yo' ? 'Yoruba' : lang === 'ha' ? 'Hausa' : 'Igbo'} voice installed, so an English voice will read. You can add one in your phone's text-to-speech settings.</p>}
              </>
            ) : <p className="mt-2 text-[13px] text-amber-200">This browser can't read aloud. Try Chrome, Safari or Edge.</p>}
          </section>

          <section className="space-y-4">
            <Row icon={Ear}><Toggle checked={settings.talkBack} onChange={(v) => update({ talkBack: v })} label="Screen reader" description="Works like NVDA. Computer: Tab or ↓ moves and reads, Enter opens, H jumps to headings, Ctrl stops. Phone: tap once to hear, double-tap to open, swipe right or left to move." /></Row>
            <Row icon={Type}>
              <div className="flex-1">
                <p className="text-[14px] font-medium text-ink">Text size</p>
                <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
                  {([[1, 'Default'], [1.15, 'Large'], [1.3, 'Larger']] as const).map(([v, l]) => (
                    <button key={v} role="radio" aria-checked={settings.textScale === v} onClick={() => update({ textScale: v })} className={cn('rounded-xl py-2 font-bold ring-1', settings.textScale === v ? 'bg-ink text-lime-300 ring-ink' : 'bg-white text-ink ring-line hover:bg-mist')} style={{ fontSize: 13 * v }}>{l}</button>
                  ))}
                </div>
              </div>
            </Row>
            <Row icon={Contrast}><Toggle checked={settings.contrast} onChange={(v) => update({ contrast: v })} label="High contrast" description="Darker text and stronger outlines." /></Row>
            <Row icon={Underline}><Toggle checked={settings.underlineLinks} onChange={(v) => update({ underlineLinks: v })} label="Underline links" description="Makes every link easy to spot." /></Row>
            <Row icon={Wind}><Toggle checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" description="Stops sliding photos and animations." /></Row>
          </section>

          <p className="rounded-2xl bg-canvas p-3 text-[12.5px] leading-relaxed text-slate-600 ring-1 ring-line">Medic Hub also works with real screen readers: <strong>NVDA</strong> or <strong>JAWS</strong> on Windows, <strong>TalkBack</strong> on Android and <strong>VoiceOver</strong> on iPhone. Keyboard: <kbd className="rounded bg-white px-1 ring-1 ring-line">Alt</kbd>+<kbd className="rounded bg-white px-1 ring-1 ring-line">Shift</kbd>+<kbd className="rounded bg-white px-1 ring-1 ring-line">S</kbd> turns the screen reader on or off, <kbd className="rounded bg-white px-1 ring-1 ring-line">Alt</kbd>+<kbd className="rounded bg-white px-1 ring-1 ring-line">Shift</kbd>+<kbd className="rounded bg-white px-1 ring-1 ring-line">R</kbd> reads the page, <kbd className="rounded bg-white px-1 ring-1 ring-line">Alt</kbd>+<kbd className="rounded bg-white px-1 ring-1 ring-line">Shift</kbd>+<kbd className="rounded bg-white px-1 ring-1 ring-line">A</kbd> opens this panel.</p>
          <button onClick={() => update(DEFAULTS)} className="btn btn-ghost btn-sm"><RotateCcw size={14} /> Reset to default</button>
        </div>
      </Modal>
    </A11yCtx.Provider>
  )
}

function Row({ icon: Icon, children }: { icon: typeof Accessibility; children: ReactNode }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime-200 text-ink"><Icon size={17} /></span><div className="min-w-0 flex-1">{children}</div></div>
}

/** Header button that opens the accessibility panel. */
export function A11yButton({ className, dark }: { className?: string; dark?: boolean }) {
  const { openPanel, settings } = useA11y()
  const on = settings.talkBack || settings.contrast || settings.textScale !== 1
  return (
    <button onClick={openPanel} aria-label="Accessibility: read aloud, text size, contrast" title="Accessibility" data-testid="a11y-btn"
      className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition', dark ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-mist', className)}>
      <Accessibility size={19} />
      {on && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-canvas" aria-hidden />}
    </button>
  )
}

/** "Listen" button for any block of text. */
export function ListenButton({ text, id, label = 'Listen', className }: { text: string | (() => string); id: string; label?: string; className?: string }) {
  const { say, reading } = useA11y()
  if (!canSpeak()) return null
  const active = reading.speaking && reading.id === id
  return (
    <button onClick={() => (active ? stopSpeaking() : say(typeof text === 'function' ? text() : text, id))} aria-pressed={active} data-testid={`listen-${id}`}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold ring-1 transition', active ? 'bg-ink text-lime-300 ring-ink' : 'bg-white text-ink ring-line hover:bg-mist', className)}>
      {active ? <Square size={13} fill="currentColor" /> : <Volume2 size={15} />} {active ? 'Stop' : label}
    </button>
  )
}
