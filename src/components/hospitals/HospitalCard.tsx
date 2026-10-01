import { FreshnessNote } from './FreshnessNote'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, MapPin, Navigation, Wind, Activity, Siren } from 'lucide-react'
import type { HospitalView } from '../../services/hospitals'
import { HospitalAvatar, HospitalCover } from '../ui/HospitalAvatar'
import { Pill, availLabel, availTone, capLabel, capTone, emergencyLabel, emergencyTone } from '../ui/StatusPill'
import { VerifiedBadge } from '../hospital-admin/VerificationPill'
import { directionsUrl, fmtKm } from '../../utils/geo'
import { fmtTime, today, addDays, fmtDate } from '../../utils/date'
import { useUserLocation } from '../../contexts/LocationContext'

export function slotWhen(s: { date: string; time: string }) {
  const d = s.date === today() ? 'Today' : s.date === addDays(today(), 1) ? 'Tomorrow' : fmtDate(s.date)
  return `${d}, ${fmtTime(s.time)}`
}

export function HospitalCard({ h, distance, highlight, onHover }: { h: HospitalView; distance: number | null; highlight?: boolean; onHover?: (id: string | null) => void }) {
  const nav = useNavigate()
  const { location } = useUserLocation()
  const showEmergencyRoute = h.status.emergency !== 'closed'
  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.22 }}
      onMouseEnter={() => onHover?.(h.id)} onMouseLeave={() => onHover?.(null)}
      className={`card group flex flex-col overflow-hidden transition ${highlight ? 'ring-2 ring-brand-400' : ''}`} aria-labelledby={`h-${h.id}`}>
      <HospitalCover hue={h.hue} seed={h.id} cover={h.cover} className="h-36" still>
        <div className="absolute right-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">{h.openNow ? (h.is24h ? 'Open 24 hours' : 'Open now') : 'Closed now'}</span>
        </div>
      </HospitalCover>
      <div className="relative -mt-7 flex flex-1 flex-col px-4 pb-4">
        <div className="flex items-end gap-3">
          <HospitalAvatar name={h.name} hue={h.hue} logo={h.logo} size={52} className="ring-4 ring-white" />
          {distance !== null && <span className="mb-1 ml-auto inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[12px] font-semibold text-slate-700 tabular"><MapPin size={12} />{fmtKm(distance)}</span>}
        </div>
        <h3 id={`h-${h.id}`} className="mt-3 flex items-start gap-1.5 text-[17px] font-semibold leading-snug">
          <Link to={`/hospitals/${h.id}`} className="hover:underline">{h.name}</Link>
          {h.verification === 'verified' && <VerifiedBadge className="mt-1" />}
          {h.publicRecord && <span className="mt-0.5 shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">Federal</span>}
        </h3>
        <p className="mt-0.5 text-[13px] text-slate-500">{h.type} · {h.area}, {h.city}</p>

        <FreshnessNote h={h} className="mt-3" />
        <dl className="mt-2 grid grid-cols-3 gap-2">
          <div><dt className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Siren size={11} /> Emergency</dt><dd className="mt-1"><Pill tone={emergencyTone(h.status.emergency)} size="sm">{emergencyLabel(h.status.emergency)}</Pill></dd></div>
          <div><dt className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Activity size={11} /> Capacity</dt><dd className="mt-1"><Pill tone={capTone(h.capacity.overall)} size="sm">{capLabel(h.capacity.overall)}</Pill></dd></div>
          <div><dt className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Wind size={11} /> Oxygen</dt><dd className="mt-1"><Pill tone={availTone(h.status.oxygen)} size="sm">{availLabel(h.status.oxygen)}</Pill></dd></div>
        </dl>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {h.specialties.slice(0, 3).map((s) => <span key={s} className="rounded-md bg-canvas px-2 py-0.5 text-[12px] font-medium text-slate-600 ring-1 ring-line">{s}</span>)}
          {h.specialties.length > 3 && <span className="rounded-md px-1.5 py-0.5 text-[12px] font-medium text-slate-500">+{h.specialties.length - 3} more</span>}
        </div>

        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-brand-50/70 px-3 py-2 text-[13px]">
          <CalendarClock size={15} className="shrink-0 text-brand-700" />
          {h.nextSlot ? <span className="min-w-0 truncate"><span className="text-slate-600">Next:</span> <strong className="font-semibold text-ink">{slotWhen(h.nextSlot)}</strong> <span className="text-slate-500">· {h.nextSlot.serviceName}</span></span> : <span className="text-slate-600">No appointment slots this week</span>}
        </div>

        <div className="mt-4 flex gap-2 pt-0.5">
          <button onClick={() => nav(`/hospitals/${h.id}?book=1`)} disabled={!h.nextSlot} className="btn btn-primary flex-1 px-3">Book a slot</button>
          <Link to={`/hospitals/${h.id}`} className="btn btn-secondary px-3">View</Link>
          {showEmergencyRoute && (
            <a href={directionsUrl(h.lat, h.lng, location)} target="_blank" rel="noopener noreferrer" className="btn grid w-11 place-items-center bg-danger-50 px-0 text-danger-700 ring-1 ring-danger-100 hover:bg-danger-100" aria-label={`Emergency route to ${h.name} (opens Google Maps)`} title="Emergency route">
              <Navigation size={17} />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  )
}
