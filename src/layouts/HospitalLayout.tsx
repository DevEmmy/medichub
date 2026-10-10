import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, CalendarRange, ClipboardList, ScanLine, Building2, Megaphone, ShieldCheck, LayoutDashboard, Menu, X, ExternalLink, Settings, Star, Crown, BarChart3, Workflow, QrCode, Banknote, UsersRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLive } from '../hooks/useLive'
import { db } from '../lib/store'
import { LogoMark } from '../components/ui/Logo'
import { HospitalAvatar } from '../components/ui/HospitalAvatar'
import { NotificationBell } from '../components/navigation/NotificationBell'
import { UserMenu } from '../components/navigation/UserMenu'
import { VerificationPill } from '../components/hospital-admin/VerificationPill'
import { OfflineBanner } from '../components/navigation/OfflineBanner'
import { useNotificationToasts } from '../hooks/useNotificationToasts'
import { cn } from '../utils/cn'
import { A11yButton } from '../contexts/A11yContext'

const NAV = [
  { to: '/hospital', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/hospital/status', label: 'Live status & capacity', icon: Activity },
  { to: '/hospital/slots', label: 'Appointment slots', icon: CalendarRange },
  { to: '/hospital/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/hospital/team', label: 'Team & email alerts', icon: UsersRound },
  { to: '/hospital/check-in', label: 'Check-in', icon: ScanLine },
  { to: '/hospital/profile', label: 'Hospital profile', icon: Building2 },
  { to: '/hospital/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/hospital/payments', label: 'Payments', icon: Banknote },
  { to: '/hospital/reviews', label: 'Ratings', icon: Star },
  { to: '/hospital/qr', label: 'Entrance QR poster', icon: QrCode },
  { to: '/hospital/verification', label: 'Verification', icon: ShieldCheck },
  { to: '/hospital/analytics', label: 'Analytics', icon: BarChart3, pro: true },
  { to: '/hospital/automations', label: 'Automations', icon: Workflow, pro: true },
  { to: '/hospital/plan', label: 'Plan', icon: Crown },
]

export function HospitalLayout() {
  const { user, hospitalId } = useAuth()
  useNotificationToasts(user?.id)
  const { data: h } = useLive(() => db.select('hospitals').find((x) => x.id === hospitalId), ['hospitals'], [hospitalId])
  const { data: pending = 0 } = useLive(() => db.select('bookings').filter((b) => b.hospitalId === hospitalId && b.status === 'pending').length, ['bookings'], [hospitalId])
  const [drawer, setDrawer] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setDrawer(false), [pathname])
  const menuLinks = [{ to: '/hospital/profile', label: 'Hospital profile', icon: Settings }]

  const Side = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6"><LogoMark light className="h-7 w-7" /><span className="font-display text-[17px] font-semibold text-white">Medic Hub</span><span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-200">Ops</span></div>
      {h && (
        <div className="mx-3 mb-4 flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
          <HospitalAvatar name={h.name} hue={h.hue} logo={h.logo} size={38} />
          <div className="min-w-0"><p className="truncate text-[13.5px] font-semibold text-white">{h.name}</p><p className="truncate text-[12px] text-white/50">{h.area}, {h.city}</p></div>
        </div>
      )}
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Hospital">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition', isActive ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/[0.07] hover:text-white')}>
            <n.icon size={18} /> <span className="flex-1">{n.label}</span>
            {'pro' in n && n.pro && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">Pro</span>}
            {n.to === '/hospital/bookings' && pending > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white tabular">{pending}</span>}
          </NavLink>
        ))}
      </nav>
      {h && (
        <a href={`#/hospitals/${h.id}`} target="_blank" rel="noopener" className="m-3 flex items-center justify-between rounded-xl bg-brand-600/20 px-3.5 py-3 text-[13px] font-medium text-brand-100 ring-1 ring-brand-400/20 hover:bg-brand-600/30">
          Open patient view <ExternalLink size={15} />
        </a>
      )}
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-[#F3F5F2]">
      <OfflineBanner />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] bg-ink lg:block">{Side}</aside>
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-ink" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 400, damping: 40 }}>
              <button onClick={() => setDrawer(false)} className="absolute right-3 top-5 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="Close menu"><X size={20} /></button>
              {Side}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="lg:pl-[264px]">
        <header className="sticky z-20 border-b border-line bg-white/85 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button onClick={() => setDrawer(true)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-mist lg:hidden" aria-label="Open menu"><Menu size={21} /></button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><p className="truncate font-display text-[16px] font-semibold text-ink">{h?.name ?? 'Set up your facility'}</p>{h && <span className="hidden sm:inline-flex"><VerificationPill v={h.verification} size="sm" /></span>}</div>
            </div>
            {h && <Link to="/hospital/check-in" className="btn btn-secondary btn-sm hidden md:inline-flex"><ScanLine size={15} /> Check in patient</Link>}
            <A11yButton />
            <NotificationBell allHref="/hospital/notifications" />
            <UserMenu links={menuLinks} />
          </div>
        </header>
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><Outlet /></main>
      </div>
    </div>
  )
}
