import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Navigation, ZoomOut, Info } from 'lucide-react'
import type { HospitalView } from '../../services/hospitals'
import { NIGERIA_OUTLINE } from '../../data/locations'
import { directionsUrl, distanceKm, fmtKm, type LatLng } from '../../utils/geo'
import { Pill, emergencyLabel, emergencyTone } from '../ui/StatusPill'
import { VerifiedBadge } from '../hospital-admin/VerificationPill'

const W = 800, H = 560, PAD = 60

interface Props { hospitals: HospitalView[]; user: LatLng | null; selected: string | null; onSelect: (id: string | null) => void; initialCity?: string | null }

/**
 * A lightweight, dependency-free map. Nationally it shows city clusters over an outline of Nigeria;
 * within a city it plots facilities relative to each other and to you. Directions open in Google Maps.
 * Positions are real coordinates, but the view is schematic (no street tiles).
 */
export function SchematicMap({ hospitals, user, selected, onSelect, initialCity = null }: Props) {
  const [city, setCity] = useState<string | null>(initialCity)
  const pts = useMemo(() => hospitals.filter((h) => !city || h.city === city), [hospitals, city])
  if (city && pts.length === 0 && hospitals.length) setTimeout(() => setCity(null))
  const cities = useMemo(() => [...new Set(hospitals.map((h) => h.city))], [hospitals])
  const local = cities.length === 1 || !!city
  const localCity = city ?? (cities.length === 1 ? cities[0] : null)

  const bounds = useMemo(() => {
    let src: LatLng[]
    if (local) {
      src = pts.map((h) => ({ lat: h.lat, lng: h.lng }))
      if (user && pts.length && distanceKm(user, pts[0]) < 60) src.push(user)
    } else src = NIGERIA_OUTLINE.map(([lng, lat]) => ({ lat, lng }))
    if (!src.length) src = [{ lat: 9, lng: 8 }]
    let minLat = Math.min(...src.map((p) => p.lat)), maxLat = Math.max(...src.map((p) => p.lat))
    let minLng = Math.min(...src.map((p) => p.lng)), maxLng = Math.max(...src.map((p) => p.lng))
    const minSpan = local ? 0.06 : 1
    if (maxLat - minLat < minSpan) { const c = (maxLat + minLat) / 2; minLat = c - minSpan / 2; maxLat = c + minSpan / 2 }
    if (maxLng - minLng < minSpan) { const c = (maxLng + minLng) / 2; minLng = c - minSpan / 2; maxLng = c + minSpan / 2 }
    return { minLat, maxLat, minLng, maxLng }
  }, [pts, user, local])

  const proj = (p: LatLng) => {
    const sx = (W - PAD * 2) / (bounds.maxLng - bounds.minLng), sy = (H - PAD * 2) / (bounds.maxLat - bounds.minLat)
    const s = Math.min(sx, sy)
    const ox = (W - (bounds.maxLng - bounds.minLng) * s) / 2, oy = (H - (bounds.maxLat - bounds.minLat) * s) / 2
    return { x: ox + (p.lng - bounds.minLng) * s, y: H - (oy + (p.lat - bounds.minLat) * s), s }
  }
  const outline = NIGERIA_OUTLINE.map(([lng, lat]) => { const p = proj({ lat, lng }); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')
  const clusters = useMemo(() => cities.map((c) => {
    const hs = hospitals.filter((h) => h.city === c)
    return { city: c, n: hs.length, lat: hs.reduce((a, h) => a + h.lat, 0) / hs.length, lng: hs.reduce((a, h) => a + h.lng, 0) / hs.length, emergency: hs.filter((h) => h.status.emergency === 'open').length }
  }), [cities, hospitals])
  const sel = hospitals.find((h) => h.id === selected)
  const kmPx = local ? proj({ lat: 0, lng: 0 }).s / 111 : 0
  const userP = user ? proj(user) : null
  const userVisible = userP && userP.x > -20 && userP.x < W + 20 && userP.y > -20 && userP.y < H + 20

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#EAF0EC] ring-1 ring-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={local ? `Map of facilities in ${localCity}` : 'Map of Nigeria with facility clusters by city'}>
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0v40" fill="none" stroke="#0A1F1A" strokeOpacity=".06" /></pattern>
        </defs>
        <rect width={W} height={H} fill="url(#mapgrid)" />
        {!local && <polygon points={outline} fill="#fff" stroke="#A7DCC5" strokeWidth="2" strokeLinejoin="round" />}
        {local && userVisible && kmPx > 0 && [1, 3, 5, 10].map((km) => km * kmPx < W && (
          <g key={km}><circle cx={userP!.x} cy={userP!.y} r={km * kmPx} fill="none" stroke="#1E8C66" strokeOpacity=".22" strokeDasharray="4 6" />
            <text x={userP!.x + km * kmPx * 0.707 + 4} y={userP!.y - km * kmPx * 0.707} fontSize="12" fill="#52625E">{km} km</text></g>
        ))}
        {!local && clusters.map((c) => {
          const p = proj(c)
          const r = 16 + Math.min(14, c.n * 3)
          return (
            <g key={c.city} className="cursor-pointer" onClick={() => setCity(c.city)} role="button" aria-label={`${c.city}: ${c.n} facilities. Zoom in`} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setCity(c.city)}>
              <circle cx={p.x} cy={p.y} r={r + 8} fill="#1E8C66" fillOpacity=".12" />
              <circle cx={p.x} cy={p.y} r={r} fill="#0A1F1A" />
              <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">{c.n}</text>
              <text x={p.x} y={p.y + r + 20} textAnchor="middle" fontSize="14" fontWeight="600" fill="#0A1F1A">{c.city}</text>
            </g>
          )
        })}
        {local && userVisible && <g><circle cx={userP!.x} cy={userP!.y} r="18" fill="#3B82F6" fillOpacity=".18" /><circle cx={userP!.x} cy={userP!.y} r="8" fill="#3B82F6" stroke="#fff" strokeWidth="3" /></g>}
        {local && pts.map((h) => {
          const p = proj(h)
          const on = h.id === selected
          const color = h.status.emergency === 'open' ? '#137352' : h.status.emergency === 'busy' ? '#D98C1C' : '#6B7A76'
          return (
            <g key={h.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" onClick={() => onSelect(on ? null : h.id)} role="button" tabIndex={0} aria-label={`${h.name}, emergency ${emergencyLabel(h.status.emergency)}`} onKeyDown={(e) => e.key === 'Enter' && onSelect(h.id)}>
              <path d="M0 0c-6-9-14-15-14-24a14 14 0 1 1 28 0c0 9-8 15-14 24z" fill={on ? '#0A1F1A' : color} stroke="#fff" strokeWidth="2.5" transform={on ? 'scale(1.25)' : undefined} />
              <path d="M-2.5-30h5v4h4v5h-4v4h-5v-4h-4v-5h4z" fill="#fff" transform={on ? 'scale(1.25)' : undefined} />
            </g>
          )
        })}
      </svg>

      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        {city && <button onClick={() => { setCity(null); onSelect(null) }} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-soft"><ZoomOut size={14} /> All of Nigeria</button>}
        {local && <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-soft">{localCity}</span>}
      </div>
      {local && (
        <div className="absolute right-3 top-3 hidden flex-col gap-1 rounded-xl bg-white/90 px-3 py-2 text-[11.5px] text-slate-600 shadow-soft sm:flex">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-700" /> Emergency open</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 bg-amber-500" /> Busy</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-slate-500" /> Closed</span>
        </div>
      )}
      <p className="absolute bottom-2 left-3 flex items-center gap-1 text-[11px] text-slate-500"><Info size={12} /> Schematic view. Tap directions for live navigation.</p>

      <AnimatePresence>
        {sel && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="absolute inset-x-3 bottom-7 rounded-2xl bg-white p-4 shadow-lift ring-1 ring-black/5 sm:left-auto sm:w-80">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">{sel.name} {sel.verification === 'verified' && <VerifiedBadge size={15} />}</p>
            <p className="text-[12.5px] text-slate-500">{sel.area}{user ? ` · ${fmtKm(distanceKm(user, sel))} away` : ''}</p>
            <div className="mt-2"><Pill tone={emergencyTone(sel.status.emergency)} size="sm">Emergency {emergencyLabel(sel.status.emergency).toLowerCase()}</Pill></div>
            <div className="mt-3 flex gap-2">
              <Link to={`/hospitals/${sel.id}`} className="btn btn-primary btn-sm flex-1">Open profile <ArrowRight size={14} /></Link>
              <a href={directionsUrl(sel.lat, sel.lng, user)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Navigation size={14} /> Directions</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
