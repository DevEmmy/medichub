import { Link } from 'react-router-dom'
import { LocateFixed, Navigation, PhoneCall, Siren } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { HOSPITAL_TABLES } from '../../hooks/useMyHospital'
import { listPublicHospitals, type HospitalView } from '../../services/hospitals'
import { useUserLocation } from '../../contexts/LocationContext'
import { directionsUrl, distanceKm, fmtKm } from '../../utils/geo'
import { Pill, emergencyLabel, emergencyTone } from '../ui/StatusPill'
import { FreshnessNote } from '../hospitals/FreshnessNote'
import { freshnessOf } from '../../utils/freshness'

const tel = (n: string) => `tel:${n.replace(/\s/g, '')}`

/** Direct line to the nearest open emergency unit, ahead of the national number. */
export function NearestEmergency() {
  const { location, requestGps, geoState } = useUserLocation()
  const { data: all = [] } = useLive(listPublicHospitals, [...HOSPITAL_TABLES], [])
  const open = all.filter((h) => h.status.emergency !== 'closed')
  const withDist = open.map((h) => ({ h, km: location ? distanceKm(location, h) : null }))
  // Nearest first; without a location, prefer hospitals with fresh status.
  const rank = (x: { h: HospitalView; km: number | null }) => (x.km ?? 0) + (freshnessOf(x.h) === 'fresh' ? 0 : freshnessOf(x.h) === 'ageing' ? 0.5 : 2) + (x.h.status.emergency === 'busy' ? 1 : 0)
  const sorted = [...withDist].sort((a, b) => (location ? (a.km! - b.km!) : rank(a) - rank(b)))
  const callable = sorted.filter((x) => x.h.emergencyPhone)
  const best = callable[0]
  const nearestOverall = sorted[0]
  const nearerNoLine = location && nearestOverall && best && nearestOverall.h.id !== best.h.id && !nearestOverall.h.emergencyPhone ? nearestOverall : null

  return (
    <section aria-labelledby="near-h" className="rounded-3xl bg-white p-4 shadow-lift ring-2 ring-danger-200 sm:p-5" data-testid="nearest-emergency">
      <p id="near-h" className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-danger-600"><Siren size={16} /> Call the hospital directly</p>
      {best ? (
        <>
          <div className="mt-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Link to={`/hospitals/${best.h.id}`} className="block font-display text-[20px] font-semibold leading-tight text-ink hover:underline">{best.h.name}</Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-600">
                <Pill tone={emergencyTone(best.h.status.emergency)} size="sm">Emergency {emergencyLabel(best.h.status.emergency).toLowerCase()}</Pill>
                <span>{best.h.area}, {best.h.city}</span>
                {best.km !== null && <span className="font-semibold text-ink tabular">{fmtKm(best.km)} away</span>}
              </p>
              <FreshnessNote h={best.h} className="mt-2" />
            </div>
          </div>
          <a href={tel(best.h.emergencyPhone)} className="mt-4 flex min-h-[68px] items-center justify-center gap-3 rounded-2xl bg-danger-600 px-4 text-white shadow-lift transition hover:bg-danger-700 active:scale-[0.99]" data-testid="call-nearest">
            <PhoneCall size={24} />
            <span className="text-left"><span className="block font-display text-[20px] font-semibold leading-tight">Call emergency unit</span><span className="block select-all text-[13px] text-white/80 tabular">{best.h.emergencyPhone}</span></span>
          </a>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={directionsUrl(best.h.lat, best.h.lng, location)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Navigation size={15} /> Directions</a>
            {!location ? <button onClick={() => requestGps()} className="btn btn-secondary btn-sm" disabled={geoState === 'asking'}><LocateFixed size={15} /> {geoState === 'asking' ? 'Locating…' : 'Use my location'}</button> : <Link to="/find?emergency=1" className="btn btn-secondary btn-sm">Other hospitals</Link>}
          </div>
          {!location && <p className="mt-2 text-[12px] text-slate-500">Share your location so we can pick the closest unit. Showing the best-updated unit for now.</p>}
          {nearerNoLine && <p className="mt-2 text-[12px] leading-relaxed text-slate-600"><strong className="text-ink">{nearerNoLine.h.name}</strong> is closer ({fmtKm(nearerNoLine.km!)}) but hasn't given Medic Hub a direct emergency line yet. <a className="font-semibold text-brand-700 underline" href={directionsUrl(nearerNoLine.h.lat, nearerNoLine.h.lng, location)} target="_blank" rel="noopener noreferrer">Directions</a></p>}
        </>
      ) : (
        <p className="mt-2 text-[14px] text-slate-600">No hospital with a direct emergency line is open on Medic Hub right now. <Link to="/find?emergency=1" className="font-semibold text-brand-700 underline">find the nearest emergency department</Link>.</p>
      )}
    </section>
  )
}
