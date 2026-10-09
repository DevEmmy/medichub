import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList, MoreHorizontal, Search, CalendarClock } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { hospitalBookings, NEXT_STATUSES, rescheduleBooking, setBookingStatus, type BookingView } from '../../services/bookings'
import { db } from '../../lib/store'
import { BookingStatusPill, BOOKING_STATUS } from '../../components/ui/StatusPill'
import { EmptyState, Spinner } from '../../components/ui/States'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../contexts/ToastContext'
import { addDays, fmtDate, fmtTime, today, nowHHMM } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { BookingStatus } from '../../types'

const RANGES = [{ k: 'today', l: 'Today' }, { k: 'tomorrow', l: 'Tomorrow' }, { k: 'upcoming', l: 'Upcoming' }, { k: 'past', l: 'Past' }, { k: 'all', l: 'All' }] as const
type Range = (typeof RANGES)[number]['k']

function Actions({ b, onReschedule }: { b: BookingView; onReschedule: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const next = NEXT_STATUSES[b.status]
  const act = async (s: BookingStatus) => {
    setBusy(true); setOpen(false)
    try { await setBookingStatus(b.hospitalId, b.id, s); toast('success', `Marked ${BOOKING_STATUS[s].label.toLowerCase()}`, `${b.patientName} · ${b.ref}. The patient has been notified.`) } catch (e) { toast('error', 'Update failed', (e as Error).message) } finally { setBusy(false) }
  }
  if (!next.length) return <span className="text-[12.5px] text-slate-400">No actions</span>
  const primary = next[0]
  return (
    <div className="relative flex items-center justify-end gap-1.5">
      <button disabled={busy} onClick={() => act(primary)} className={cn('btn btn-sm whitespace-nowrap', primary === 'cancelled' ? 'btn-secondary' : 'btn-primary')}>{busy ? <Spinner /> : null}{primary === 'confirmed' ? 'Confirm' : primary === 'checked_in' ? 'Check in' : primary === 'in_consultation' ? 'Start consult' : primary === 'completed' ? 'Complete' : BOOKING_STATUS[primary].label}</button>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`More actions for ${b.ref}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 ring-1 ring-line hover:bg-mist"><MoreHorizontal size={16} /></button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-10 z-20 w-48 rounded-xl bg-white p-1 shadow-lift ring-1 ring-black/5" onMouseLeave={() => setOpen(false)}>
            {next.slice(1).map((s) => <button key={s} onClick={() => act(s)} className={cn('block w-full rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-canvas', s === 'cancelled' || s === 'no_show' ? 'text-danger-700' : 'text-ink')}>Mark {BOOKING_STATUS[s].label.toLowerCase()}</button>)}
            {['pending', 'confirmed'].includes(b.status) && <button onClick={() => { setOpen(false); onReschedule() }} className="block w-full rounded-lg px-3 py-2 text-left text-[13.5px] text-ink hover:bg-canvas">Reschedule…</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Reschedule({ b, onDone }: { b: BookingView; onDone: () => void }) {
  const { toast } = useToast()
  const [date, setDate] = useState(b.date >= today() ? b.date : today())
  const [busy, setBusy] = useState<string | null>(null)
  const { data: slots = [] } = useLive(() => db.select('hospital_slots').filter((s) => s.hospitalId === b.hospitalId && s.serviceId === b.serviceId && s.date === date && s.id !== b.slotId).sort((a, c) => a.time.localeCompare(c.time)), ['hospital_slots'], [date])
  return (
    <div>
      <p className="text-[14px] text-slate-600">{b.patientName} · {b.serviceName}. Currently {fmtDate(b.date)} at {fmtTime(b.time)}.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">{Array.from({ length: 10 }, (_, i) => addDays(today(), i)).map((d) => <button key={d} onClick={() => setDate(d)} className={cn('chip shrink-0', date === d && 'chip-on')}>{fmtDate(d)}</button>)}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {slots.map((s) => { const past = s.date === today() && s.time <= nowHHMM(); const full = s.booked >= s.capacity; return (
          <button key={s.id} disabled={full || past || !!busy} onClick={async () => { setBusy(s.id); try { await rescheduleBooking(b.hospitalId, b.id, s.id); toast('success', 'Booking rescheduled', `Patient notified: ${fmtDate(s.date)} at ${fmtTime(s.time)}`); onDone() } catch (e) { toast('error', 'Could not reschedule', (e as Error).message) } finally { setBusy(null) } }}
            className="flex flex-col items-center rounded-xl bg-white py-2.5 ring-1 ring-line hover:ring-brand-300 disabled:opacity-40">
            <span className="text-[14px] font-semibold tabular">{busy === s.id ? <Spinner /> : fmtTime(s.time)}</span><span className="text-[11px] text-slate-500">{past ? 'Passed' : full ? 'Full' : `${s.capacity - s.booked} free`}</span>
          </button>) })}
        {slots.length === 0 && <p className="col-span-3 py-6 text-center text-[14px] text-slate-500">No times on this day.</p>}
      </div>
    </div>
  )
}

export default function HospitalBookings() {
  useDocumentTitle('Bookings')
  const { hospitalId } = useMyHospital()
  const { data: all = [] } = useLive(() => hospitalBookings(hospitalId), ['bookings', 'hospital_services', 'hospitals'], [hospitalId])
  const [range, setRange] = useState<Range>('today')
  const [status, setStatus] = useState<BookingStatus | ''>('')
  const [q, setQ] = useState('')
  const [resched, setResched] = useState<BookingView | null>(null)
  const t = today()
  const list = useMemo(() => all.filter((b) => {
    if (range === 'today' && b.date !== t) return false
    if (range === 'tomorrow' && b.date !== addDays(t, 1)) return false
    if (range === 'upcoming' && b.date < t) return false
    if (range === 'past' && b.date >= t) return false
    if (status && b.status !== status) return false
    if (q && !(b.patientName + ' ' + b.ref + ' ' + b.serviceName).toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).sort((a, b) => (range === 'past' ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time))), [all, range, status, q, t])
  const pending = all.filter((b) => b.status === 'pending').length

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[28px] font-semibold">Booking queue</h1><p className="mt-1 text-[14px] text-slate-600">Status changes notify the patient straight away.{pending > 0 && <> <strong className="text-amber-700">{pending} pending</strong> need confirmation.</>}</p></div></div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-line scrollbar-none">{RANGES.map((r) => <button key={r.k} onClick={() => setRange(r.k)} aria-pressed={range === r.k} className={cn('whitespace-nowrap rounded-lg px-3.5 py-2 text-[13.5px] font-semibold', range === r.k ? 'bg-ink text-white' : 'text-slate-600 hover:text-ink')}>{r.l}</button>)}</div>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | '')} className="input h-11 min-h-0 w-full lg:w-48"><option value="">All statuses</option>{Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <label className="relative flex-1"><span className="sr-only">Search bookings</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, booking ID or service" className="input h-11 pl-10" /></label>
      </div>

      {list.length === 0 ? <EmptyState icon={<ClipboardList size={22} />} title="No bookings here" body="Try another date range or status." /> : (
        <>
          <div className="hidden overflow-visible rounded-2xl bg-white ring-1 ring-line md:block">
            <table className="w-full text-left text-[14px]">
              <thead className="border-b border-line text-[12px] text-slate-500"><tr><th className="px-5 py-3 font-medium">Patient</th><th className="px-3 py-3 font-medium">Booking ID</th><th className="px-3 py-3 font-medium">Service</th><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Time</th><th className="px-3 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead>
              <tbody className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {list.map((b) => (
                    <motion.tr key={b.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-canvas/60">
                      <td className="px-5 py-3"><p className="font-semibold text-ink">{b.patientName}{b.channel && b.channel !== 'web' && <span className="ml-1.5 rounded-full bg-lime-200 px-2 py-0.5 align-middle text-[11px] font-bold text-ink">by {b.channel.toUpperCase()}</span>}</p>{b.reason && <p className="max-w-[220px] truncate text-[12px] text-slate-500" title={b.reason}>{b.reason}</p>}</td>
                      <td className="px-3 py-3 font-mono text-[13px] text-slate-700">{b.ref}</td>
                      <td className="px-3 py-3 text-slate-700">{b.serviceName}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-700">{b.date === t ? 'Today' : fmtDate(b.date)}</td>
                      <td className="px-3 py-3 font-semibold text-ink tabular">{fmtTime(b.time)}</td>
                      <td className="px-3 py-3"><BookingStatusPill status={b.status} size="sm" /></td>
                      <td className="px-5 py-3"><Actions b={b} onReschedule={() => setResched(b)} /></td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {list.map((b) => (
              <li key={b.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-ink">{b.patientName}{b.channel && b.channel !== 'web' && <span className="ml-1.5 rounded-full bg-lime-200 px-2 py-0.5 align-middle text-[11px] font-bold text-ink">by {b.channel.toUpperCase()}</span>}</p><p className="text-[12.5px] text-slate-500"><span className="font-mono">{b.ref}</span> · {b.serviceName}</p></div><BookingStatusPill status={b.status} size="sm" /></div>
                <div className="mt-3 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink"><CalendarClock size={15} className="text-slate-400" />{b.date === t ? 'Today' : fmtDate(b.date)}, {fmtTime(b.time)}</p><Actions b={b} onReschedule={() => setResched(b)} /></div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Modal open={!!resched} onClose={() => setResched(null)} title="Reschedule booking" size="md">{resched && <Reschedule b={resched} onDone={() => setResched(null)} />}</Modal>
    </div>
  )
}
