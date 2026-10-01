import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Download, Lock } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLive } from '../../hooks/useLive'
import { hospitalBookings } from '../../services/bookings'
import { reviewsFor } from '../../services/reviews'
import { isPremium } from '../../services/plans'
import { addDays, parseDate, today } from '../../utils/date'
import { Stars } from '../../components/ui/Stars'
import { cn } from '../../utils/cn'

const ATTENDED = new Set(['completed', 'checked_in', 'in_consultation'])

export function PremiumLock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none opacity-60 blur-[3px]">{children}</div>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="max-w-sm rounded-3xl bg-white p-6 text-center shadow-lift ring-1 ring-line">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Lock size={22} /></span>
          <h2 className="mt-3 text-[18px] font-semibold">{title} is a Premium feature</h2>
          <p className="mt-1 text-[13.5px] text-slate-600">Your core features stay free. Try Premium free for 30 days.</p>
          <Link to="/hospital/plan" className="btn mt-4 w-full bg-amber-400 text-ink hover:bg-amber-300"><Crown size={16} /> See Premium</Link>
        </div>
      </div>
    </div>
  )
}

function Body({ hospitalId }: { hospitalId: string }) {
  const { data: all = [] } = useLive(() => hospitalBookings(hospitalId), ['bookings', 'hospital_services'], [hospitalId])
  const { data: reviews = [] } = useLive(() => reviewsFor(hospitalId), ['hospital_reviews'], [hospitalId])
  const t = today(), from = addDays(t, -29)
  const win = all.filter((b) => b.date >= from && b.date <= t)
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(from, i)).map((d) => ({ d, n: win.filter((b) => b.date === d && b.status !== 'cancelled').length })), [win, from])
  const max = Math.max(1, ...days.map((x) => x.n))
  const past = win.filter((b) => b.date < t || ATTENDED.has(b.status) || b.status === 'no_show')
  const attended = past.filter((b) => ATTENDED.has(b.status)).length
  const noShow = past.filter((b) => b.status === 'no_show').length
  const cancelled = win.filter((b) => b.status === 'cancelled').length
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
  const hours = useMemo(() => { const m = new Map<string, number>(); win.forEach((b) => { if (b.status !== 'cancelled') { const hr = b.time.slice(0, 2); m.set(hr, (m.get(hr) ?? 0) + 1) } }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])) }, [win])
  const hMax = Math.max(1, ...hours.map((x) => x[1]))
  const services = useMemo(() => { const m = new Map<string, number>(); win.forEach((b) => { if (b.status !== 'cancelled') m.set(b.serviceName, (m.get(b.serviceName) ?? 0) + 1) }); return [...m.entries()].sort((a, b) => b[1] - a[1]) }, [win])
  const sMax = Math.max(1, ...services.map((x) => x[1]))
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0
  const tagCounts = useMemo(() => { const m = new Map<string, number>(); reviews.forEach((r) => r.tags.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) }, [reviews])

  const exportCsv = () => {
    const rows = [['Ref', 'Date', 'Time', 'Service', 'Patient', 'Phone', 'Status'], ...win.map((b) => [b.ref, b.date, b.time, b.serviceName, b.patientName, b.patientPhone ?? '', b.status])]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `bookings-${from}-to-${t}.csv`; a.click()
  }

  const kpis = [
    { k: 'Bookings (30 days)', v: win.filter((b) => b.status !== 'cancelled').length },
    { k: 'Attendance rate', v: pct(attended, past.length) + '%' },
    { k: 'No-show rate', v: pct(noShow, past.length) + '%', bad: pct(noShow, past.length) > 15 },
    { k: 'Cancellations', v: cancelled },
  ]
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((x) => <div key={x.k} className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-[12.5px] font-medium text-slate-500">{x.k}</p><p className={cn('mt-1 font-display text-[28px] font-semibold tabular', x.bad && 'text-danger-600')}>{x.v}</p></div>)}
      </section>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold">Bookings per day</h2><button onClick={exportCsv} className="btn btn-secondary btn-sm"><Download size={15} /> Export CSV</button></div>
        <div className="mt-4 flex h-40 items-end gap-[3px]">
          {days.map((x) => <div key={x.d} className="group relative flex-1"><div className={cn('w-full rounded-t', x.d === t ? 'bg-brand-600' : 'bg-brand-300')} style={{ height: `${(x.n / max) * 150}px`, minHeight: x.n ? 3 : 1 }} /><span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[11px] text-white group-hover:block">{parseDate(x.d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}: {x.n}</span></div>)}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{parseDate(from).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span><span>Today</span></div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line"><h2 className="text-[16px] font-semibold">Busiest hours</h2><p className="text-[12.5px] text-slate-500">Plan staff rosters around demand.</p>
          <ul className="mt-3 space-y-1.5">{hours.map(([hr, n]) => <li key={hr} className="flex items-center gap-2 text-[13px]"><span className="w-12 tabular text-slate-600">{hr}:00</span><div className="h-3 flex-1 rounded bg-mist"><div className="h-full rounded bg-sky-500" style={{ width: `${(n / hMax) * 100}%` }} /></div><span className="w-6 text-right tabular">{n}</span></li>)}</ul>
        </section>
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line"><h2 className="text-[16px] font-semibold">Demand by service</h2><p className="text-[12.5px] text-slate-500">Open more slots where demand is highest.</p>
          <ul className="mt-3 space-y-1.5">{services.map(([s, n]) => <li key={s} className="text-[13px]"><div className="flex justify-between"><span className="truncate">{s}</span><span className="tabular">{n}</span></div><div className="mt-0.5 h-2 rounded bg-mist"><div className="h-full rounded bg-brand-500" style={{ width: `${(n / sMax) * 100}%` }} /></div></li>)}</ul>
        </section>
      </div>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line"><h2 className="text-[16px] font-semibold">Patient experience</h2>
        <div className="mt-3 flex flex-wrap items-center gap-6">
          <div><p className="font-display text-[32px] font-semibold tabular">{reviews.length ? avg.toFixed(1) : '—'}</p>{reviews.length > 0 && <Stars value={avg} />}<p className="text-[12px] text-slate-500">{reviews.length} ratings</p></div>
          <div className="flex flex-wrap gap-1.5">{tagCounts.map(([tag, n]) => <span key={tag} className="rounded-full bg-canvas px-3 py-1 text-[12.5px] ring-1 ring-line">{tag} · <strong>{n}</strong></span>)}</div>
        </div>
      </section>
    </div>
  )
}

export default function Analytics() {
  useDocumentTitle('Analytics')
  const { h, hospitalId } = useMyHospital()
  if (!h || !hospitalId) return null
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="flex items-center gap-2 text-[28px] font-semibold">Analytics <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-700">Premium</span></h1><p className="mt-1 text-[14px] text-slate-600">Last 30 days of bookings, attendance and patient feedback.</p></div>
      {isPremium(h) ? <Body hospitalId={hospitalId} /> : <PremiumLock title="Analytics"><Body hospitalId={hospitalId} /></PremiumLock>}
    </div>
  )
}
