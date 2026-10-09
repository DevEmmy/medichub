import { motion } from 'framer-motion'
import { useId } from 'react'
import { cn } from '../../utils/cn'

export interface SegOption<T extends string> { value: T; label: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }
const ACTIVE: Record<string, string> = { good: 'bg-brand-600 text-white', warn: 'bg-amber-700 text-white', bad: 'bg-danger-600 text-white', neutral: 'bg-slate-600 text-white' }

/** Status control: a radio group styled as a segmented switch. */
export function Segmented<T extends string>({ value, options, onChange, label, disabled, size = 'md' }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label: string; disabled?: boolean; size?: 'sm' | 'md' }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn('relative inline-grid w-full gap-0.5 rounded-xl bg-mist p-1', options.length > 3 ? 'grid-cols-2 min-[480px]:grid-cols-4' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-2', disabled && 'opacity-60')}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => !on && onChange(o.value)}
            className={cn('relative z-0 rounded-lg font-semibold transition-colors', size === 'sm' ? 'min-h-[34px] px-1.5 text-[12px]' : 'min-h-[40px] px-1 text-[12.5px]', on ? 'text-white' : 'text-slate-600 hover:text-ink')}>
            {on && <motion.span layoutId={id} className={cn('absolute inset-0 rounded-lg shadow-sm', ACTIVE[o.tone ?? 'neutral'])} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
