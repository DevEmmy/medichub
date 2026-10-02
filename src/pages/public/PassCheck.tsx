import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BadgeCheck, CircleCheck, CircleX, CreditCard, MapPin, ScanLine } from 'lucide-react'
import { verifyPass, setBookingStatus, type PassCheck as Check } from '../../services/bookings'
import { BookingStatusPill } from '../../components/ui/StatusPill'
import { Spinner } from '../../components/ui/States'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../contexts/ToastContext'
import { fmtDateLong, fmtTime, relTime } from '../../utils/date'
import { naira } from '../../services/payments'

/** What anyone sees after scanning a booking QR with their phone camera. */
export default function PassCheck() {
  useDocumentTitle('Booking pass')
  const { ref = '' } = useParams()
  const [sp] = useSearchParams()
  const { toast } = useToast()
  const [r, setR] = useState<Check | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => verifyPass(`/pass/${ref}?t=${sp.get('t') ?? ''}`).then(setR).catch((e) => setR({ valid: false, message: (e as Error).message }))
  useEffect(() => { void load() }, [ref, sp]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return <div className="grid min-h-[50vh] place-items-center"><Spinner /></div>
  if (!r.valid) return (
    <div className="mx-auto max-w-md py-10 text-center">
      <CircleX size={48} className="mx-auto text-danger-600" />
      <h1 className="mt-3 text-[24px] font-semibold">Pass not valid</h1>
      <p className="mt-2 text-[14px] text-slate-600">{r.message}</p>
    </div>
  )
  const pay = r.paymentStatus === 'paid' ? `Paid ${naira(r.amount ?? 0)}` : r.paymentStatus === 'refunded' ? `Refunded ${naira(r.amount ?? 0)}` : r.status === 'awaiting_payment' ? `Awaiting payment of ${naira(r.amount ?? 0)}` : r.amount ? `Pay ${naira(r.amount)} at the hospital` : 'No fee recorded'
  const rows: [string, string | undefined][] = [
    ['Booking ID', r.ref], ['Patient', r.patientName], ['Phone', r.patientPhone], ['Hospital', r.hospitalName], ['Service', r.serviceName], ['Department', r.departmentName],
    ['Date', r.date ? fmtDateLong(r.date) : undefined], ['Time', r.time ? fmtTime(r.time) : undefined], ['Payment', pay], ['Reason for visit', r.reason], ['Booked', r.bookedAt ? relTime(r.bookedAt) : undefined],
  ]
  const canCheckIn = r.viewer === 'staff' && (r.status === 'confirmed' || r.status === 'pending' || r.status === 'no_show')
  return (
    <div className="mx-auto max-w-lg py-4" data-testid="pass-check">
      <div className="flex items-center gap-3 rounded-3xl bg-brand-600 p-5 text-white">
        <BadgeCheck size={40} className="shrink-0" />
        <div><p className="font-display text-[22px] font-semibold leading-tight">Genuine Medic Hub pass</p><p className="text-[13.5px] text-white/80">Verified just now · {r.ref}</p></div>
      </div>
      <section className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line p-4"><p className="text-[15px] font-semibold">Booking details</p>{r.status && <BookingStatusPill status={r.status} />}</div>
        <dl className="divide-y divide-line px-4">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-3 text-[14px]"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>)}
        </dl>
        {r.hospitalAddress && <p className="flex items-center gap-1.5 border-t border-line p-4 text-[13px] text-slate-600"><MapPin size={14} /> {r.hospitalAddress}</p>}
      </section>
      {r.status === 'awaiting_payment' && <p className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-[13.5px] font-medium text-amber-800 ring-1 ring-amber-100"><CreditCard size={16} /> Payment has not been received yet.</p>}
      <div className="mt-4 grid gap-2">
        {canCheckIn && r.bookingId && r.hospitalId && <button disabled={busy} onClick={async () => { setBusy(true); try { await setBookingStatus(r.hospitalId!, r.bookingId!, 'checked_in'); toast('success', 'Patient checked in', r.ref); await load() } catch (e) { toast('error', 'Check-in failed', (e as Error).message) } finally { setBusy(false) } }} className="btn btn-brand h-14 text-[16px]" data-testid="pass-checkin">{busy ? <Spinner /> : <CircleCheck size={19} />} Check in this patient</button>}
        {r.viewer === 'staff' && <Link to="/hospital/check-in" className="btn btn-secondary"><ScanLine size={16} /> Scan another pass</Link>}
        {r.viewer === 'owner' && r.bookingId && <Link to={`/app/bookings/${r.bookingId}`} className="btn btn-primary">Open my pass</Link>}
        {r.viewer === 'public' && <p className="text-center text-[12.5px] text-slate-500">Hospital staff: sign in to see the full details and check this patient in.</p>}
      </div>
    </div>
  )
}
