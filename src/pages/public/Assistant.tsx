import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AiActions } from '../../components/ai/AiActions'
import { SCENES } from '../../data/scenes'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Languages, Plus, Send, Siren, Sparkles, Square, UserRound, BookOpen } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { LanguagePicker } from '../../components/navigation/LanguagePicker'
import { Toggle } from '../../components/ui/Field'
import { useAuth } from '../../contexts/AuthContext'
import { buildRules, getSampler, isRedFlag, localAnswer, SUGGESTIONS, type ChatTurn } from '../../services/ai'
import { myHealthProfile } from '../../services/health'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'

interface Msg extends ChatTurn { id: number; source?: 'ai' | 'guide'; redFlag?: boolean; error?: boolean; q?: string }
let nid = 0

/** Minimal, safe Markdown: **bold** and numbered/bulleted lines. */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((block, i) => (
        <p key={i} className="whitespace-pre-line">
          {block.split(/(\*\*[^*]+\*\*)/).map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <span key={j}>{part.replace(/^#+\s*/gm, '')}</span>)}
        </p>
      ))}
    </div>
  )
}

export default function Assistant() {
  useDocumentTitle('Medic AI')
  const { t, lang, langName } = useT()
  const { user } = useAuth()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [useVault, setUseVault] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { getSampler().then((s) => setAvailable(!!s)) }, [])
  const [params, setParams] = useSearchParams()
  const asked = useRef(false)
  useEffect(() => {
    const q = params.get('q')
    if (q && !asked.current) { asked.current = true; params.delete('q'); setParams(params, { replace: true }); void ask(q) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs])

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    const flagged = isRedFlag(question)
    const userMsg: Msg = { id: ++nid, role: 'user', content: question }
    const botId = ++nid
    const history = [...msgs.filter((m) => !m.error), userMsg]
    setMsgs([...history, { id: botId, role: 'assistant', content: '', redFlag: flagged, source: 'ai', q: question }])
    setInput('')
    setBusy(true)
    const update = (patch: Partial<Msg>) => setMsgs((ms) => ms.map((m) => (m.id === botId ? { ...m, ...patch } : m)))
    const sampler = await getSampler()
    if (!sampler || !navigator.onLine) {
      update({ content: `${navigator.onLine ? t('ai.unavailable') : t('ai.offline')}\n\n${localAnswer(question)}`, source: 'guide' })
      setBusy(false)
      return
    }
    let vault = null
    if (useVault && user?.role === 'patient') { try { vault = myHealthProfile() } catch { vault = null } }
    const turns: ChatTurn[] = [{ role: 'user', content: buildRules(lang, vault) }, ...history.slice(-10).map(({ role, content }) => ({ role, content }))]
    ctl.current = new AbortController()
    try {
      await sampler(turns, { signal: ctl.current.signal, cache: false, onText: ({ text }) => update({ content: text }) })
    } catch (e) {
      const err = e as { code?: string; text?: string }
      if (err.code === 'cancelled') update({ content: err.text || '…' })
      else if (err.code === 'not_granted' || err.code === 'sampling_disabled') { setAvailable(false); update({ content: `${t('ai.unavailable')}\n\n${localAnswer(question)}`, source: 'guide' }) }
      else if (err.code === 'rate_limited') update({ content: (err.text ? err.text + '\n\n' : '') + 'Medic AI is busy right now. Try again in a minute. If this is an emergency, call the nearest hospital emergency unit.', error: !err.text })
      else if (err.code === 'refused') update({ content: 'Medic AI can’t answer that. If you or someone else is in danger, call the nearest hospital emergency unit now.', error: true })
      else update({ content: err.text ? err.text + '\n\n(Answer interrupted.)' : `${t('ai.unavailable')}\n\n${localAnswer(question)}`, source: err.text ? 'ai' : 'guide' })
    } finally { setBusy(false); ctl.current = null }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(input) }

  return (
    <div className="container-app flex max-w-3xl flex-col py-6" style={{ minHeight: 'calc(100dvh - 64px)' }}>
      <div className="relative overflow-hidden rounded-[30px] bg-ink p-5 text-white shadow-lift grain sm:p-6">
        <img src={SCENES.lagosPhone} alt="" className="absolute inset-y-0 right-0 hidden h-full w-[40%] object-cover opacity-70 sm:block [mask-image:linear-gradient(90deg,transparent,black_45%)]" />
        <div className="absolute inset-0 adire opacity-40 [mask-image:linear-gradient(90deg,black,transparent_70%)]" aria-hidden />
        <div className="relative flex items-start gap-4 sm:max-w-[62%]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-ink"><Bot size={24} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-white">{t('ai.title')}</h1>
            <p className="mt-1 text-[14.5px] text-white/70">{t('ai.subtitle')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1', available ? 'bg-lime-400/15 text-lime-300 ring-lime-400/30' : 'bg-white/10 text-white/80 ring-white/15')} data-testid="ai-mode">
                {available ? <><Sparkles size={13} /> AI connected</> : available === false ? <><BookOpen size={13} /> Guide mode · built-in answers</> : '…'}
              </span>
              <button onClick={() => setLangOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-bold text-white ring-1 ring-white/15 hover:bg-white/20"><Languages size={13} /> {langName}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex-1 space-y-4" aria-live="polite">
        {msgs.length === 0 && (
          <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-black/5">
            <p className="eyebrow">{t('ai.suggest')}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS[lang].map((s) => <button key={s} onClick={() => ask(s)} className="group flex items-start gap-3 rounded-2xl bg-canvas px-4 py-3 text-left text-[14.5px] font-semibold text-ink ring-1 ring-line transition hover:bg-lime-200 hover:ring-lime-400"><Sparkles size={16} className="mt-0.5 shrink-0 text-brand-600" />{s}</button>)}
            </div>
            <p className="mt-4 text-[13px] text-slate-500">Medic AI links you straight to hospitals you can book, first-aid guides and emergency help.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <span className={cn('mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-lime-300 text-ink' : 'bg-ink text-lime-400')}>{m.role === 'user' ? <UserRound size={16} /> : <Bot size={16} />}</span>
              <div className={cn('max-w-[85%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed', m.role === 'user' ? 'rounded-tr-lg bg-ink text-white' : 'rounded-tl-lg bg-white text-slate-700 shadow-soft ring-1 ring-black/5')}>
                {m.role === 'assistant' && m.redFlag && (
                  <div className="mb-3 rounded-2xl bg-danger-50 p-3 ring-1 ring-danger-100">
                    <p className="flex items-center gap-2 text-[14px] font-semibold text-danger-700"><Siren size={16} /> {t('ai.redflag')}</p>
                    <div className="mt-2 flex flex-wrap gap-2"><Link to="/emergency" className="btn btn-danger btn-sm">{t('em.call')}</Link><Link to="/find?emergency=1" className="btn btn-secondary btn-sm">{t('em.findHospitals')}</Link></div>
                  </div>
                )}
                {m.role === 'assistant' && !m.content ? <span className="flex items-center gap-2 text-slate-500"><span className="flex gap-1">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />)}</span>{t('ai.thinking')}</span> : <Rich text={m.content} />}
                {m.role === 'assistant' && m.content && m.source === 'guide' && <p className="mt-2 text-[12px] text-slate-500">Built-in Medic Hub health guidance</p>}
                {m.role === 'assistant' && m.content && m.q && <AiActions question={m.q} redFlag={m.redFlag} />}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>

      <div className="mt-4 space-y-2 pt-2">
        <form onSubmit={submit} className="flex items-end gap-2 rounded-3xl bg-white p-2 shadow-lift ring-1 ring-black/5">
          <label htmlFor="ai-input" className="sr-only">{t('ai.placeholder')}</label>
          <textarea id="ai-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }} rows={1} placeholder={t('ai.placeholder')} className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-[15.5px] outline-none placeholder:text-slate-400" />
          {busy ? <button type="button" onClick={() => ctl.current?.abort()} className="btn btn-secondary h-12 rounded-2xl px-4"><Square size={16} /> {t('ai.stop')}</button>
            : <button disabled={!input.trim()} className="btn btn-primary h-12 rounded-2xl px-4"><Send size={16} /> {t('ai.send')}</button>}
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          {user?.role === 'patient' ? <div className="min-w-[240px]"><Toggle checked={useVault} onChange={setUseVault} label={t('ai.useVault')} /></div> : <span />}
          {msgs.length > 0 && <button onClick={() => { ctl.current?.abort(); setMsgs([]) }} className="btn btn-ghost btn-sm"><Plus size={15} /> {t('ai.new')}</button>}
        </div>
        <p className="px-1 text-[12px] text-slate-500">{t('ai.disclaimer')}</p>
      </div>
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  )
}
