import { Link } from 'react-router-dom'
import { ArrowRight, BookOpenCheck, CalendarPlus, MapPin, Siren } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { listPublicHospitals } from '../../services/hospitals'
import { useUserLocation } from '../../contexts/LocationContext'
import { distanceKm, fmtKm } from '../../utils/geo'
import { matchTopic } from '../../services/aiKnowledge'
import { EMERGENCY_GUIDES } from '../../data/firstAid'
import { HospitalCover } from '../ui/HospitalAvatar'
import { Pill, emergencyLabel, emergencyTone } from '../ui/StatusPill'
import { slotWhen } from '../hospitals/HospitalCard'

/** Turns an answer into next steps inside Medic Hub: hospitals to book, a guide to follow, or emergency help. */
export function AiActions({ question, redFlag }: { question: string; redFlag?: boolean }) {
  const { location } = useUserLocation()
  const { data: hospitals = [] } = useLive(listPublicHospitals, ['hospitals', 'hospital_status', 'hospital_capacity', 'hospital_slots'])
  const topic = matchTopic(question)
  const q = question.toLowerCase()
  // First-aid guides only for urgent questions or when no everyday topic matched (avoids "blood pressure" → bleeding)
  const guide = redFlag || !topic ? EMERGENCY_GUIDES.find((g) => [g.title, ...g.keywords].some((k) => k.length > 3 && new RegExp(`\\b${k.toLowerCase()}`).test(q))) : undefined
  const wanted = redFlag ? ['Emergency medicine'] : topic?.specialties ?? []
  if (!wanted.length && !guide) return null
  const picks = hospitals
    .filter((h) => wanted.some((w) => h.specialties.includes(w)) && (!redFlag || h.status.emergency !== 'closed'))
    .map((h) => ({ h, d: location ? distanceKm(location, h) : null }))
    .sort((a, b) => (a.d !== null && b.d !== null ? a.d - b.d : Number(!!b.h.nextSlot) - Number(!!a.h.nextSlot)))
    .slice(0, 3)
  return (
    <div className="mt-3 space-y-2" data-testid="ai-actions">
      {redFlag && <Link to="/emergency" className="flex items-center gap-3 rounded-2xl bg-danger-600 p-3 text-white"><Siren size={18} /><span className="flex-1 text-[14px] font-bold">Call the nearest emergency unit</span><ArrowRight size={16} /></Link>}
      {guide && <Link to={`/emergency/${guide.slug}`} className="flex items-center gap-3 rounded-2xl bg-danger-50 p-3 text-danger-800 ring-1 ring-danger-100"><BookOpenCheck size={18} /><span className="flex-1 text-[14px] font-bold">First-aid guide: {guide.title}</span><ArrowRight size={16} /></Link>}
      {picks.length > 0 && (
        <div>
          <p className="mb-2 mt-1 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-500">{redFlag ? 'Open emergency units' : 'Hospitals that can help'}{!location && ' · set your location for the nearest'}</p>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {picks.map(({ h, d }) => (
              <div key={h.id} className="w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                <HospitalCover hue={h.hue} seed={h.id} cover={h.cover ?? h.photos?.[0]?.src} className="h-20" still />
                <div className="p-3">
                  <p className="truncate text-[13.5px] font-bold text-ink">{h.name}</p>
                  <p className="flex items-center gap-1 text-[11.5px] text-slate-500"><MapPin size={11} /> {h.area}{d !== null ? ` · ${fmtKm(d)}` : ''}</p>
                  <div className="mt-1.5"><Pill tone={emergencyTone(h.status.emergency)} size="sm">ER {emergencyLabel(h.status.emergency).toLowerCase()}</Pill></div>
                  <div className="mt-2 flex gap-1.5">
                    <Link to={`/hospitals/${h.id}`} className="btn btn-secondary btn-sm flex-1 px-2">View</Link>
                    {h.nextSlot && !redFlag && <Link to={`/hospitals/${h.id}?book=1`} className="btn btn-primary btn-sm flex-1 px-2" title={`Next: ${slotWhen(h.nextSlot)}`}><CalendarPlus size={13} /> Book</Link>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
