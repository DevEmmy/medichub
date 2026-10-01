import { useState } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { House, Search, ShieldPlus, Siren, BookOpenCheck, LogIn, Bot, QrCode } from 'lucide-react'
import { useT } from '../i18n/LanguageContext'
import { LanguageButton, LanguagePicker } from '../components/navigation/LanguagePicker'
import { useAuth } from '../contexts/AuthContext'
import { useEmergency } from '../contexts/EmergencyContext'
import { Logo } from '../components/ui/Logo'
import { NotificationBell } from '../components/navigation/NotificationBell'
import { UserMenu } from '../components/navigation/UserMenu'
import { OfflineBanner } from '../components/navigation/OfflineBanner'
import { useNotificationToasts } from '../hooks/useNotificationToasts'
import { cn } from '../utils/cn'

export function EmergencyButton({ compact = false }: { compact?: boolean }) {
  const { enterEmergency } = useEmergency()
  const { t } = useT()
  return (
    <button onClick={(e) => enterEmergency(e)} aria-label={t('nav.emergency')} className={cn('inline-flex items-center gap-2 rounded-full bg-danger-600 font-semibold text-white shadow-[0_6px_18px_-6px_rgba(220,43,43,.6)] transition hover:bg-danger-700 active:scale-[0.97]', compact ? 'h-10 px-3.5 text-[13px]' : 'h-11 px-4 text-[14px]')}>
      <Siren size={compact ? 16 : 17} /> <span className={compact ? 'hidden min-[380px]:inline' : ''}>{t('nav.emergency')}</span>
    </button>
  )
}

export function AppLayout() {
  const { user } = useAuth()
  const patient = user?.role === 'patient'
  useNotificationToasts(user?.id)
  const { pathname } = useLocation()
  const { enterEmergency } = useEmergency()
  const { t } = useT()
  const [langOpen, setLangOpen] = useState(false)

  const desktopLinks = patient
    ? [{ to: '/app', label: t('nav.home'), end: true }, { to: '/find', label: t('nav.find') }, { to: '/app/bookings', label: t('nav.bookings') }, { to: '/app/health', label: t('nav.vault') }, { to: '/assistant', label: t('nav.assistantShort') }]
    : [{ to: '/find', label: t('nav.find') }, { to: '/first-aid', label: t('nav.firstAid') }, { to: '/assistant', label: t('nav.assistant') }, { to: '/wellness', label: t('nav.wellness') }]
  const mobile = patient
    ? [{ to: '/app', label: t('nav.home'), icon: House, end: true }, { to: '/find', label: t('nav.findShort'), icon: Search }, null, { to: '/assistant', label: t('nav.assistantShort'), icon: Bot }, { to: '/app/health', label: t('nav.vaultShort'), icon: ShieldPlus }]
    : [{ to: '/find', label: t('nav.findShort'), icon: Search }, { to: '/first-aid', label: t('nav.firstAid'), icon: BookOpenCheck }, null, { to: '/assistant', label: t('nav.assistantShort'), icon: Bot }, { to: '/login', label: t('nav.signIn'), icon: LogIn }]

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">Skip to content</a>
      <OfflineBanner />
      <header className="sticky z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container-app flex h-16 items-center gap-4">
          <Logo to={patient ? '/app' : '/'} />
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
            {desktopLinks.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn('rounded-full px-3.5 py-2 text-[14px] font-medium transition', isActive ? 'bg-white text-ink shadow-soft' : 'text-slate-600 hover:text-ink')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {(!user || user.role === 'patient') && <Link to="/scan" aria-label="Scan a hospital QR code" className="grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-mist" data-testid="scan-link"><QrCode size={19} /></Link>}
            <LanguageButton onClick={() => setLangOpen(true)} compact={false} />
            <div className="hidden sm:block"><EmergencyButton /></div>
            {patient ? (<><NotificationBell allHref="/app/notifications" /><UserMenu /></>) : user ? (
              <Link to={user.role === 'hospital' ? '/hospital' : '/admin'} className="btn btn-primary btn-sm">Dashboard</Link>
            ) : (
              <div className="hidden items-center gap-2 sm:flex"><Link to="/login" className="btn btn-ghost btn-sm">{t('nav.signIn')}</Link><Link to="/signup" className="btn btn-primary btn-sm">{t('nav.createAccount')}</Link></div>
            )}
            <div className="sm:hidden"><EmergencyButton compact /></div>
          </div>
        </div>
      </header>
      <main id="main" key={pathname.split('/').slice(0, 3).join('/')} className="flex-1 pb-28 lg:pb-12">
        <Outlet />
      </main>
      {/* Mobile tab bar with a raised emergency action in the centre */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 backdrop-blur-xl lg:hidden" aria-label="Primary" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <ul className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-center px-2">
          {mobile.map((m, i) => m ? (
            <li key={m.to}>
              <NavLink to={m.to} end={'end' in m ? m.end : undefined} className={({ isActive }) => cn('flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition', isActive ? 'text-ink' : 'text-slate-500')}>
                {({ isActive }) => (<><m.icon size={22} strokeWidth={isActive ? 2.3 : 1.8} /><span>{m.label}</span></>)}
              </NavLink>
            </li>
          ) : (
            <li key={'sos' + i} className="flex justify-center">
              <button onClick={(e) => enterEmergency(e)} aria-label="Emergency" className="-mt-7 grid h-[62px] w-[62px] place-items-center rounded-full bg-danger-600 text-white shadow-[0_10px_24px_-6px_rgba(220,43,43,.65)] ring-4 ring-white transition active:scale-95">
                <span className="flex flex-col items-center"><Siren size={22} /><span className="text-[9.5px] font-bold uppercase tracking-wider">SOS</span></span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  )
}
