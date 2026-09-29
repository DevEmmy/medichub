import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronRight, QrCode } from 'lucide-react'
import { useLive, useFirstLoad } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { myBookings, isUpcoming, type BookingView } from '../../services/bookings'
import { BookingStatusPill } from '../../components/ui/StatusPill'
import { EmptyState, Skeleton } from '../../components/ui/States'
import { parseDate, fmtTime } from '../../utils/date'
import { cn } from '../../utils/cn'

function Row({ b }: { b: BookingView }) {
  const d = parseDate(b.date)
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Link to={`/app/bookings/${b.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-canvas py-2 ring-1 ring-line">
          <span className="text-[11px] font-semibold uppercase text-slate-500">{d.toLocaleDateString('en-NG', { month: 'short' })}</span>
          <span className="font-display text-[22px] font-semibold leading-none text-ink tabular">{d.getDate()}</span>
          <span className="mt-0.5 text-[10.5px] text-slate-500">{d.toLocaleDateString('en-NG', { weekday: 'short' })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><BookingStatusPill status={b.status} size="sm" /><span className="font-mono text-[11.5px] tracking-wider text-slate-500">{b.ref}</span></div>
          <p className="mt-1 truncate text-[15.5px] font-semibold text-ink">{b.serviceName}</p>
          <p className="truncate text-[13px] text-slate-500">{b.hospitalName} · {fmtTime(b.time)}</p>
        </div>
        {isUpcoming(b) ? <span className="hidden items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-[12.5px] font-semibold text-brand-800 sm:inline-flex"><QrCode size={14} /> Pass</span> : null}
        <ChevronRight size={18} className="text-slate-400" />
      </Link>
    </motion.li>
  )
}

export default function Bookings() {
  useDocumentTitle('My bookings')
  const ready = useFirstLoad(300)
  const { data = [] } = useLive(myBookings, ['bookings', 'hospitals', 'hospital_services'])
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming')
  const groups = {
    upcoming: data.filter(isUpcoming),
    past: data.filter((b) => !isUpcoming(b) && b.status !== 'cancelled').reverse(),
    cancelled: data.filter((b) => b.status === 'cancelled').reverse(),
  }
  const list = groups[tab]
  return (
    <div className="container-app max-w-3xl py-8">
      <div className="flex items-end justify-between gap-3"><h1 className="text-[32px] font-semibold">My bookings</h1><Link to="/find?appt=1" className="btn btn-primary btn-sm">New booking</Link></div>
      <div className="mt-5 flex gap-1 rounded-2xl bg-white p-1 shadow-soft ring-1 ring-black/5" role="tablist">
        {(['upcoming', 'past', 'cancelled'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('relative flex-1 rounded-xl px-3 py-2.5 text-[14px] font-semibold capitalize', tab === t ? 'text-white' : 'text-slate-600')}>
            {tab === t && <motion.span layoutId="btab" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative">{t} <span className="tabular opacity-60">{groups[t].length}</span></span>
          </button>
        ))}
      </div>
      <div className="mt-5">
        {!ready ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div> : list.length === 0 ? (
          <EmptyState icon={<CalendarDays size={22} />} title={tab === 'upcoming' ? 'No upcoming bookings' : tab === 'past' ? 'No past visits yet' : 'No cancelled bookings'} body={tab === 'upcoming' ? 'Find a hospital and reserve a time that suits you.' : undefined} action={tab === 'upcoming' ? <Link to="/find?appt=1" className="btn btn-primary btn-sm">Find a slot</Link> : undefined} />
        ) : <ul className="space-y-3"><AnimatePresence>{list.map((b) => <Row key={b.id} b={b} />)}</AnimatePresence></ul>}
      </div>
    </div>
  )
}
