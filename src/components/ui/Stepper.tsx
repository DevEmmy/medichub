import { Minus, Plus } from 'lucide-react'
export function Stepper({ value, onChange, min = 0, max = 999, label, disabled }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; disabled?: boolean }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-white ring-1 ring-line" role="group" aria-label={label}>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className="grid h-10 w-10 place-items-center rounded-l-xl text-slate-600 hover:bg-mist disabled:opacity-30" aria-label={`Decrease ${label}`}><Minus size={16} /></button>
      <span className="min-w-[2.5rem] text-center font-display text-[16px] font-semibold text-ink tabular" aria-live="polite">{value}</span>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className="grid h-10 w-10 place-items-center rounded-r-xl text-slate-600 hover:bg-mist disabled:opacity-30" aria-label={`Increase ${label}`}><Plus size={16} /></button>
    </div>
  )
}
