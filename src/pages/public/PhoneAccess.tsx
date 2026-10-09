import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquareText, Phone, PhoneCall, PhoneOff, Send, Smartphone, Signal, Users } from 'lucide-react'
import { simulatePhone, DEMO_PHONE, localPhone } from '../../services/phone'
import { useAuth } from '../../contexts/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { BACKEND, PHONE_LIVE as LIVE_CODES, SMS_NUMBER, USSD_CODE } from '../../config'
import { cn } from '../../utils/cn'


type Inbox = { from: 'you' | 'medic'; text: string; at: string }
const now = () => new Date().toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })

export default function PhoneAccess() {
  useDocumentTitle('Use Medic Hub on any phone')
  const { user } = useAuth()
  const [tab, setTab] = useState<'ussd' | 'sms'>('ussd')
  const [demoPhone, setDemoPhone] = useState(localPhone(DEMO_PHONE))
  const [dial, setDial] = useState('')
  const [answers, setAnswers] = useState<string[] | null>(null)
  const [screen, setScreen] = useState<{ text: string; open: boolean } | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [inbox, setInbox] = useState<Inbox[]>([])
  const [smsText, setSmsText] = useState('HELP')
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const thread = useRef<HTMLDivElement>(null)
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight }) }, [inbox])
  useEffect(() => { if (screen?.open) inputRef.current?.focus() }, [screen])

  const phone = BACKEND ? user?.phone ?? '' : demoPhone
  const run = async (kind: 'ussd' | 'sms', text: string) => {
    setBusy(true); setErr(null)
    try { return await simulatePhone(kind, { text, phone }) } catch (e) { setErr((e as Error).message); return null } finally { setBusy(false) }
  }
  const call = async () => {
    if (dial.replace(/\s/g, '') !== USSD_CODE) { setErr(`Dial ${USSD_CODE} to open the Medic Hub menu.`); return }
    const r = await run('ussd', '')
    if (!r) return
    setAnswers([]); show(r.reply, r.sms)
  }
  const show = (reply: string, sms: string[]) => {
    setScreen({ text: reply.replace(/^(CON|END) /, ''), open: reply.startsWith('CON') })
    if (sms.length) setInbox((x) => [...x, ...sms.map((t) => ({ from: 'medic' as const, text: t, at: now() }))])
  }
  const answer = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!answers || !input.trim()) return
    const next = [...answers, input.trim()]
    const r = await run('ussd', next.join('*'))
    setInput('')
    if (!r) return
    setAnswers(next); show(r.reply, r.sms)
  }
  const hangUp = () => { setAnswers(null); setScreen(null); setInput(''); setDial('') }
  const key = (k: string) => { if (screen?.open) setInput((v) => v + k); else if (!screen) setDial((v) => v + k) }
  const sendSms = async (e: FormEvent) => {
    e.preventDefault()
    const t = smsText.trim(); if (!t) return
    setInbox((x) => [...x, { from: 'you', text: t, at: now() }]); setSmsText('')
    const r = await run('sms', t)
    if (r) setInbox((x) => [...x, { from: 'medic', text: r.reply, at: now() }])
  }

  return (
    <div className="container-app max-w-6xl py-6 lg:py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
        <section>
          <p className="eyebrow">No smartphone? No data?</p>
          <h1 className="mt-2 font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink sm:text-[52px]">Medic Hub works on <span className="hl">every phone</span>.</h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-slate-600">Many of our parents and grandparents use small button phones. They can still find an open emergency unit, book a hospital appointment and get first-aid steps, by dialling a code or sending a text. No internet needed.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-ink p-5 text-white">
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-lime-300"><PhoneCall size={16} /> Dial</p>
              <p className="mt-2 font-display text-[34px] font-extrabold tracking-wide" data-testid="ussd-code">{USSD_CODE}</p>
              <p className="mt-1 text-[14px] text-white/75">A menu opens: emergency units, book, my bookings, cancel, first aid.</p>
            </div>
            <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-brand-700"><MessageSquareText size={16} /> Text</p>
              <p className="mt-2 font-display text-[34px] font-extrabold text-ink">HELP <span className="text-slate-400">to</span> {SMS_NUMBER}</p>
              <p className="mt-1 text-[14px] text-slate-600">Then: <b>ER Oyo</b>, <b>HOSPITALS Lagos</b>, <b>SLOTS LCSH</b>, <b>BOOK 1 Ada Obi</b>, <b>MY</b>, <b>CANCEL MED-…</b></p>
            </div>
          </div>
          {!LIVE_CODES && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900 ring-1 ring-amber-100">Pilot: the code and number work in the phone on this page today. Mobile networks assign the real shortcode when Medic Hub registers with them.</p>}

          <ul className="mt-6 space-y-3 text-[15px] text-slate-700">
            {[
              [Signal, 'Checks space instantly', 'The menu reads the same live slots as the website. If a time is full, it offers the next free one.'],
              [MessageSquareText, 'Confirmation by SMS', 'The booking reference, address and fee arrive as a text to show at the front desk.'],
              [Users, 'Hospitals see it like any booking', 'Staff get the same email alert, marked “by USSD” or “by SMS”.'],
            ].map(([Icon, t, b]) => { const I = Icon as typeof Signal; return (
              <li key={t as string} className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-lime-200 text-ink"><I size={18} /></span><span><b className="text-ink">{t as string}.</b> {b as string}</span></li>
            ) })}
          </ul>
          <p className="mt-6 text-[13px] text-slate-500">Want to try it? Use the phone on this page.{BACKEND ? ' It uses the phone number on your account and shows texts here instead of sending them.' : ' This demo uses a test number.'}</p>
        </section>

        <section aria-label="Phone simulator" className="mx-auto w-full max-w-[400px]">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-mist p-1" role="tablist">
            {(['ussd', 'sms'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-xl py-2.5 text-[14px] font-bold', tab === t ? 'bg-ink text-lime-300' : 'text-slate-600')}>{t === 'ussd' ? `Dial ${USSD_CODE}` : 'Send a text'}</button>)}
          </div>

          {BACKEND && !user && <p className="mb-3 rounded-2xl bg-white p-4 text-[14px] ring-1 ring-line"><Link to="/login" className="font-bold text-brand-700 underline">Sign in</Link> to try it. It uses the phone number on your account.</p>}
          {!BACKEND && (
            <label className="mb-3 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] ring-1 ring-line"><Smartphone size={15} className="text-slate-500" /> Test phone
              <input value={demoPhone} onChange={(e) => { setDemoPhone(e.target.value); hangUp(); setInbox([]) }} className="min-w-0 flex-1 bg-transparent font-mono font-semibold text-ink outline-none" aria-label="Test phone number" data-testid="sim-phone" />
            </label>
          )}

          <div className="rounded-[44px] bg-[#1B2422] p-4 pb-6 shadow-lift ring-1 ring-black/40">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-black/50" aria-hidden />
            <div className="min-h-[300px] rounded-2xl bg-[#C9D8B6] p-4 font-mono text-[14px] leading-snug text-[#152016] shadow-inner" data-testid="phone-screen">
              <div className="mb-2 flex justify-between text-[11px] font-bold opacity-70"><span>MTN NG</span><span>{now()}</span></div>
              {tab === 'ussd' ? (
                screen ? (
                  <div aria-live="polite">
                    <pre className="whitespace-pre-wrap font-mono" data-testid="ussd-text">{screen.text}</pre>
                    {screen.open ? (
                      <form onSubmit={answer} className="mt-3 flex gap-2">
                        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" className="min-w-0 flex-1 rounded-md bg-white/70 px-2 py-1.5 outline-none" aria-label="Your answer" data-testid="ussd-input" />
                        <button className="rounded-md bg-[#152016] px-3 font-bold text-[#C9D8B6]" disabled={busy} data-testid="ussd-send">Send</button>
                      </form>
                    ) : <button onClick={hangUp} className="mt-3 rounded-md bg-[#152016] px-3 py-1.5 font-bold text-[#C9D8B6]" data-testid="ussd-ok">OK</button>}
                  </div>
                ) : (
                  <div>
                    <p className="text-[12px] opacity-70">Dial</p>
                    <p className="min-h-[40px] break-all text-[26px] font-bold" data-testid="dial-display">{dial || ' '}</p>
                    <p className="mt-6 text-[12px] opacity-70">Type {USSD_CODE} and press the green button.</p>
                  </div>
                )
              ) : (
                <div ref={thread} className="max-h-[300px] space-y-2 overflow-y-auto pr-1" data-testid="sms-thread">
                  {inbox.length === 0 && <p className="text-[12.5px] opacity-70">Texts to and from {SMS_NUMBER} appear here.</p>}
                  {inbox.map((m, i) => <p key={i} className={cn('rounded-lg px-2.5 py-1.5 text-[13px]', m.from === 'you' ? 'ml-8 bg-[#152016] text-[#C9D8B6]' : 'mr-4 bg-white/70')}>{m.text}<span className="mt-0.5 block text-[10px] opacity-60">{m.from === 'you' ? 'You' : 'Medic Hub'} · {m.at}</span></p>)}
                </div>
              )}
            </div>

            {err && <p role="alert" className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-[13px] text-danger-700">{err}</p>}

            {tab === 'ussd' ? (
              <>
                <div className="mt-4 flex items-center justify-between px-2">
                  <button onClick={call} disabled={busy || !!screen} className="grid h-12 w-20 place-items-center rounded-full bg-brand-600 text-white disabled:opacity-40" aria-label="Call" data-testid="ussd-call"><Phone size={20} /></button>
                  <button onClick={() => (screen?.open ? setInput((v) => v.slice(0, -1)) : setDial((v) => v.slice(0, -1)))} className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-bold text-white" aria-label="Delete">Del</button>
                  <button onClick={hangUp} className="grid h-12 w-20 place-items-center rounded-full bg-danger-600 text-white" aria-label="End"><PhoneOff size={20} /></button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 px-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                    <button key={k} onClick={() => key(k)} className="h-12 rounded-2xl bg-white/10 font-mono text-[20px] font-bold text-white active:bg-white/25" aria-label={`Key ${k}`} data-testid={`key-${k === '*' ? 'star' : k === '#' ? 'hash' : k}`}>{k}</button>
                  ))}
                </div>
                {screen?.open && <button onClick={() => answer()} disabled={busy || !input} className="mx-2 mt-3 w-[calc(100%-16px)] rounded-2xl bg-lime-400 py-2.5 font-bold text-ink disabled:opacity-40">Send answer</button>}
              </>
            ) : (
              <form onSubmit={sendSms} className="mt-4 flex gap-2 px-1">
                <input value={smsText} onChange={(e) => setSmsText(e.target.value)} className="min-w-0 flex-1 rounded-2xl bg-white/90 px-3 py-3 text-[14px] outline-none" placeholder="Type a message" aria-label="Message" data-testid="sms-input" />
                <button disabled={busy} className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-400 text-ink" aria-label="Send text" data-testid="sms-send"><Send size={18} /></button>
              </form>
            )}
          </div>

          {tab === 'ussd' && inbox.length > 0 && (
            <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-line" data-testid="sms-inbox">
              <p className="flex items-center gap-2 text-[13px] font-bold text-ink"><MessageSquareText size={15} /> Texts received</p>
              <ul className="mt-2 space-y-2">{inbox.filter((m) => m.from === 'medic').slice(-3).map((m, i) => <li key={i} className="rounded-xl bg-canvas p-2.5 text-[13px] text-slate-700">{m.text}</li>)}</ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
