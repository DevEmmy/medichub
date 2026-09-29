import { useState } from 'react'
import { Copy, Phone, Smartphone } from 'lucide-react'
import { cn } from '../../utils/cn'
import { isMobileUA } from '../../utils/env'
import { useT } from '../../i18n/LanguageContext'

/**
 * Calls Nigeria's national emergency number. On phones it opens the dialler directly (no extra confirmation:
 * the tap target is deliberate and large). On desktops it shows the number to dial from a phone.
 */
export function Call112Button({ size = 'xl', className }: { size?: 'md' | 'xl'; className?: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useT()
  const copy = async () => { try { await navigator.clipboard.writeText('112'); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ } }
  return (
    <div className={cn('w-full', className)}>
      <a href="tel:112" className={cn('group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-danger-600 font-display font-bold text-white shadow-[0_12px_32px_-8px_rgba(220,43,43,.55)] transition hover:bg-danger-700 active:scale-[0.985]',
        size === 'xl' ? 'min-h-[84px] text-[28px] sm:min-h-[92px] sm:text-[32px]' : 'min-h-[56px] text-[19px]')}
        aria-label="Call 112, Nigeria's national emergency number">
        <span className="relative grid place-items-center">
          <span className="absolute h-11 w-11 animate-pulseRing rounded-full bg-white/40" aria-hidden />
          <span className={cn('relative grid place-items-center rounded-full bg-white text-danger-600', size === 'xl' ? 'h-12 w-12' : 'h-9 w-9')}><Phone size={size === 'xl' ? 24 : 18} strokeWidth={2.5} /></span>
        </span>
        {t('em.call')}
      </a>
      {!isMobileUA && (
        <p className="mt-2.5 text-center text-[13px] leading-relaxed text-slate-600">
          <Smartphone size={14} aria-hidden className="-mt-0.5 mr-1 inline" />On a computer? Call <strong className="select-all font-semibold text-ink">112</strong> from your phone.{' '}
          <button onClick={copy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 align-middle font-medium text-brand-700 hover:bg-brand-50"><Copy size={13} />{copied ? 'Copied' : 'Copy'}</button>
        </p>
      )}
    </div>
  )
}

export function SafetyLine({ className }: { className?: string }) {
  return (
    <p className={cn('text-[13px] leading-relaxed text-slate-600', className)}>
      If someone is in immediate danger, call <strong className="text-ink">112</strong> now. 112 is Nigeria's national emergency number. Medic Hub gives guidance and helps you find care; it does not dispatch ambulances.
    </p>
  )
}
