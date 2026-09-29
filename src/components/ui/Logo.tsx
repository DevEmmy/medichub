import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export function LogoMark({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill={light ? '#fff' : '#0A1F1A'} />
      <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill={light ? '#0A1F1A' : '#3FA881'} />
      <circle cx="24" cy="8" r="3" fill="#E4674A" />
    </svg>
  )
}

export function Logo({ to = '/', light = false, compact = false }: { to?: string; light?: boolean; compact?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg" aria-label="Medic Hub home">
      <LogoMark light={light} />
      {!compact && <span className={cn('hidden font-display text-[19px] min-[480px]:inline font-semibold tracking-tight', light ? 'text-white' : 'text-ink')}>Medic Hub</span>}
    </Link>
  )
}
