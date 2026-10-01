import { Star } from 'lucide-react'
import { cn } from '../../utils/cn'

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-slate-300" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star size={size} className="fill-amber-400 text-amber-400" /></span>
          </span>
        )
      })}
    </span>
  )
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent']
  return (
    <div>
      <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => onChange(i)}
            className="grid h-11 w-11 place-items-center rounded-xl transition hover:bg-amber-50 active:scale-95">
            <Star size={28} className={i <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-[13px] font-medium text-slate-600">{value ? labels[value - 1] : 'Tap a star'}</p>
    </div>
  )
}
