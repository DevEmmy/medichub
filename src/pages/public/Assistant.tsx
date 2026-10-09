import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUp, Bot, Check, Copy, History, Languages, MessageSquarePlus, Mic, MicOff, Pencil, RefreshCw, Siren,
  Sparkles, Square, Trash2, UserRound, Volume2, VolumeX, X, BookOpen, ShieldCheck,
} from 'lucide-react'
import { AiActions } from '../../components/ai/AiActions'
import { Markdown } from '../../components/ai/Markdown'
import { SCENES } from '../../data/scenes'
import { useT } from '../../i18n/LanguageContext'
import { LanguagePicker } from '../../components/navigation/LanguagePicker'
import { Toggle } from '../../components/ui/Field'
import { useAuth } from '../../contexts/AuthContext'
import { AiError, buildRules, getProviders, isRedFlag, localAnswer, streamAnswer, SUGGESTIONS, type ChatTurn, type Provider } from '../../services/ai'
import { myHealthProfile } from '../../services/health'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'
import type { Lang } from '../../i18n/strings'

interface Msg extends ChatTurn { id: string; source?: 'ai' | 'guide'; via?: string; redFlag?: boolean; error?: boolean; q?: string; streaming?: boolean }
interface Chat { id: string; title: string; updated: number; msgs: Msg[] }

const KEY = 'medichub.chats.v1'
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
function loadChats(): Chat[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function saveChats(chats: Chat[]) {
  try { localStorage.setItem(KEY, JSON.stringify(chats.slice(0, 50).map((c) => ({ ...c, msgs: c.msgs.map(({ streaming: _s, ...m }) => m) })))) } catch { /* storage full or blocked */ }
}
const SPEECH_LANG: Record<Lang, string> = { en: 'en-NG', pcm: 'en-NG', yo: 'yo-NG', ha: 'ha-NG', ig: 'ig-NG' }
const plain = (md: string) => md.replace(/```[\s\S]*?```/g, '').replace(/[*_`#>|]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n{2,}/g, '. ')
const when = (t: number) => {
  const d = (Date.now() - t) / 864e5
  return d < 1 ? 'Today' : d < 2 ? 'Yesterday' : d < 7 ? 'This week' : 'Earlier'
}

type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void; onend: () => void; onerror: () => void }

export default function Assistant() {
  useDocumentTitle('Medic AI')
  const { t, lang, langName } = useT()
  const { user } = useAuth()
  const [chats, setChats] = useState<Chat[]>(loadChats)
  const [chatId, setChatId] = useState<string | null>(null)
  const chat = chats.find((c) => c.id === chatId) ?? null
  const msgs = useMemo(() => chat?.msgs ?? [], [chat])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [useVault, setUseVault] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  const rec = useRef<SR | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)

  useEffect(() => { getProviders().then(setProviders) }, [])
  useEffect(() => { if (!busy) saveChats(chats) }, [chats, busy])
  useEffect(() => () => { ctl.current?.abort(); window.speechSynthesis?.cancel(); rec.current?.stop() }, [])

  // Keep the newest text in view while streaming, unless the reader scrolled up
  useEffect(() => {
    const onScroll = () => { stick.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160 }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { if (stick.current) end.current?.scrollIntoView({ block: 'end' }) }, [msgs])

  // Auto-grow the composer
  useEffect(() => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px' } }, [input])

  const patchChat = useCallback((id: string, fn: (c: Chat) => Chat) => setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c))), [])

  /** Sends `history` (ending with the user's message) and streams the reply into a new assistant bubble. */
  const run = useCallback(async (cid: string, history: Msg[]) => {
    const question = history[history.length - 1].content
    const flagged = isRedFlag(question)
    const botId = uid()
    patchChat(cid, (c) => ({ ...c, updated: Date.now(), msgs: [...history, { id: botId, role: 'assistant', content: '', redFlag: flagged, source: 'ai', q: question, streaming: true }] }))
    setBusy(true); stick.current = true
    const update = (p: Partial<Msg>) => patchChat(cid, (c) => ({ ...c, msgs: c.msgs.map((m) => (m.id === botId ? { ...m, ...p } : m)) }))
    const guide = (lead: string) => update({ content: `${lead}\n\n${localAnswer(question)}`, source: 'guide', streaming: false })

    if (!navigator.onLine) { guide(t('ai.offline')); setBusy(false); return }
    let vault = null
    if (useVault && user?.role === 'patient') { try { vault = myHealthProfile() } catch { vault = null } }
    const turns: ChatTurn[] = history.filter((m) => !m.error && m.content.trim()).slice(-16).map(({ role, content }) => ({ role, content }))
    ctl.current = new AbortController()
    try {
      const { provider } = await streamAnswer(turns, {
        system: buildRules(lang, vault), publicSystem: buildRules(lang, null), signal: ctl.current.signal,
        onText: (text) => update({ content: text }),
      })
      update({ streaming: false, via: provider.label })
    } catch (e) {
      const err = e as AiError
      if (err.code === 'cancelled') update({ content: err.text || '_Stopped._', streaming: false })
      else if (err.text) update({ content: err.text + '\n\n_(Answer interrupted. Tap regenerate to try again.)_', streaming: false })
      else if (err.code === 'refused') update({ content: 'Medic AI can’t answer that. If you or someone else is in danger, call the nearest hospital emergency unit now.', error: true, streaming: false })
      else guide(t('ai.unavailable'))
    } finally { setBusy(false); ctl.current = null }
  }, [lang, patchChat, t, useVault, user?.role])

  const ask = useCallback((q: string) => {
    const question = q.trim()
    if (!question || busy) return
    const userMsg: Msg = { id: uid(), role: 'user', content: question }
    let cid = chatId
    if (!cid || !chats.some((c) => c.id === cid)) {
      cid = uid()
      const fresh: Chat = { id: cid, title: question.slice(0, 60), updated: Date.now(), msgs: [] }
      setChats((cs) => [fresh, ...cs]); setChatId(cid)
    }
    setInput('')
    void run(cid, [...msgs.filter((m) => !m.error), userMsg])
  }, [busy, chatId, chats, msgs, run])

  // ?q= from elsewhere in the app starts a new chat with that question
  const [params, setParams] = useSearchParams()
  const pendingQ = useRef<string | null>(null)
  useEffect(() => {
    const q = params.get('q')
    if (!q) return
    params.delete('q'); setParams(params, { replace: true })
    ctl.current?.abort(); pendingQ.current = q; setChatId(null)
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  // Ask once the fresh chat is in place (and any previous answer has stopped)
  useEffect(() => {
    if (pendingQ.current && chatId === null && !busy) { const q = pendingQ.current; pendingQ.current = null; ask(q) }
  }, [chatId, busy, ask])

  const regenerate = () => {
    if (!chat || busy) return
    const lastUser = [...msgs].reverse().findIndex((m) => m.role === 'user')
    if (lastUser < 0) return
    void run(chat.id, msgs.slice(0, msgs.length - lastUser))
  }
  const saveEdit = () => {
    if (!chat || !editing || busy || !editing.text.trim()) return
    const i = msgs.findIndex((m) => m.id === editing.id)
    const edited: Msg = { ...msgs[i], content: editing.text.trim() }
    setEditing(null)
    void run(chat.id, [...msgs.slice(0, i), edited])
  }
  const copy = async (m: Msg) => {
    try { await navigator.clipboard.writeText(m.content) } catch {
      const ta = document.createElement('textarea'); ta.value = m.content; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setCopied(m.id); setTimeout(() => setCopied(null), 1500)
  }
  const speak = (m: Msg) => {
    const synth = window.speechSynthesis
    if (!synth) return
    if (speaking === m.id) { synth.cancel(); setSpeaking(null); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(plain(m.content))
    u.lang = SPEECH_LANG[lang]; u.rate = 1
    u.onend = () => setSpeaking(null); u.onerror = () => setSpeaking(null)
    setSpeaking(m.id); synth.speak(u)
  }
  const Speech = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition
  const toggleMic = () => {
    if (!Speech) return
    if (listening) { rec.current?.stop(); return }
    const r = new Speech(); rec.current = r
    r.lang = SPEECH_LANG[lang]; r.interimResults = true; r.continuous = false
    const base = input ? input.trimEnd() + ' ' : ''
    r.onresult = (e) => setInput(base + Array.from(e.results).map((x) => x[0].transcript).join(''))
    r.onend = () => setListening(false); r.onerror = () => setListening(false)
    setListening(true); r.start()
  }
  const newChat = () => { ctl.current?.abort(); setChatId(null); setEditing(null); setDrawer(false); setTimeout(() => box.current?.focus(), 50) }
  const removeChat = (id: string) => { if (id === chatId) newChat(); setChats((cs) => cs.filter((c) => c.id !== id)) }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(input) }

  const live = providers && providers.length > 0
  const privateAi = providers?.some((p) => p.private)
  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')

  const historyList = (
    <div className="flex h-full flex-col">
      <button onClick={newChat} className="btn btn-lime w-full justify-center" data-testid="new-chat"><MessageSquarePlus size={17} /> {t('ai.new')}</button>
      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1" data-testid="chat-history">
        {chats.length === 0 && <p className="px-1 text-[13px] text-white/60">Your conversations are saved on this device so you can come back to them.</p>}
        {(['Today', 'Yesterday', 'This week', 'Earlier'] as const).map((g) => {
          const items = chats.filter((c) => when(c.updated) === g)
          if (!items.length) return null
          return (
            <div key={g}>
              <p className="px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{g}</p>
              <ul className="mt-1 space-y-0.5">
                {items.map((c) => (
                  <li key={c.id} className={cn('group flex items-center rounded-xl', c.id === chatId ? 'bg-white/15' : 'hover:bg-white/5')}>
                    <button onClick={() => { setChatId(c.id); setDrawer(false); setEditing(null) }} className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[14px] text-white/90">{c.title}</button>
                    <button onClick={() => removeChat(c.id)} aria-label={`Delete “${c.title}”`} className="mr-1 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white lg:opacity-0 lg:group-hover:opacity-100"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <p className="mt-3 border-t border-white/10 pt-3 text-[11.5px] leading-snug text-white/50">{t('ai.disclaimer')}</p>
    </div>
  )

  return (
    <div className="container-app max-w-6xl py-4 lg:py-6">
      <div className="lg:grid lg:grid-cols-[264px_1fr] lg:gap-6">
        {/* History: sidebar on desktop, drawer on phones */}
        <aside className="sticky top-24 hidden h-[calc(100dvh-8rem)] rounded-[26px] bg-ink p-4 text-white shadow-lift lg:block">{historyList}</aside>
        <AnimatePresence>
          {drawer && (
            <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button className="absolute inset-0 bg-ink/50 backdrop-blur-sm" aria-label="Close history" onClick={() => setDrawer(false)} />
              <motion.div className="absolute inset-y-0 left-0 w-[84%] max-w-[320px] bg-ink p-4 pt-5 text-white shadow-lift" initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
                <div className="mb-4 flex items-center justify-between"><p className="font-display text-[18px] font-extrabold">Your chats</p><button onClick={() => setDrawer(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close"><X size={18} /></button></div>
                <div className="h-[calc(100%-3.5rem)]">{historyList}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="flex min-h-[calc(100dvh-9rem)] min-w-0 flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawer(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft ring-1 ring-black/5 lg:hidden" aria-label="Chat history" data-testid="history-btn"><History size={18} /></button>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink text-lime-400"><Bot size={20} /></span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-[19px] font-extrabold leading-tight text-ink">{chat ? chat.title : t('ai.title')}</h1>
                <span className={cn('inline-flex items-center gap-1 text-[12px] font-bold', live ? 'text-brand-700' : 'text-slate-500')} data-testid="ai-mode">
                  {live ? <><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> AI connected</> : providers ? <><BookOpen size={12} /> Guide mode · built-in answers</> : '…'}
                </span>
              </div>
            </div>
            <button onClick={() => setLangOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-bold text-ink shadow-soft ring-1 ring-black/5"><Languages size={15} /> <span className="hidden sm:inline">{langName}</span></button>
            <button onClick={newChat} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft ring-1 ring-black/5 lg:hidden" aria-label={t('ai.new')}><MessageSquarePlus size={18} /></button>
          </div>

          {/* Conversation */}
          <div className="flex-1 pt-4" aria-live="polite">
            {msgs.length === 0 ? (
              <div className="mx-auto max-w-3xl">
                <div className="relative overflow-hidden rounded-[30px] bg-ink p-6 text-white shadow-lift grain sm:p-8">
                  <img src={SCENES.lagosPhone} alt="" className="absolute inset-y-0 right-0 hidden h-full w-[42%] object-cover opacity-70 sm:block [mask-image:linear-gradient(90deg,transparent,black_45%)]" />
                  <div className="absolute inset-0 adire opacity-40 [mask-image:linear-gradient(90deg,black,transparent_70%)]" aria-hidden />
                  <div className="relative sm:max-w-[60%]">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-2.5 py-1 text-[12px] font-bold text-lime-300 ring-1 ring-lime-400/30"><Sparkles size={13} /> Ask anything about your health</span>
                    <h2 className="mt-3 font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[38px]">How can I help you <span className="text-lime-400">today?</span></h2>
                    <p className="mt-2 text-[15px] text-white/70">{t('ai.subtitle')}</p>
                  </div>
                </div>
                <p className="eyebrow mt-6">{t('ai.suggest')}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS[lang].map((s) => <button key={s} onClick={() => ask(s)} className="group flex items-start gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-[14.5px] font-semibold text-ink shadow-soft ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-lime-400"><Sparkles size={16} className="mt-0.5 shrink-0 text-brand-600" />{s}</button>)}
                </div>
                <p className="mt-4 text-[13px] text-slate-500">Medic AI remembers the conversation, answers follow-up questions, and links you straight to hospitals you can book, first-aid guides and emergency help.</p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 pb-4">
                {msgs.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('group flex gap-3', m.role === 'user' && 'flex-row-reverse')} data-testid={m.role === 'user' ? 'msg-user' : 'msg-ai'}>
                    <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-lime-300 text-ink' : 'bg-ink text-lime-400')}>{m.role === 'user' ? <UserRound size={15} /> : <Bot size={15} />}</span>
                    {m.role === 'user' ? (
                      <div className="flex max-w-[85%] flex-col items-end">
                        {editing?.id === m.id ? (
                          <div className="w-[min(560px,80vw)] rounded-3xl bg-white p-3 shadow-soft ring-2 ring-lime-400">
                            <textarea autoFocus value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } if (e.key === 'Escape') setEditing(null) }} rows={3} className="w-full resize-none bg-transparent text-[15px] outline-none" aria-label="Edit message" />
                            <div className="mt-2 flex justify-end gap-2"><button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={saveEdit} className="btn btn-primary btn-sm" data-testid="save-edit">Send</button></div>
                          </div>
                        ) : (
                          <>
                            <div className="whitespace-pre-wrap break-words rounded-3xl rounded-tr-lg bg-ink px-4 py-3 text-[15px] leading-relaxed text-white">{m.content}</div>
                            {!busy && <button onClick={() => setEditing({ id: m.id, text: m.content })} className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-slate-500 hover:bg-white hover:text-ink lg:opacity-0 lg:group-hover:opacity-100" data-testid="edit-msg"><Pencil size={12} /> Edit</button>}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1 text-[15.5px] leading-relaxed text-slate-700">
                        {m.redFlag && (
                          <div className="mb-3 rounded-2xl bg-danger-50 p-3 ring-1 ring-danger-100">
                            <p className="flex items-center gap-2 text-[14px] font-semibold text-danger-700"><Siren size={16} /> {t('ai.redflag')}</p>
                            <div className="mt-2 flex flex-wrap gap-2"><Link to="/emergency" className="btn btn-danger btn-sm">{t('em.call')}</Link><Link to="/find?emergency=1" className="btn btn-secondary btn-sm">{t('em.findHospitals')}</Link></div>
                          </div>
                        )}
                        {!m.content && m.streaming ? (
                          <span className="flex items-center gap-2 pt-1.5 text-slate-500"><span className="flex gap-1">{[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-brand-500" animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />)}</span>{t('ai.thinking')}</span>
                        ) : <Markdown text={m.content} streaming={m.streaming} />}
                        {!m.streaming && m.content && (
                          <>
                            {m.source === 'guide' && <p className="mt-2 text-[12px] text-slate-500">Built-in Medic Hub health guidance</p>}
                            {m.q && <AiActions question={m.q} redFlag={m.redFlag} />}
                            <div className="mt-2 flex flex-wrap items-center gap-0.5 text-slate-500">
                              <IconBtn label={copied === m.id ? 'Copied' : 'Copy'} onClick={() => copy(m)}>{copied === m.id ? <Check size={15} /> : <Copy size={15} />}</IconBtn>
                              {'speechSynthesis' in window && <IconBtn label={speaking === m.id ? 'Stop reading' : 'Read aloud'} onClick={() => speak(m)}>{speaking === m.id ? <VolumeX size={15} /> : <Volume2 size={15} />}</IconBtn>}
                              {m.id === lastAssistant?.id && !busy && <IconBtn label="Regenerate" onClick={regenerate} testid="regenerate"><RefreshCw size={15} /></IconBtn>}
                              {m.via && <span className="ml-1 text-[11.5px] text-slate-400">· {m.via}</span>}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>

          {/* Composer */}
          <div className="sticky bottom-24 z-30 mx-auto w-full max-w-3xl pt-3 lg:bottom-0 lg:pb-4"><div className="pointer-events-none absolute inset-x-0 -bottom-24 top-0 -z-10 bg-gradient-to-t from-canvas via-canvas to-transparent lg:bottom-0" aria-hidden />
            <form onSubmit={submit} className="rounded-[26px] bg-white p-2 shadow-lift ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-lime-400">
              <label htmlFor="ai-input" className="sr-only">{t('ai.placeholder')}</label>
              <textarea id="ai-input" ref={box} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(input) } }} rows={1} placeholder={listening ? 'Listening… speak now' : t('ai.placeholder')} className="block max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-3 pt-2.5 text-[15.5px] outline-none placeholder:text-slate-400" />
              <div className="flex items-center gap-1.5 px-1 pt-1">
                {Speech && <button type="button" onClick={toggleMic} className={cn('grid h-10 w-10 place-items-center rounded-full transition', listening ? 'bg-danger-600 text-white' : 'text-slate-600 hover:bg-canvas')} aria-label={listening ? 'Stop voice input' : 'Speak your question'} data-testid="mic">{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
                {user?.role === 'patient' && (
                  <div className="min-w-0 flex-1 text-[12.5px]"><Toggle checked={useVault} onChange={setUseVault} label={t('ai.useVault')} /></div>
                )}
                <div className="ml-auto" />
                {busy
                  ? <button type="button" onClick={() => ctl.current?.abort()} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white" aria-label={t('ai.stop')} data-testid="stop"><Square size={14} fill="currentColor" /></button>
                  : <button disabled={!input.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-lime-400 transition disabled:bg-slate-200 disabled:text-slate-400" aria-label={t('ai.send')} data-testid="send"><ArrowUp size={19} strokeWidth={2.6} /></button>}
              </div>
            </form>
            {useVault && !privateAi && <p className="mt-1.5 flex items-center gap-1.5 px-2 text-[12px] text-slate-500"><ShieldCheck size={13} /> Your Health Vault stays private here: it is only shared with Medic Hub’s own AI, not the free public one.</p>}
            <p className="mt-1.5 px-2 text-center text-[11.5px] text-slate-500 lg:hidden">{t('ai.disclaimer')}</p>
          </div>
        </section>
      </div>
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  )
}

function IconBtn({ label, onClick, children, testid }: { label: string; onClick: () => void; children: ReactNode; testid?: string }) {
  return <button onClick={onClick} title={label} aria-label={label} data-testid={testid} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white hover:text-ink">{children}</button>
}
