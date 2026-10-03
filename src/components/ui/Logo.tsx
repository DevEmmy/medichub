import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { useAuth, homeFor } from '../../contexts/AuthContext'

export function LogoMark({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <rect width="32" height="32" rx="10" fill={light ? '#C6F36B' : '#06281F'} />
      <path d="M13 7.5h6v5.5h5.5v6H19v5.5h-6V19H7.5v-6H13z" fill={light ? '#06281F' : '#C6F36B'} />
      <circle cx="24.5" cy="7.5" r="3" fill="#F04E37" />
    </svg>
  )
}

/** The logo always takes you home: your dashboard when signed in, the landing page otherwise. */
export function Logo({ to, light = false, compact = false }: { to?: string; light?: boolean; compact?: boolean }) {
  const { user, hospitalId } = useAuth()
  const href = to ?? (user ? homeFor(user.role, hospitalId) : '/')
  return (
    <Link to={href} className="flex items-center gap-2.5 rounded-lg" aria-label="Medic Hub home">
      <LogoMark light={light} />
      {!compact && <span className={cn('hidden font-display text-[20px] min-[480px]:inline font-extrabold tracking-[-0.02em]', light ? 'text-white' : 'text-ink')}>Medic Hub</span>}
    </Link>
  )
}
