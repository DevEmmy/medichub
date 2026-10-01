import { FreshnessPanel } from '../../components/hospital-admin/FreshnessPanel'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarCheck, CircleCheck, Clock, ClipboardList, Megaphone, ScanLine, ShieldAlert, UserCheck, XCircle, ExternalLink } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { hospitalBookings, setBookingStatus, NEXT_STATUSES, type BookingView } from '../../services/bookings'
import { StatusControls } from '../../components/hospital-admin/StatusControls'
import { BookingStatusPill, BOOKING_STATUS } from '../../components/ui/StatusPill'
import { useToast } from '../../contexts/ToastContext'
import { addDays, fmtDateLong, fmtTime, parseDate, today } from '../../utils/date'
import type { BookingStatus } from '../../types'
import { cn } from '../../utils/cn'
import { VERIFICATION_META } from '../../components/hospital-admin/VerificationPill'

const ACTION_LABEL: Partial<Record<BookingStatus, string>> = { confirmed: 'Confirm', checked_in: 'Check in', in_consultation: 'Start', completed: 'Complete' }

export function QuickAction({ b }: { b: BookingView }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const next = NEXT_STATUSES[b.status].find((s) => ACTION_LABEL[s])
  if (!next) return null
  return (
    <button disabled={busy} onClick={async () => { setBusy(true); try { await setBookingStatus(b.hospitalId, b.id, next); toast('success', `${BOOKING_STATUS[next].label}`, `${b.patientName} · ${b.ref}`) } catch (e) { toast('error', 'Update failed', (e as Error).message) } finally { setBusy(false) } }}
      className="btn btn-secondary btn-sm whitespace-nowrap">{ACTION_LABEL[next]}</button>
  )
}

function BarChart({ data }: { data: { label: string; value: number; date: string }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(4, ...data.map((d) => d.value))
  const nice = Math.ceil(max / 4) * 4
  const W = 560, H = 200, L = 28, B = 26, T = 12
  const bw = (W - L) / data.length
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bookings per day for the last 7 days">
        {[0, 0.5, 1].map((f) => { const y = T + (H - B - T) * (1 - f); return <g key={f}><line x1={L} x2={W} y1={y} y2={y} stroke="#0A1F1A" strokeOpacity={f === 0 ? 0.18 : 0.06} /><text x={L - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#6B7A76">{Math.round(nice * f)}</text></g> })}
        {data.map((d, i) => {
          const h = ((H - B - T) * d.value) / nice, x = L + i * bw + bw * 0.22, w = bw * 0.56, y = H - B - h
          const isToday = i === data.length - 1
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + i * bw} y={T} width={bw} height={H - B - T} fill="transparent" />
              {d.value > 0 && <path d={`M${x},${H - B} V${y + 4} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${H - B} z`} fill={isToday ? '#137352' : '#72C4A3'} opacity={hover === null || hover === i ? 1 : 0.55} />}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={isToday ? '#0A1F1A' : '#6B7A76'} fontWeight={isToday ? 600 : 400}>{d.label}</text>
              {isToday && d.value > 0 && <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0A1F1A">{d.value}</text>}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-lift" style={{ left: `${((L + hover * bw + bw / 2) / W) * 100}%`, top: 0 }}>
          <strong className="tabular">{data[hover].value}</strong> bookings · {data[hover].label}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  useDocumentTitle('Overview')
  const { h, hospitalId } = useMyHospital()
  const { data: all = [] } = useLive(() => hospitalBookings(hospitalId), ['bookings', 'hospital_services', 'hospitals'], [hospitalId])
  const t = today()
  const todays = all.filter((b) => b.date === t).sort((a, b) => a.time.localeCompare(b.time))
  const count = (s: BookingStatus[]) => todays.filter((b) => s.includes(b.status)).length
  const kpis = [
    { label: 'Total bookings', value: todays.length, icon: ClipboardList, tone: 'text-ink' },
    { label: 'Confirmed', value: count(['confirmed']), icon: CalendarCheck, tone: 'text-brand-700' },
    { label: 'Pending', value: count(['pending']), icon: Clock, tone: 'text-amber-700' },
    { label: 'Checked in', value: count(['checked_in', 'in_consultation']), icon: UserCheck, tone: 'text-sky-700' },
    { label: 'Completed', value: count(['completed']), icon: CircleCheck, tone: 'text-slate-700' },
    { label: 'Cancelled', value: count(['cancelled', 'no_show']), icon: XCircle, tone: 'text-danger-600' },
  ]
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)).map((d) => ({ date: d, label: d === t ? 'Today' : parseDate(d).toLocaleDateString('en-NG', { weekday: 'short' }), value: all.filter((b) => b.date === d && b.status !== 'cancelled').length })), [all, t])
  const last7 = all.filter((b) => b.date >= addDays(t, -6) && b.date <= t)
  const attended = last7.filter((b) => ['completed', 'checked_in', 'in_consultation'].includes(b.status)).length
  const noShow = last7.filter((b) => b.status === 'no_show').length
  const byService = useMemo(() => {
    const m = new Map<string, number>(); last7.forEach((b) => { if (b.status !== 'cancelled') m.set(b.serviceName, (m.get(b.serviceName) ?? 0) + 1) })
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [last7])
  const upcoming = todays.filter((b) => !['completed', 'cancelled', 'no_show'].includes(b.status)).slice(0, 6)
  if (!h) return null
  const pct = (n: number) => (last7.length ? Math.round((n / last7.length) * 100) : 0)

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {h.verification !== 'verified' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100 sm:flex-row sm:items-center">
          <ShieldAlert size={20} className="text-amber-700" />
          <p className="flex-1 text-[14px] text-amber-900"><strong>Verification: {VERIFICATION_META[h.verification].label}.</strong> Your facility is hidden from patients until Medic Hub verifies it. You can set up services, slots and status now.</p>
          <Link to="/hospital/verification" className="btn btn-sm bg-white text-ink ring-1 ring-amber-100">View status</Link>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[13px] font-medium text-slate-500">{fmtDateLong(t)}</p><h1 className="text-[28px] font-semibold">Today</h1></div>
        <div className="flex gap-2"><Link to="/hospital/check-in" className="btn btn-primary btn-sm"><ScanLine size={15} /> Check in</Link><a href={`#/hospitals/${h.id}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm"><ExternalLink size={15} /> Patient view</a></div>
      </div>

      <FreshnessPanel h={h} />

      <section aria-label="Today's bookings" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500"><k.icon size={14} className={k.tone} />{k.label}</p>
            <motion.p key={k.value} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 font-display text-[30px] font-semibold leading-none text-ink tabular">{k.value}</motion.p>
          </motion.div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line" aria-labelledby="ls-h">
          <div className="flex items-center justify-between"><h2 id="ls-h" className="flex items-center gap-2 text-[17px] font-semibold"><span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulseRing rounded-full bg-brand-500" /><span className="relative h-2 w-2 rounded-full bg-brand-500" /></span> Live status</h2><Link to="/hospital/status" className="text-[13px] font-semibold text-brand-700">All controls</Link></div>
          <p className="mt-1 text-[13px] text-slate-500">Changes are visible to patients immediately.</p>
          <div className="mt-2"><StatusControls h={h} /></div>
        </section>

        <section className="flex flex-col rounded-2xl bg-white ring-1 ring-line" aria-labelledby="q-h">
          <div className="flex items-center justify-between p-5 pb-3"><h2 id="q-h" className="text-[17px] font-semibold">Up next today</h2><Link to="/hospital/bookings" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700">Booking queue <ArrowRight size={14} /></Link></div>
          {upcoming.length === 0 ? <p className="px-5 pb-6 text-[14px] text-slate-500">No more patients expected today.</p> : (
            <ul className="divide-y divide-line">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-[68px] shrink-0 whitespace-nowrap text-[13px] font-semibold text-ink tabular">{fmtTime(b.time)}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-ink">{b.patientName}</p><p className="truncate text-[12.5px] text-slate-500">{b.serviceName} · <span className="font-mono">{b.ref}</span></p></div>
                  <span className="hidden sm:block"><BookingStatusPill status={b.status} size="sm" /></span>
                  <QuickAction b={b} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line lg:col-span-2" aria-labelledby="an-h">
          <div className="flex items-baseline justify-between"><h2 id="an-h" className="text-[17px] font-semibold">Bookings, last 7 days</h2><p className="text-[13px] text-slate-500 tabular">{last7.filter((b) => b.status !== 'cancelled').length} total</p></div>
          <div className="mt-4"><BarChart data={week} /></div>
          <details className="mt-2 text-[12.5px] text-slate-500"><summary className="cursor-pointer">Show as table</summary>
            <table className="mt-2 w-full text-left"><thead><tr><th className="py-1 font-medium">Day</th><th className="py-1 text-right font-medium">Bookings</th></tr></thead><tbody>{week.map((w) => <tr key={w.date}><td className="py-0.5">{w.label}</td><td className="py-0.5 text-right tabular">{w.value}</td></tr>)}</tbody></table>
          </details>
        </section>
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line" aria-labelledby="perf-h">
          <h2 id="perf-h" className="text-[17px] font-semibold">Attendance</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-canvas p-3"><p className="text-[12px] text-slate-500">Attended</p><p className="font-display text-[26px] font-semibold text-ink tabular">{pct(attended)}%</p></div>
            <div className="rounded-xl bg-canvas p-3"><p className="text-[12px] text-slate-500">No-show</p><p className="font-display text-[26px] font-semibold text-ink tabular">{pct(noShow)}%</p></div>
          </div>
          <h3 className="mt-5 text-[13px] font-semibold text-slate-700">Top services</h3>
          <ul className="mt-2 space-y-2.5">
            {byService.map(([name, n]) => (
              <li key={name}><div className="flex justify-between text-[13px]"><span className="truncate text-slate-700">{name}</span><span className="font-semibold text-ink tabular">{n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-mist"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(n / (byService[0]?.[1] || 1)) * 100}%` }} /></div></li>
            ))}
            {byService.length === 0 && <li className="text-[13px] text-slate-500">No bookings yet.</li>}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-white sm:flex-row sm:items-center">
        <Megaphone size={20} className="text-brand-300" />
        <div className="flex-1"><p className="text-[15px] font-semibold">{h.announcements.length ? `${h.announcements.length} active announcement${h.announcements.length > 1 ? 's' : ''}` : 'No active announcements'}</p><p className="text-[13px] text-white/60">{h.announcements[0]?.title ?? 'Tell patients about delays, closures or extra slots.'}</p></div>
        <Link to="/hospital/announcements" className={cn('btn btn-sm bg-white text-ink')}>Publish update</Link>
      </section>
    </div>
  )
}
