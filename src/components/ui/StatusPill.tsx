import { cn } from '../../utils/cn'
import type { Availability, BookingStatus, EmergencyCapacity, EmergencyLevel, OverallCapacity } from '../../types'

type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'info'
const TONES: Record<Tone, string> = {
  good: 'bg-brand-50 text-brand-700 ring-brand-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-100',
  bad: 'bg-danger-50 text-danger-700 ring-danger-100',
  neutral: 'bg-mist text-slate-600 ring-line',
  info: 'bg-sky-50 text-sky-700 ring-sky-100',
}
const DOT: Record<Tone, string> = { good: 'bg-brand-500', warn: 'bg-amber-500', bad: 'bg-danger-500', neutral: 'bg-slate-400', info: 'bg-sky-500' }
// Shapes reinforce meaning so status is never conveyed by colour alone
const SHAPE: Record<Tone, string> = { good: 'rounded-full', warn: 'rounded-[2px] rotate-45', bad: 'rounded-[1px]', neutral: 'rounded-full', info: 'rounded-full' }

export function Pill({ tone, children, size = 'md', className, pulse }: { tone: Tone; children: React.ReactNode; size?: 'sm' | 'md'; className?: string; pulse?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset', TONES[tone], size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]', className)}>
      <span className="relative inline-flex">
        {pulse && <span className={cn('absolute inset-0 animate-pulseRing rounded-full', DOT[tone])} />}
        <span className={cn('relative inline-block h-1.5 w-1.5', DOT[tone], SHAPE[tone])} />
      </span>
      {children}
    </span>
  )
}

export const emergencyTone = (e: EmergencyLevel): Tone => (e === 'open' ? 'good' : e === 'busy' ? 'warn' : 'bad')
export const emergencyLabel = (e: EmergencyLevel) => ({ open: 'Open', busy: 'Busy', closed: 'Closed' }[e])
export const availTone = (a: Availability): Tone => (a === 'available' ? 'good' : a === 'limited' ? 'warn' : 'neutral')
export const availLabel = (a: Availability) => ({ available: 'Available', limited: 'Limited', unavailable: 'Unavailable' }[a])
export const capTone = (c: OverallCapacity | EmergencyCapacity): Tone => (c === 'available' ? 'good' : c === 'moderate' || c === 'limited' ? 'warn' : c === 'high' ? 'warn' : 'bad')
export const capLabel = (c: OverallCapacity | EmergencyCapacity) => ({ available: 'Available', moderate: 'Moderate', high: 'High', full: 'Full', limited: 'Limited' }[c])

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'good' },
  checked_in: { label: 'Checked in', tone: 'info' },
  in_consultation: { label: 'In consultation', tone: 'info' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
  no_show: { label: 'No-show', tone: 'bad' },
}
export function BookingStatusPill({ status, size }: { status: BookingStatus; size?: 'sm' | 'md' }) {
  const s = BOOKING_STATUS[status]
  return <Pill tone={s.tone} size={size}>{s.label}</Pill>
}
