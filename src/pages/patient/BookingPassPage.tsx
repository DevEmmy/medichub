import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarX, CircleDot, Ticket } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { bookingEvents, cancelMyBooking, myBooking } from '../../services/bookings'
import { BookingPass } from '../../components/bookings/BookingPass'
import { EmptyState, Spinner } from '../../components/ui/States'
import { BOOKING_STATUS } from '../../components/ui/StatusPill'
import { useToast } from '../../contexts/ToastContext'
import { relTime } from '../../utils/date'

export default function BookingPassPage() {
  const { id = '' } = useParams()
  const { data: b } = useLive(() => myBooking(id), ['bookings', 'hospitals', 'hospital_services'], [id])
  const { data: events = [] } = useLive(() => bookingEvents(b?.id ?? id), ['booking_events'], [id, b?.id])
  useDocumentTitle(b ? `Pass ${b.ref}` : 'Booking')
  const { toast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!b) return <div className="container-app py-10"><EmptyState icon={<Ticket size={22} />} title="Booking not found" body="It may belong to another account." action={<Link to="/app/bookings" className="btn btn-primary btn-sm">My bookings</Link>} /></div>
  const cancellable = b.status === 'pending' || b.status === 'confirmed'
  const cancel = async () => {
    setBusy(true)
    try { await cancelMyBooking(b.id); toast('success', 'Booking cancelled', `${b.ref} was cancelled and the slot released.`); setConfirming(false) } catch (e) { toast('error', 'Booking could not be cancelled', (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="container-app max-w-3xl py-6">
      <Link to="/app/bookings" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-slate-600 hover:text-ink"><ArrowLeft size={16} /> My bookings</Link>
      <div className="mt-5 grid gap-8 md:grid-cols-[400px_minmax(0,1fr)]">
        <BookingPass b={b} compactActions />
        <div className="space-y-6">
          {b.reason && <div className="card p-5"><p className="text-[12.5px] font-medium text-slate-500">Reason for visit</p><p className="mt-1 text-[14.5px] text-ink">{b.reason}</p></div>}
          <section className="card p-5" aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-[16px] font-semibold">Booking history</h2>
            <ol className="mt-4 space-y-4 border-l-2 border-line pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative"><CircleDot size={14} className="absolute -left-[27px] top-0.5 bg-white text-brand-600" />
                  <p className="text-[14px] font-semibold text-ink">{BOOKING_STATUS[e.status].label}</p>
                  <p className="text-[12.5px] text-slate-500">{e.by === 'hospital' ? 'By the hospital' : e.by === 'patient' ? 'By you' : 'Automatically'} · {relTime(e.at)}</p>
                  {e.note && <p className="mt-0.5 text-[13px] text-slate-600">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
          {cancellable && (
            <section className="card p-5">
              {!confirming ? (
                <button onClick={() => setConfirming(true)} className="btn btn-ghost w-full text-danger-700 hover:bg-danger-50"><CalendarX size={17} /> Cancel booking</button>
              ) : (
                <div role="alertdialog" aria-labelledby="cx-h">
                  <p id="cx-h" className="text-[15px] font-semibold">Cancel this booking?</p>
                  <p className="mt-1 text-[13.5px] text-slate-600">Your place will be released for someone else.</p>
                  <div className="mt-4 flex gap-2"><button onClick={() => setConfirming(false)} className="btn btn-secondary flex-1">Keep it</button><button onClick={cancel} disabled={busy} className="btn btn-danger flex-1">{busy && <Spinner />} Yes, cancel</button></div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
