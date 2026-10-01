import { AlertTriangle, CircleCheck, Clock3 } from 'lucide-react'
import { ageLabel, freshnessOf, hoursSince, lastUpdate, STALE_HOURS } from '../../utils/freshness'
import { cn } from '../../utils/cn'

interface H { publicRecord?: boolean; status: { updatedAt: string }; capacity: { updatedAt: string } }

/** Patient-facing warning when a hospital hasn't confirmed its live status recently. */
export function FreshnessNote({ h, variant = 'line', className }: { h: H; variant?: 'line' | 'banner'; className?: string }) {
  const f = freshnessOf(h)
  const age = ageLabel(hoursSince(lastUpdate(h)))
  const copy = {
    fresh: { icon: CircleCheck, tone: 'text-brand-700', bg: 'bg-brand-50 ring-brand-100', title: `Updated by the hospital ${age} ago`, body: 'Status is reported by hospital staff and can change quickly.' },
    ageing: { icon: Clock3, tone: 'text-amber-700', bg: 'bg-amber-50 ring-amber-100', title: `Not updated for ${age}`, body: 'The hospital has been reminded. Availability may have changed, so call ahead before you travel.' },
    stale: { icon: AlertTriangle, tone: 'text-danger-700', bg: 'bg-danger-50 ring-danger-100', title: `Not updated in over ${STALE_HOURS} hours`, body: 'This hospital has not confirmed its status. There is a risk that what is shown is no longer available. Call before you go.' },
    unreported: { icon: AlertTriangle, tone: 'text-amber-700', bg: 'bg-amber-50 ring-amber-100', title: 'Not updated by this hospital yet', body: 'This hospital does not report to Medic Hub yet, so the status shown is not confirmed. You risk arriving to find a service unavailable.' },
  }[f]
  const Icon = copy.icon
  if (variant === 'line') {
    return (
      <p className={cn('flex items-start gap-1.5 text-[11.5px] font-semibold leading-snug', copy.tone, className)} data-freshness={f}>
        <Icon size={13} className="mt-px shrink-0" />
        <span>{f === 'fresh' ? copy.title : f === 'unreported' ? 'Not updated by hospital · availability not confirmed' : f === 'stale' ? `Not updated in ${age} · availability at risk` : `Not updated for ${age} · may have changed`}</span>
      </p>
    )
  }
  return (
    <div className={cn('flex gap-3 rounded-2xl p-3.5 ring-1', copy.bg, className)} role={f === 'fresh' ? undefined : 'status'} data-freshness={f}>
      <Icon size={18} className={cn('mt-0.5 shrink-0', copy.tone)} />
      <div className="min-w-0"><p className={cn('text-[14px] font-semibold', copy.tone)}>{copy.title}</p><p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{copy.body}</p></div>
    </div>
  )
}
