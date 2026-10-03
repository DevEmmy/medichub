import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SCENES } from '../../data/scenes'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import { List, Map as MapIcon, Search, SlidersHorizontal, X, Hospital, Siren } from 'lucide-react'
import { HospitalCard } from '../../components/hospitals/HospitalCard'
import { LocationBar } from '../../components/hospitals/LocationBar'
import { SchematicMap } from '../../components/hospitals/SchematicMap'
import { CardSkeleton, EmptyState, ErrorState } from '../../components/ui/States'
import { Modal } from '../../components/ui/Modal'
import { SelectField } from '../../components/ui/Field'
import { useLive, useFirstLoad } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { listPublicHospitals, type HospitalView } from '../../services/hospitals'
import { useUserLocation } from '../../contexts/LocationContext'
import { distanceKm } from '../../utils/geo'
import { ALL_SPECIALTIES } from '../../data/seed'
import { CITIES } from '../../data/locations'
import { cn } from '../../utils/cn'

type Toggle = 'open' | 'emergency' | 'oxygen' | 'appt' | 'verified'
const TOGGLES: { key: Toggle; label: string }[] = [
  { key: 'open', label: 'Open now' }, { key: 'emergency', label: 'Emergency available' }, { key: 'oxygen', label: 'Oxygen available' }, { key: 'appt', label: 'Appointment available' }, { key: 'verified', label: 'Verified' },
]
const DISTANCES = [0, 5, 10, 25, 50]
const TYPES = ['Teaching', 'Federal Medical Centre', 'Specialist', 'General', 'Private', 'Mission', 'Primary Care']

export default function FindCare() {
  useDocumentTitle('Find care')
  const [params, setParams] = useSearchParams()
  const ready = useFirstLoad(450)
  const { data: all, error } = useLive(listPublicHospitals, ['hospitals', 'hospital_status', 'hospital_capacity', 'hospital_slots', 'hospital_services', 'hospital_reviews'])
  const { location } = useUserLocation()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [toggles, setToggles] = useState<Set<Toggle>>(() => new Set([params.get('emergency') && 'emergency', params.get('open') && 'open', params.get('appt') && 'appt'].filter(Boolean) as Toggle[]))
  const [specialty, setSpecialty] = useState(params.get('specialty') ?? '')
  const [type, setType] = useState('')
  const [city, setCity] = useState('')
  const [maxKm, setMaxKm] = useState(0)
  const [sort, setSort] = useState<'nearest' | 'soonest' | 'rating' | 'name'>(params.get('emergency') ? 'nearest' : 'nearest')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [selected, setSelected] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const emergencyMode = toggles.has('emergency')

  useEffect(() => { const t = setTimeout(() => { const p = new URLSearchParams(params); if (q) p.set('q', q); else p.delete('q'); setParams(p, { replace: true }) }, 300); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const withDist = useMemo(() => (all ?? []).map((h) => ({ h, d: location ? distanceKm(location, h) : null })), [all, location])
  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    const r = withDist.filter(({ h, d }) => {
      if (term) {
        const hay = [h.name, h.area, h.city, h.state, h.type, ...h.specialties, ...h.services.map((s) => s.name), ...h.departments.map((d) => d.name)].join(' ').toLowerCase()
        if (!term.split(/\s+/).every((t) => hay.includes(t))) return false
      }
      if (toggles.has('open') && !h.openNow) return false
      if (toggles.has('emergency') && h.status.emergency === 'closed') return false
      if (toggles.has('oxygen') && h.status.oxygen === 'unavailable') return false
      if (toggles.has('appt') && !h.nextSlot) return false
      if (toggles.has('verified') && h.verification !== 'verified') return false
      if (specialty && !h.specialties.includes(specialty)) return false
      if (type && h.type !== type) return false
      if (city && h.city !== city) return false
      if (maxKm && d !== null && d > maxKm) return false
      return true
    })
    const soon = (h: HospitalView) => (h.nextSlot ? h.nextSlot.date + h.nextSlot.time : '9999')
    r.sort((a, b) => {
      if (emergencyMode) { const rank = (x: HospitalView) => (x.status.emergency === 'open' ? 0 : 1); if (rank(a.h) !== rank(b.h)) return rank(a.h) - rank(b.h) }
      if (sort === 'nearest' && a.d !== null && b.d !== null) return a.d - b.d
      if (sort === 'soonest') return soon(a.h).localeCompare(soon(b.h))
      if (sort === 'rating') return (b.h.rating.avg - a.h.rating.avg) || (b.h.rating.count - a.h.rating.count)
      return a.h.name.localeCompare(b.h.name)
    })
    return r
  }, [withDist, q, toggles, specialty, type, city, maxKm, sort, emergencyMode])

  const flip = (k: Toggle) => setToggles((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const active: { label: string; clear: () => void }[] = [
    ...[...toggles].map((k) => ({ label: TOGGLES.find((t) => t.key === k)!.label, clear: () => flip(k) })),
    ...(specialty ? [{ label: specialty, clear: () => setSpecialty('') }] : []),
    ...(type ? [{ label: type, clear: () => setType('') }] : []),
    ...(city ? [{ label: city, clear: () => setCity('') }] : []),
    ...(maxKm ? [{ label: `Within ${maxKm} km`, clear: () => setMaxKm(0) }] : []),
  ]
  const clearAll = () => { setToggles(new Set()); setSpecialty(''); setType(''); setCity(''); setMaxKm(0); setQ('') }
  const nearestCity = useMemo(() => {
    if (!location || !all?.length) return null
    const best = all.map((h) => ({ c: h.city, d: distanceKm(location, h) })).sort((a, b) => a.d - b.d)[0]
    return best && best.d < 60 ? best.c : null
  }, [location, all])

  const FilterFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)}><option value="">Any specialty</option>{ALL_SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</SelectField>
      <SelectField label="Hospital type" value={type} onChange={(e) => setType(e.target.value)}><option value="">Any type</option>{TYPES.map((s) => <option key={s}>{s}</option>)}</SelectField>
      <SelectField label="City" value={city} onChange={(e) => setCity(e.target.value)}><option value="">All cities</option>{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</SelectField>
      <SelectField label="Distance" value={maxKm} onChange={(e) => setMaxKm(Number(e.target.value))} disabled={!location} hint={!location ? 'Set your location to filter by distance.' : undefined}>
        {DISTANCES.map((d) => <option key={d} value={d}>{d ? `Within ${d} km` : 'Any distance'}</option>)}
      </SelectField>
    </div>
  )

  return (
    <div className="container-app py-6 sm:py-8">
      {emergencyMode && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-danger-50 p-4 ring-1 ring-danger-100 sm:flex-row sm:items-center">
          <Siren size={20} className="text-danger-600" />
          <p className="flex-1 text-[14px] font-medium text-danger-900">Showing hospitals with open emergency departments first. If someone is in immediate danger, call the nearest hospital emergency unit now.</p>
          <Link to="/emergency" className="btn btn-danger btn-sm">Call nearest emergency unit</Link>
        </div>
      )}
      <div className="relative overflow-hidden rounded-[28px] bg-ink px-5 py-6 text-white shadow-lift grain sm:px-7 sm:py-8">
        <img src={emergencyMode ? SCENES.emergencyEntrance : SCENES.nurseWard} alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-40 sm:w-[55%] sm:opacity-80 sm:[mask-image:linear-gradient(90deg,transparent,black_40%)]" />
        <div className="absolute inset-0 adire opacity-40 [mask-image:linear-gradient(90deg,black,transparent_70%)]" aria-hidden />
        <div className="relative max-w-lg">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-lime-300">{emergencyMode ? 'Emergency' : `${(all ?? []).length} hospitals`}</p>
          <h1 className="mt-1 text-[32px] font-extrabold leading-[1.02] tracking-[-0.02em] text-white sm:text-[44px]">{emergencyMode ? 'Emergency care near you' : <>Find the right care, <span className="text-lime-400">fast.</span></>}</h1>
          <p className="mt-2 text-[14.5px] text-white/70">{emergencyMode ? 'Open emergency units first, with direct lines.' : 'Live status, real services and open slots, closest first.'}</p>
        </div>
      </div>
      <div className="mt-4"><LocationBar /></div>

      <div className="sticky z-30 -mx-4 mt-5 bg-canvas/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:px-0" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
        <div className="flex gap-2">
          <label className="relative block flex-1">
            <span className="sr-only">Search hospitals, specialties or services</span>
            <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hospitals, specialties or services" className="input h-12 rounded-2xl pl-11 pr-10 shadow-soft" />
            {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-mist" aria-label="Clear search"><X size={16} /></button>}
          </label>
          <button onClick={() => setFiltersOpen(true)} className="btn btn-secondary h-12 rounded-2xl px-3.5 lg:hidden" aria-label="More filters"><SlidersHorizontal size={18} />{active.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] text-white">{active.length}</span>}</button>
          <div className="hidden rounded-2xl bg-white p-1 shadow-soft ring-1 ring-black/5 sm:flex xl:hidden" role="tablist" aria-label="View">
            {(['list', 'map'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-xl px-3.5 text-[13.5px] font-semibold', view === v ? 'bg-ink text-white' : 'text-slate-600')}>{v === 'list' ? <List size={16} /> : <MapIcon size={16} />}{v === 'list' ? 'List' : 'Map'}</button>)}
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {TOGGLES.map((t) => <button key={t.key} onClick={() => flip(t.key)} aria-pressed={toggles.has(t.key)} className={cn('chip shrink-0', toggles.has(t.key) && 'chip-on')}>{t.label}</button>)}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <select aria-label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="chip pr-2"><option value="">Specialty</option>{ALL_SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select>
            <select aria-label="Hospital type" value={type} onChange={(e) => setType(e.target.value)} className="chip pr-2"><option value="">Type</option>{TYPES.map((s) => <option key={s}>{s}</option>)}</select>
            <select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} className="chip pr-2"><option value="">City</option>{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</select>
            <select aria-label="Distance" value={maxKm} disabled={!location} onChange={(e) => setMaxKm(Number(e.target.value))} className="chip pr-2">{DISTANCES.map((d) => <option key={d} value={d}>{d ? `≤ ${d} km` : 'Distance'}</option>)}</select>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-[14px] text-slate-600" aria-live="polite"><strong className="text-ink tabular">{results.length}</strong> {results.length === 1 ? 'facility' : 'facilities'}</p>
        {active.map((a) => <button key={a.label} onClick={a.clear} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[12.5px] font-semibold text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100">{a.label} <X size={13} aria-label={`Remove ${a.label}`} /></button>)}
        {active.length > 0 && <button onClick={clearAll} className="text-[12.5px] font-semibold text-slate-500 hover:text-ink">Clear all</button>}
        <label className="ml-auto flex items-center gap-2 text-[13px] text-slate-600">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] font-medium text-ink">
            <option value="nearest" disabled={!location}>Nearest</option><option value="soonest">Next available</option><option value="rating">Top rated</option><option value="name">Name</option>
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className={cn(view === 'map' && 'hidden xl:block')}>
          {error ? <ErrorState title="Hospital search failed" body={error.message} onRetry={() => window.location.reload()} /> : !ready || !all ? (
            <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : results.length === 0 ? (
            <EmptyState icon={<Hospital size={22} />} title="No hospitals found" body="Try removing a filter, searching a nearby city, or widening the distance." action={<button onClick={clearAll} className="btn btn-primary btn-sm">Clear filters</button>} />
          ) : (
            <LayoutGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {results.map(({ h, d }) => <HospitalCard key={h.id} h={h} distance={d} highlight={selected === h.id} onHover={setSelected} />)}
                </AnimatePresence>
              </div>
            </LayoutGroup>
          )}
        </div>
        <aside className={cn('xl:block', view === 'list' ? 'hidden' : 'block')} aria-label="Map">
          <div className="xl:sticky" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 190px)' }}>
            <SchematicMap key={nearestCity ?? 'all'} hospitals={results.map((r) => r.h)} user={location} selected={selected} onSelect={setSelected} initialCity={nearestCity} />
          </div>
        </aside>
      </div>
      {/* Mobile map/list switcher */}
      <div className="fixed inset-x-0 z-30 flex justify-center sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}>
        <button onClick={() => setView(view === 'list' ? 'map' : 'list')} className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-white shadow-lift">{view === 'list' ? <><MapIcon size={17} /> Map</> : <><List size={17} /> List</>}</button>
      </div>
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" footer={<div className="flex gap-2"><button onClick={clearAll} className="btn btn-ghost flex-1">Clear all</button><button onClick={() => setFiltersOpen(false)} className="btn btn-primary flex-1">Show {results.length} results</button></div>}>
        {FilterFields}
      </Modal>
    </div>
  )
}
