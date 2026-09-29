import { Check, Languages } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useT } from '../../i18n/LanguageContext'
import { LANGUAGES } from '../../i18n/strings'
import { cn } from '../../utils/cn'

export function LanguagePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, setLang, t } = useT()
  return (
    <Modal open={open} onClose={onClose} title={t('lang.title')} size="sm">
      <p className="text-[14px] text-slate-600">{t('lang.sub')}</p>
      <ul className="mt-4 space-y-2" role="radiogroup" aria-label={t('lang.title')}>
        {LANGUAGES.map((l) => (
          <li key={l.code}>
            <button role="radio" aria-checked={lang === l.code} onClick={() => { setLang(l.code); onClose() }}
              className={cn('flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 transition', lang === l.code ? 'bg-brand-50 ring-brand-300' : 'bg-white ring-line hover:ring-slate-300')}>
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{l.native}</span><span className="block text-[12.5px] text-slate-500">{l.name}</span></span>
              {lang === l.code && <Check size={18} className="text-brand-700" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">{t('lang.note')}</p>
    </Modal>
  )
}

export function LanguageButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  const { lang, t } = useT()
  return (
    <button onClick={onClick} aria-label={`${t('nav.language')}: ${LANGUAGES.find((l) => l.code === lang)!.name}`} className="inline-flex h-11 min-w-[40px] items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-slate-600 hover:bg-mist hover:text-ink">
      <Languages size={18} />{!compact && <span className="hidden uppercase sm:inline">{lang === 'pcm' ? 'PCM' : lang}</span>}
    </button>
  )
}
