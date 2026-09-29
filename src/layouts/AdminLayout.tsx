import { Outlet } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { NotificationBell } from '../components/navigation/NotificationBell'
import { UserMenu } from '../components/navigation/UserMenu'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationToasts } from '../hooks/useNotificationToasts'
import { ShieldCheck } from 'lucide-react'

export function AdminLayout() {
  const { user } = useAuth()
  useNotificationToasts(user?.id)
  return (
    <div className="min-h-[100dvh] bg-[#F3F5F2]">
      <header className="sticky z-20 border-b border-line bg-white/85 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container-app flex h-16 items-center gap-3">
          <Logo to="/admin" />
          <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white sm:inline-flex"><ShieldCheck size={13} /> Trust & Safety</span>
          <div className="ml-auto flex items-center gap-2"><NotificationBell allHref="/admin" /><UserMenu links={[]} /></div>
        </div>
      </header>
      <main className="container-app py-8"><Outlet /></main>
    </div>
  )
}
