import { Link } from 'react-router-dom'
import { Phone, Siren } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n/LanguageContext'
import { useLive } from '../../hooks/useLive'
import { HOSPITAL_TABLES } from '../../hooks/useMyHospital'
import { listPublicHospitals } from '../../services/hospitals'
import { useUserLocation } from '../../contexts/LocationContext'
import { distanceKm } from '../../utils/geo'

/** Calls the nearest open hospital emergency unit directly. */
export function Call112Button({ size = 'xl', className }: { size?: 'md' | 'xl'; className?: string }) {
  const { t } = useT()
  const { location } = useUserLocation()
  const { data: all = [] } = useLive(listPublicHospitals, [...HOSPITAL_TABLES], [])
  const open = all.filter((h) => h.status.emergency !== 'closed' && h.emergencyPhone)
  const best = location ? [...open].sort((a, b) => distanceKm(location, a) - distanceKm(location, b))[0] : open[0]
  const cls = cn('group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-danger-600 px-4 text-center font-display font-bold text-white shadow-[0_12px_32px_-8px_rgba(220,43,43,.55)] transition hover:bg-danger-700 active:scale-[0.985]',
    size === 'xl' ? 'min-h-[84px] text-[24px] sm:min-h-[92px] sm:text-[28px]' : 'min-h-[56px] text-[17px]')
  const icon = <span className={cn('relative grid shrink-0 place-items-center rounded-full bg-white text-danger-600', size === 'xl' ? 'h-12 w-12' : 'h-9 w-9')}>{best ? <Phone size={size === 'xl' ? 24 : 18} strokeWidth={2.5} /> : <Siren size={size === 'xl' ? 24 : 18} />}</span>
  return (
    <div className={cn('w-full', className)}>
      {best ? (
        <a href={`tel:${best.emergencyPhone.replace(/\s/g, '')}`} className={cls} aria-label={`Call ${best.name} emergency unit`}>
          {icon}<span className="min-w-0"><span className="block leading-tight">{t('em.call')}</span><span className="block truncate text-[13px] font-medium text-white">{best.name}</span></span>
        </a>
      ) : (
        <Link to="/find?emergency=1" className={cls}>{icon}<span>{t('em.findHospitals')}</span></Link>
      )}
    </div>
  )
}

export function SafetyLine({ className }: { className?: string }) {
  return (
    <p className={cn('text-[13px] leading-relaxed text-slate-600', className)}>
      If someone is in immediate danger, call the nearest hospital emergency unit now. Medic Hub gives guidance and helps you find care; it does not dispatch ambulances.
    </p>
  )
}
