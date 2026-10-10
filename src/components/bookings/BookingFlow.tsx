import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronRight, Clock, LogIn, Phone, Stethoscope, CalendarX, UserRound } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner, EmptyState } from '../ui/States'
import { TextArea, Field } from '../ui/Field'
import { BookingPass } from './BookingPass'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useLive } from '../../hooks/useLive'
import { db } from '../../lib/store'
import type { HospitalView } from '../../services/hospitals'
import { createBooking, doctorsForService, type BookingView } from '../../services/bookings'
import { paymentsAvailable, requiresPayment, startPayment, HOLD_MINUTES } from '../../services/payments'
import { useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck } from 'lucide-react'
import { addDays, fmtDate, fmtDateLong, fmtTime, nowHHMM, today, parseDate } from '../../utils/date'
import { cn } from '../../utils/cn'

type Step = 'service' | 'date' | 'time' | 'review' | 'done'
const STEPS: Step[] = ['service', 'date', 'time', 'review']
const naira = (n?: number) => (n ? '₦' + n.toLocaleString('en-NG') : 'Fee on arrival')

export function BookingFlow({ h, open, onClose, initialService }: { h: HospitalView; open: boolean; onClose: () => void; initialService?: string | null }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const bookable = h.services.filter((s) => s.bookable && s.active)
  const [step, setStep] = useState<Step>('service')
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slotId, setSlotId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [doctorId, setDoctorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BookingView | null>(null)
  const [dir, setDir] = useState(1)
  const nav = useNavigate()

  useEffect(() => {
    if (open) {
      const pre = initialService && bookable.find((s) => s.id === initialService) ? initialService : bookable.length === 1 ? bookable[0].id : null
      setServiceId(pre); setStep(pre ? 'date' : 'service'); setDate(null); setSlotId(null); setReason(''); setError(null); setResult(null); setPhone(user?.phone ?? ''); setDoctorId('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live slot availability — updates if someone else books or the hospital edits capacity
  const { data: slots = [] } = useLive(() => db.select('hospital_slots').filter((s) => s.hospitalId === h.id && s.serviceId === serviceId), ['hospital_slots'], [serviceId, h.id])
  const t = today(), n = nowHHMM()
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(t, i)).map((d) => {
    const ds = slots.filter((s) => s.date === d && (d > t || s.time > n))
    return { date: d, left: ds.reduce((a, s) => a + Math.max(0, s.capacity - s.booked), 0), offered: ds.length > 0 }
  }), [slots, t, n])
  const daySlots = slots.filter((s) => s.date === date).sort((a, b) => a.time.localeCompare(b.time))
  const svc = bookable.find((s) => s.id === serviceId)
  const slot = slots.find((s) => s.id === slotId)
  const doctors = serviceId ? doctorsForService(h.id, serviceId) : []
  // With online payment on, a service can only be booked once the hospital has priced it
  const priced = (fee?: number) => !paymentsAvailable() || !!(fee && fee > 0)
  const tel = (h.phone || h.emergencyPhone || '').replace(/\s/g, '')
  useEffect(() => { if (slotId && slot && slot.booked >= slot.capacity && step === 'time') setSlotId(null) }, [slot, slotId, step])

  const go = (s: Step) => { setDir(STEPS.indexOf(s) >= STEPS.indexOf(step) ? 1 : -1); setError(null); setStep(s) }
  const confirm = async () => {
    if (!serviceId || !slotId) return
    setLoading(true); setError(null)
    try {
      const b = await createBooking({ hospitalId: h.id, serviceId, slotId, reason, phone, doctorId: doctorId || undefined })
      if (b.status === 'awaiting_payment') {
        // Hand over to the secure checkout. The booking is held while the patient pays.
        const { authorizationUrl } = await startPayment(b.id)
        if (authorizationUrl.startsWith('#')) { onClose(); nav(authorizationUrl.slice(1)) } else window.location.assign(authorizationUrl)
        return
      }
      setResult(b); setDir(1); setStep('done')
      toast('success', b.status === 'confirmed' ? 'Booking confirmed' : 'Booking requested', `${b.ref} · ${fmtDate(b.date)} at ${fmtTime(b.time)}`)
    } catch (e) { setError((e as Error).message); if ((e as { code?: string }).code === 'full') go('time') } finally { setLoading(false) }
  }

  const title = step === 'done' ? '' : <span className="flex items-center gap-2">{step !== 'service' && !(step === 'date' && bookable.length === 1) && <button onClick={() => go(STEPS[STEPS.indexOf(step) - 1])} className="-ml-2 grid h-9 w-9 place-items-center rounded-full hover:bg-mist" aria-label="Back"><ArrowLeft size={18} /></button>}Book at {h.name.split(' ').slice(0, 3).join(' ')}</span>

  let body: React.ReactNode
  if (!user) {
    body = (
      <div className="py-4 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><LogIn size={24} /></span>
        <h3 className="mt-4 text-[20px] font-semibold">Sign in to book</h3>
        <p className="mx-auto mt-1.5 max-w-xs text-[14px] text-slate-600">We use your account to hold your place and send your booking pass.</p>
        <div className="mt-6 flex flex-col gap-2"><Link to={`/login?next=${encodeURIComponent(`/hospitals/${h.id}?book=1`)}`} className="btn btn-primary">Sign in</Link><Link to="/signup?role=patient" className="btn btn-secondary">Create an account</Link></div>
      </div>
    )
  } else if (user.role !== 'patient') {
    body = <EmptyState icon={<Stethoscope size={22} />} title="Bookings are for patient accounts" body="You're signed in as hospital or platform staff. Sign in with a patient account to book." />
  } else if (bookable.length === 0) {
    body = <EmptyState icon={<CalendarX size={22} />} title="No bookable services" body="This facility isn't taking appointments online right now. Call them to arrange a visit." action={<a href={`tel:${h.phone.replace(/\s/g, '')}`} className="btn btn-primary btn-sm">Call {h.phone}</a>} />
  } else if (step === 'done' && result) {
    body = (
      <div className="pb-2 pt-1">
        <div className="flex flex-col items-center text-center">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }} className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white shadow-[0_10px_30px_-8px_rgba(19,115,82,.6)]">
            <motion.svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15, duration: 0.35 }} /></motion.svg>
          </motion.span>
          <motion.h3 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-4 text-[24px] font-semibold">{result.status === 'confirmed' ? 'Booking confirmed' : 'Booking requested'}</motion.h3>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }} className="mt-1 text-[14px] text-slate-600">{result.status === 'confirmed' ? 'Your place is reserved. It\'s saved in My Bookings.' : 'The hospital will confirm shortly. We\'ll notify you.'}</motion.p>
        </div>
        <div className="mt-6"><BookingPass b={result} animate /></div>
      </div>
    )
  } else {
    body = (
      <div>
        <ol className="mb-5 flex gap-1.5" aria-label="Booking steps">{STEPS.map((s, i) => <li key={s} className={cn('h-1 flex-1 rounded-full transition-colors', STEPS.indexOf(step) >= i ? 'bg-brand-600' : 'bg-line')} aria-current={s === step ? 'step' : undefined}><span className="sr-only">{s}</span></li>)}</ol>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} initial={{ opacity: 0, x: 20 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 * dir }} transition={{ duration: 0.18 }}>
            {step === 'service' && (
              <div>
                <h3 className="text-[17px] font-semibold">Choose a service</h3>
                <ul className="mt-3 space-y-2">
                  {bookable.map((s) => {
                    const dep = h.departments.find((d) => d.id === s.departmentId)
                    if (!priced(s.fee)) return (
                      <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-line" data-testid="price-on-request">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-slate-500"><Stethoscope size={18} /></span>
                        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{s.name}</span><span className="block text-[12.5px] text-slate-500">Price on request: call the hospital and tell them what you need.</span></span>
                        {tel && <a href={`tel:${tel}`} className="btn btn-secondary btn-sm shrink-0"><Phone size={14} /> Call</a>}
                      </li>
                    )
                    return (
                      <li key={s.id}><button onClick={() => { setServiceId(s.id); setDate(null); setSlotId(null); setDoctorId(''); go('date') }} className={cn('flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-1 transition hover:ring-brand-300', serviceId === s.id ? 'bg-brand-50 ring-brand-300' : 'bg-white ring-line')}>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-brand-700"><Stethoscope size={18} /></span>
                        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{s.name}</span><span className="block text-[12.5px] text-slate-500">{dep?.name ?? s.category} · {s.durationMins} min · {naira(s.fee)}</span></span>
                        <ChevronRight size={18} className="text-slate-400" />
                      </button></li>
                    )
                  })}
                </ul>
              </div>
            )}
            {step === 'date' && (
              <div>
                <h3 className="text-[17px] font-semibold">Choose a date</h3>
                <p className="text-[13px] text-slate-500">{svc?.name}</p>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {days.map((d) => {
                    const dd = parseDate(d.date), disabled = !d.offered || d.left === 0
                    return (
                      <button key={d.date} disabled={disabled} onClick={() => { setDate(d.date); setSlotId(null); go('time') }}
                        className={cn('flex flex-col items-center rounded-2xl px-1 py-2.5 ring-1 transition', date === d.date ? 'bg-ink text-white ring-ink' : 'bg-white ring-line hover:ring-brand-300', disabled && 'cursor-not-allowed opacity-40')}>
                        <span className="text-[11px] font-medium uppercase opacity-70">{d.date === t ? 'Today' : dd.toLocaleDateString('en-NG', { weekday: 'short' })}</span>
                        <span className="font-display text-[20px] font-semibold tabular">{dd.getDate()}</span>
                        <span className={cn('text-[10.5px] font-medium', date === d.date ? 'text-white/70' : d.left ? 'text-brand-700' : 'text-slate-400')}>{!d.offered ? 'Closed' : d.left ? `${d.left} left` : 'Full'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {step === 'time' && date && (
              <div>
                <h3 className="text-[17px] font-semibold">Choose a time</h3>
                <p className="text-[13px] text-slate-500">{fmtDateLong(date)} · {svc?.name}</p>
                {error && <p role="alert" className="mt-3 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
                {daySlots.length === 0 ? <EmptyState className="mt-4" icon={<Clock size={22} />} title="No appointment slots" body="There are no times on this day. Try another date." /> : (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {daySlots.map((s) => {
                      const left = s.capacity - s.booked, past = s.date === t && s.time <= n, disabled = left <= 0 || past
                      return (
                        <button key={s.id} disabled={disabled} onClick={() => setSlotId(s.id)} aria-pressed={slotId === s.id}
                          className={cn('flex flex-col items-center rounded-2xl py-3 ring-1 transition', slotId === s.id ? 'bg-ink text-white ring-ink' : 'bg-white ring-line hover:ring-brand-300', disabled && 'cursor-not-allowed bg-canvas opacity-50')}>
                          <span className="text-[15px] font-semibold tabular">{fmtTime(s.time)}</span>
                          <span className={cn('text-[11px]', slotId === s.id ? 'text-white/70' : left <= 1 && left > 0 ? 'font-semibold text-amber-700' : 'text-slate-500')}>{past ? 'Passed' : left <= 0 ? 'Full' : `${left} ${left === 1 ? 'place' : 'places'}`}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <button disabled={!slotId} onClick={() => go('review')} className="btn btn-primary mt-5 w-full">Continue</button>
              </div>
            )}
            {step === 'review' && slot && svc && (
              <div>
                <h3 className="text-[17px] font-semibold">Review your booking</h3>
                <dl className="mt-3 divide-y divide-line rounded-2xl bg-canvas px-4 ring-1 ring-line">
                  {[['Hospital', h.name], ['Service', svc.name], ['Department', h.departments.find((d) => d.id === svc.departmentId)?.name ?? svc.category], ['Date', fmtDateLong(slot.date)], ['Time', fmtTime(slot.time)], ['Doctor', doctors.find((d) => d.id === doctorId)?.name ?? (doctors.length ? 'Any available doctor' : 'Assigned by the hospital')], ['Fee', naira(svc.fee)], ['Patient', user.name]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-3 text-[14px]"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>
                  ))}
                </dl>
                <div className="mt-4 space-y-3">
                  {doctors.length > 0 && (
                    <label className="block">
                      <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink"><UserRound size={15} /> Doctor</span>
                      <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="input mt-1.5 w-full" data-testid="doctor-select">
                        <option value="">Any available doctor</option>
                        {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.specialty}</option>)}
                      </select>
                      <span className="mt-1 block text-[12px] text-slate-500">The doctor gets an email and a message on their dashboard with your time.</span>
                    </label>
                  )}
                  <Field label="Phone number for updates" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 803 000 0000" />
                  <TextArea label="Reason for visit (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={240} placeholder="A short note helps the team prepare." hint="Shared only with this hospital." />
                </div>
                {error && <p role="alert" className="mt-3 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
                {requiresPayment(h.id, svc.fee) ? (
                  <>
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white"><span className="text-[14px] text-white/70">Total to pay now</span><span className="font-display text-[22px] font-semibold tabular">{naira(svc.fee)}</span></div>
                    <button onClick={confirm} disabled={loading} className="btn btn-brand mt-3 h-14 w-full text-[16px]" data-testid="pay-and-book">{loading ? <><Spinner /> Opening secure checkout…</> : <><Lock size={18} /> Pay {naira(svc.fee)} and book</>}</button>
                    <p className="mt-2 flex items-start justify-center gap-1.5 text-center text-[12px] text-slate-500"><ShieldCheck size={14} className="mt-px shrink-0 text-brand-600" />This is {h.name}'s own consultation fee, not an extra charge. Paying now confirms your slot (held for {HOLD_MINUTES} minutes). Tests or drugs the doctor orders are paid at the hospital. Cancel before your appointment for a full refund.</p>
                  </>
                ) : (
                  <>
                    <button onClick={confirm} disabled={loading} className="btn btn-brand mt-5 h-14 w-full text-[16px]">{loading ? <><Spinner /> Reserving your place…</> : <><Check size={18} /> Confirm booking</>}</button>
                    <p className="mt-2 text-center text-[12px] text-slate-500">{svc.fee ? `Pay ${naira(svc.fee)} at the hospital. ` : ''}Free to cancel up to your appointment time.</p>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  return <Modal open={open} onClose={onClose} title={user?.role === 'patient' && bookable.length ? title : 'Book a slot'} size="md">{body}</Modal>
}
