import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface Base { label: string; hint?: ReactNode; error?: string | null; className?: string }

export function Field({ label, hint, error, className, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={rest.id ?? id} className="block text-[13px] font-medium text-slate-700">{label}</label>
      <input id={rest.id ?? id} className="input" aria-invalid={!!error} aria-describedby={error ? id + '-e' : hint ? id + '-h' : undefined} {...rest} />
      {error ? <p id={id + '-e'} className="text-[12.5px] font-medium text-danger-600">{error}</p> : hint ? <p id={id + '-h'} className="text-[12.5px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function SelectField({ label, hint, error, className, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={rest.id ?? id} className="block text-[13px] font-medium text-slate-700">{label}</label>
      <select id={rest.id ?? id} className="input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236B7A76%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10" aria-invalid={!!error} {...rest}>{children}</select>
      {error ? <p className="text-[12.5px] font-medium text-danger-600">{error}</p> : hint ? <p className="text-[12.5px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function TextArea({ label, hint, error, className, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={rest.id ?? id} className="block text-[13px] font-medium text-slate-700">{label}</label>
      <textarea id={rest.id ?? id} className="input min-h-[96px] resize-y leading-relaxed" aria-invalid={!!error} {...rest} />
      {error ? <p className="text-[12.5px] font-medium text-danger-600">{error}</p> : hint ? <p className="text-[12.5px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4', disabled && 'opacity-50')}>
      <span className="min-w-0"><span className="block text-[14px] font-medium text-ink">{label}</span>{description && <span className="mt-0.5 block text-[13px] text-slate-500">{description}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300')}>
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </label>
  )
}
