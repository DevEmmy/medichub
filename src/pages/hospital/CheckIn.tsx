import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, CircleCheck, ScanLine, TriangleAlert, UserRound } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { hospitalBookings, lookupBooking, setBookingStatus, type BookingView } from '../../services/bookings'
import { BookingStatusPill } from '../../components/ui/StatusPill'
import { Spinner } from '../../components/ui/States'
import { useToast } from '../../contexts/ToastContext'
import { fmtDate, fmtTime, today, relTime } from '../../utils/date'
import { DEMO } from '../../config'
import { naira } from '../../services/payments'
import { QrScanner } from '../../components/ui/QrScanner'

export default function CheckIn() {
  useDocumentTitle('Check-in')
  const { hospitalId } = useMyHospital()
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [found, setFound] = useState<BookingView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [scan, setScan] = useState(false)
  const { data: all = [] } = useLive(() => hospitalBookings(hospitalId), ['bookings', 'hospital_services'], [hospitalId])
  const recent = all.filter((b) => b.date === today() && ['checked_in', 'in_consultation'].includes(b.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const live = found ? all.find((b) => b.id === found.id) ?? found : null

  const lookup = (c: string) => {
    setError(null); setFound(null); setDone(false)
    if (!c.trim()) { setError('Enter a booking code, for example MED-7X82K9.'); return }
    const r = lookupBooking(hospitalId, c)
    if ('error' in r) setError(r.error); else setFound(r)
  }
  const submit = (e: FormEvent) => { e.preventDefault(); lookup(code) }
  const checkIn = async () => {
    if (!live) return
    setBusy(true)
    try { await setBookingStatus(hospitalId, live.id, 'checked_in'); setDone(true); toast('success', 'Patient checked in', `${live.patientName} · ${live.ref}`) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const canCheckIn = live && (live.status === 'confirmed' || live.status === 'pending' || live.status === 'no_show')
  const warn = live && live.status === 'awaiting_payment' ? 'This patient has not completed payment. Ask them to pay from their booking, or cancel it.' : live && live.date !== today() ? `This booking is for ${fmtDate(live.date)}, not today.` : null

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div><h1 className="text-[28px] font-semibold">Check-in</h1><p className="mt-1 text-[14px] text-slate-600">Scan the patient's QR pass or type their booking code.</p></div>
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          {scan ? <div className="mb-4"><QrScanner hint="Point at the patient's QR pass" onCode={(c) => { setScan(false); setCode(c.split(':')[1] ?? c); lookup(c) }} onClose={() => setScan(false)} /></div> : null}
          <form onSubmit={submit} className="mt-0 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1"><span className="sr-only">Booking code</span><ScanLine size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MED-7X82K9" autoFocus autoComplete="off" spellCheck={false} className="input h-14 pl-12 font-mono text-[20px] tracking-[0.1em]" /></label>
            <button className="btn btn-primary h-14 px-6">Find booking</button>
            <button type="button" onClick={() => setScan(true)} className="btn btn-secondary h-14" data-testid="open-scanner"><Camera size={18} /> Scan QR</button>
          </form>
          {DEMO && <p className="mt-2 text-[12.5px] text-slate-500">Try <button type="button" onClick={() => { setCode('MED-7X82K9'); lookup('MED-7X82K9') }} className="font-mono font-semibold text-brand-700 hover:underline">MED-7X82K9</button> (demo patient, tomorrow) or <button type="button" onClick={() => { setCode('MED-K7RA5N'); lookup('MED-K7RA5N') }} className="font-mono font-semibold text-brand-700 hover:underline">MED-K7RA5N</button> (today).</p>}
        </section>

        <AnimatePresence mode="wait">
          {error && <motion.div key="err" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="flex gap-3 rounded-2xl bg-danger-50 p-4 text-[14px] font-medium text-danger-700 ring-1 ring-danger-100"><TriangleAlert size={19} />{error}</motion.div>}
          {live && (
            <motion.section key={live.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
              <div className="flex items-center gap-4 border-b border-line p-5">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><UserRound size={26} /></span>
                <div className="min-w-0 flex-1"><p className="font-display text-[22px] font-semibold text-ink">{live.patientName}</p><p className="text-[13px] text-slate-500">{live.patientPhone ?? 'No phone on file'}</p></div>
                <BookingStatusPill status={live.status} />
              </div>
              <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
                {[['Booking ID', live.ref], ['Service', live.serviceName], ['Department', live.departmentName ?? '—'], ['Date', live.date === today() ? 'Today' : fmtDate(live.date)], ['Time', fmtTime(live.time)],
                  ['Payment', live.paymentStatus === 'paid' ? `Paid ${naira(live.amount ?? 0)}` : live.paymentStatus === 'refunded' ? 'Refunded' : live.status === 'awaiting_payment' ? 'Not paid yet' : live.amount ? `Collect ${naira(live.amount)}` : 'No fee'],
                  ['Booked', relTime(live.createdAt)], ['Payment ref', live.paymentRef ?? '—']].map(([k, v]) => <div key={k}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-0.5 text-[15px] font-semibold text-ink">{v}</dd></div>)}
              </dl>
              {live.reason && <p className="mx-5 mb-4 rounded-xl bg-canvas p-3 text-[13.5px] text-slate-700"><span className="font-semibold">Reason:</span> {live.reason}</p>}
              {warn && !done && <p className="mx-5 mb-4 rounded-xl bg-amber-50 p-3 text-[13.5px] font-medium text-amber-700">{warn}</p>}
              <div className="border-t border-line bg-canvas/60 p-5">
                {done || live.status === 'checked_in' ? (
                  <motion.p initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2 text-[16px] font-semibold text-brand-700"><CircleCheck size={22} /> Checked in. The patient has been notified.</motion.p>
                ) : canCheckIn ? (
                  <button onClick={checkIn} disabled={busy} className="btn btn-brand h-14 w-full text-[16px]">{busy ? <Spinner /> : <CircleCheck size={19} />} Confirm check-in</button>
                ) : <p className="text-center text-[14px] text-slate-600">This booking is {live.status.replace('_', ' ')} and can't be checked in.</p>}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <aside className="rounded-2xl bg-white p-5 ring-1 ring-line lg:self-start">
        <h2 className="text-[15px] font-semibold">Recently checked in</h2>
        <ul className="mt-3 space-y-3">
          {recent.map((b) => <li key={b.id} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-sky-50 text-sky-700"><CircleCheck size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-ink">{b.patientName}</p><p className="text-[12px] text-slate-500">{fmtTime(b.time)} · {relTime(b.updatedAt)}</p></div></li>)}
          {recent.length === 0 && <li className="text-[13.5px] text-slate-500">No check-ins yet today.</li>}
        </ul>
      </aside>
    </div>
  )
}
