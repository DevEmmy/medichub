import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, Phone, Stethoscope, UserRound } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useAuth } from '../../contexts/AuthContext'
import { myDoctorSchedule, type BookingView } from '../../services/bookings'
import { markRead, myNotifications } from '../../services/notifications'
import { EmptyState } from '../../components/ui/States'
import { fmtDateLong, fmtTime, relTime, today } from '../../utils/date'
import { cn } from '../../utils/cn'

const STATUS: Record<string, [string, string]> = {
  confirmed: ['Confirmed', 'bg-brand-50 text-brand-700'], pending: ['Waiting for the hospital to confirm', 'bg-amber-100 text-amber-800'],
  checked_in: ['Checked in, waiting for you', 'bg-lime-200 text-ink'], in_consultation: ['With you now', 'bg-ink text-lime-300'],
  completed: ['Seen', 'bg-mist text-slate-600'], cancelled: ['Cancelled', 'bg-danger-50 text-danger-700'], no_show: ['Did not come', 'bg-mist text-slate-600'],
}

/** A doctor's own dashboard: every patient booked with them, and the alerts they've been sent. */
export default function DoctorSchedule() {
  useDocumentTitle('My patients')
  const { user } = useAuth()
  const nav = useNavigate()
  const { data } = useLive(myDoctorSchedule, ['bookings', 'hospital_doctors', 'hospitals', 'hospital_services'])
  const { data: notes = [] } = useLive(myNotifications, ['notifications'])
  const t = today()
  const upcoming = (data?.bookings ?? []).filter((b) => b.date >= t && !['cancelled', 'completed', 'no_show'].includes(b.status))
  const past = (data?.bookings ?? []).filter((b) => !upcoming.includes(b)).reverse().slice(0, 20)
  const todays = upcoming.filter((b) => b.date === t)
  const first = user?.name.replace(/^Dr\.?\s*/i, '').split(' ')[0]

  return (
    <div className="container-app max-w-3xl py-8">
      <p className="eyebrow">Doctor</p>
      <h1 className="mt-1 text-[30px] font-semibold">Good day, Dr {first}</h1>
      <p className="mt-1 text-[14.5px] text-slate-600">
        {data?.doctors.length ? `You see patients at ${[...new Set(data.doctors.map((d) => d.hospitalName))].join(', ')}.` : 'Your hospital has not linked you yet.'}
        {' '}{todays.length ? `You have ${todays.length} patient${todays.length === 1 ? '' : 's'} today.` : 'No patients booked for today yet.'}
      </p>

      {notes.some((n) => !n.read) && (
        <section className="mt-6 rounded-2xl bg-ink p-4 text-white" aria-labelledby="new-h">
          <h2 id="new-h" className="flex items-center gap-2 text-[15px] font-bold"><Bell size={16} className="text-lime-300" /> New for you</h2>
          <ul className="mt-2 space-y-2">
            {notes.filter((n) => !n.read).slice(0, 5).map((n) => (
              <li key={n.id}><button onClick={() => { markRead(n.id); if (n.link && n.link !== '/doctor') nav(n.link) }} className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-left hover:bg-white/15">
                <span className="block text-[14px] font-semibold">{n.title}</span><span className="block text-[13.5px] text-white/80">{n.body}</span><span className="block text-[12px] text-white/50">{relTime(n.createdAt)}</span>
              </button></li>
            ))}
          </ul>
          <button onClick={() => markRead()} className="mt-2 text-[13px] font-semibold text-lime-300 underline">Mark all as read</button>
        </section>
      )}

      <section className="mt-8" aria-labelledby="up-h">
        <h2 id="up-h" className="flex items-center gap-2 text-[20px] font-semibold"><CalendarClock size={19} /> Upcoming patients</h2>
        {upcoming.length === 0
          ? <EmptyState className="mt-3" icon={<Stethoscope size={22} />} title="No upcoming patients" body="When a patient books with you, they appear here and we email you." />
          : <ul className="mt-3 space-y-3" data-testid="doctor-upcoming">{upcoming.map((b) => <Row key={b.id} b={b} />)}</ul>}
      </section>

      {past.length > 0 && (
        <section className="mt-8" aria-labelledby="past-h">
          <h2 id="past-h" className="text-[18px] font-semibold text-slate-700">Earlier</h2>
          <ul className="mt-3 space-y-2">{past.map((b) => <Row key={b.id} b={b} muted />)}</ul>
        </section>
      )}
    </div>
  )
}

function Row({ b, muted }: { b: BookingView; muted?: boolean }) {
  const [label, tone] = STATUS[b.status] ?? [b.status, 'bg-mist text-slate-600']
  return (
    <li className={cn('rounded-2xl bg-white p-4 ring-1 ring-line', muted && 'opacity-75')}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><UserRound size={19} /></span>
        <div className="min-w-0 flex-1">
          <span className={cn('mb-1 inline-block rounded-full px-2.5 py-1 text-[12px] font-bold', tone)}>{label}</span>
          <p className="text-[16px] font-semibold text-ink">{b.patientName}</p>
          <p className="text-[13.5px] text-slate-600">{fmtDateLong(b.date)} at <strong>{fmtTime(b.time)}</strong> · {b.serviceName}</p>
          <p className="text-[12.5px] text-slate-500">{b.hospitalName} · Ref {b.ref} · {b.paymentStatus === 'paid' ? `Paid ₦${(b.amount ?? 0).toLocaleString('en-NG')}` : b.amount ? 'Pays at the hospital' : 'No fee'}</p>
          {b.reason && <p className="mt-1.5 rounded-xl bg-canvas px-3 py-2 text-[13.5px] text-slate-700">Reason: {b.reason}</p>}
        </div>
        {b.patientPhone && !muted && <a href={`tel:${b.patientPhone.replace(/\s/g, '')}`} className="btn btn-secondary btn-sm shrink-0" aria-label={`Call ${b.patientName}`}><Phone size={14} /> Call</a>}
      </div>
    </li>
  )
}
