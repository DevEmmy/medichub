import { ReviewsSection } from '../../components/hospitals/Reviews'
import { FreshnessNote } from '../../components/hospitals/FreshnessNote'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ArrowLeft, BedDouble, CalendarClock, Clock, Droplets, Eye, FlaskConical, Globe, Mail, MapPin, Megaphone, Navigation, Phone, Pill as PillIcon, Scissors, Siren, Stethoscope, Truck, Wind, Baby, UserRound, TriangleAlert, Info, Building2 } from 'lucide-react'
import { useLive, useFirstLoad } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { getHospitalView, type HospitalView } from '../../services/hospitals'
import { HospitalAvatar, HospitalCover } from '../../components/ui/HospitalAvatar'
import { Pill, availLabel, availTone, capLabel, capTone, emergencyLabel, emergencyTone } from '../../components/ui/StatusPill'
import { VerifiedBadge, VerificationPill } from '../../components/hospital-admin/VerificationPill'
import { Skeleton, EmptyState } from '../../components/ui/States'
import { BookingFlow } from '../../components/bookings/BookingFlow'
import { PhotoGallery } from '../../components/hospitals/PhotoGallery'
import { slotWhen } from '../../components/hospitals/HospitalCard'
import { useUserLocation } from '../../contexts/LocationContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { directionsUrl, distanceKm, fmtKm } from '../../utils/geo'
import { relTime, DAY_NAMES } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { ResourceKey } from '../../types'

const RES: { key: ResourceKey; label: string; icon: typeof Wind }[] = [
  { key: 'oxygen', label: 'Oxygen', icon: Wind }, { key: 'pharmacy', label: 'Pharmacy', icon: PillIcon }, { key: 'laboratory', label: 'Laboratory', icon: FlaskConical },
  { key: 'ambulance', label: 'Ambulance', icon: Truck }, { key: 'maternity', label: 'Maternity', icon: Baby }, { key: 'theatre', label: 'Theatre', icon: Scissors }, { key: 'bloodBank', label: 'Blood bank', icon: Droplets },
]
const SEV = { info: { tone: 'bg-white ring-line', icon: Info, ic: 'text-brand-700 bg-brand-50' }, warning: { tone: 'bg-amber-50 ring-amber-100', icon: TriangleAlert, ic: 'text-amber-700 bg-white' }, critical: { tone: 'bg-danger-50 ring-danger-100', icon: Siren, ic: 'text-danger-600 bg-white' } }

function snapshotOf(h: HospitalView) {
  return { emergency: h.status.emergency, overall: h.capacity.overall, ecap: h.capacity.emergency, ...Object.fromEntries(RES.map((r) => [r.key, h.status[r.key]])) } as Record<string, string>
}

function Tile({ label, icon: Icon, children, changed, big }: { label: string; icon: typeof Wind; children: React.ReactNode; changed?: boolean; big?: boolean }) {
  return (
    <motion.div layout animate={changed ? { scale: [1, 1.04, 1] } : {}} transition={{ duration: 0.5 }}
      className={cn('relative rounded-2xl bg-white p-3.5 ring-1 transition-shadow', changed ? 'ring-2 ring-amber-400 shadow-[0_0_0_6px_rgba(217,140,28,.12)]' : 'ring-line', big && 'sm:col-span-2')}>
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500"><Icon size={14} /> {label}</p>
      <div className="mt-2">{children}</div>
      <AnimatePresence>{changed && <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-2.5 top-2.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Updated</motion.span>}</AnimatePresence>
    </motion.div>
  )
}

export default function HospitalProfile() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const ready = useFirstLoad(350)
  const { data: h, remoteTick } = useLive(() => getHospitalView(id), ['hospitals', 'hospital_status', 'hospital_capacity', 'hospital_services', 'hospital_departments', 'hospital_doctors', 'hospital_announcements', 'hospital_slots', 'hospital_reviews'], [id])
  useDocumentTitle(h?.name ?? 'Hospital')
  const { location } = useUserLocation()
  const { hospitalId } = useAuth()
  const { toast } = useToast()
  const [bookOpen, setBookOpen] = useState(params.get('book') === '1')
  const [bookService, setBookService] = useState<string | null>(null)
  const [changed, setChanged] = useState<Set<string>>(new Set())
  const prev = useRef<Record<string, string> | null>(null)

  // WOW #1: detect live status changes pushed from the hospital portal
  useEffect(() => {
    if (!h) return
    const snap = snapshotOf(h)
    if (prev.current && remoteTick > 0) {
      const diff = Object.keys(snap).filter((k) => snap[k] !== prev.current![k])
      if (diff.length) {
        setChanged(new Set(diff))
        const k = diff[0]
        const label = k === 'emergency' ? `Emergency department is now ${emergencyLabel(h.status.emergency).toLowerCase()}` : k === 'overall' ? `Capacity is now ${capLabel(h.capacity.overall).toLowerCase()}` : k === 'ecap' ? `Emergency capacity is now ${capLabel(h.capacity.emergency).toLowerCase()}` : `${RES.find((r) => r.key === k)?.label} is now ${availLabel(h.status[k as ResourceKey]).toLowerCase()}`
        toast('live', 'Live update from the hospital', label)
        const t = setTimeout(() => setChanged(new Set()), 6000)
        prev.current = snap
        return () => clearTimeout(t)
      }
    }
    prev.current = snap
  }, [h, remoteTick, toast])

  const openBook = (sid?: string) => { setBookService(sid ?? null); setBookOpen(true) }
  const closeBook = () => { setBookOpen(false); if (params.get('book')) { params.delete('book'); setParams(params, { replace: true }) } }

  if (!ready) return (
    <div className="container-app py-6"><Skeleton className="h-44 w-full rounded-3xl" /><div className="mt-6 grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div></div>
  )
  if (!h) return (
    <div className="container-app py-10"><EmptyState icon={<Building2 size={22} />} title="Hospital profile unavailable" body="This facility isn't listed, or the link is out of date." action={<Link to="/find" className="btn btn-primary btn-sm">Find care</Link>} /></div>
  )
  const dist = location ? distanceKm(location, h) : null
  const bookable = h.services.filter((s) => s.bookable && s.active)
  const isStaff = hospitalId === h.id

  return (
    <div className="container-app py-4 sm:py-6">
      {isStaff && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white">
          <Eye size={18} className="text-brand-300" /><p className="flex-1 text-[14px]">Patient view of your profile. Changes you make in the portal appear here instantly.</p>
          <Link to="/hospital" className="btn btn-sm bg-white text-ink">Back to portal</Link>
        </div>
      )}
      <Link to="/find" className="inline-flex items-center gap-1.5 rounded-lg py-1 text-[14px] font-medium text-slate-600 hover:text-ink"><ArrowLeft size={16} /> All hospitals</Link>

      <section className="card mt-3 overflow-hidden">
        <HospitalCover hue={h.hue} seed={h.id} cover={h.cover ?? h.photos?.[0]?.src} className="h-48 sm:h-72" />
        <div className="px-5 pb-5 sm:px-7">
          <div className="relative -mt-10 flex flex-col gap-4 sm:-mt-12">
            <HospitalAvatar name={h.name} hue={h.hue} logo={h.logo} size={88} className="rounded-2xl ring-4 ring-white" />
            <div className="min-w-0 flex-1">
              <h1 className="text-[26px] font-semibold leading-tight sm:text-[32px]">{h.name}{' '}{h.verification === 'verified' ? <VerifiedBadge size={22} className="-mt-1 inline align-middle" /> : h.publicRecord ? <span className="inline-block rounded-md bg-sky-50 px-2 py-0.5 align-middle text-[12px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">{h.ownership === 'Private' ? 'Private hospital' : h.ownership === 'State' ? 'State hospital' : 'Federal hospital'}</span> : <span className="inline-block align-middle"><VerificationPill v={h.verification} size="sm" /></span>}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate-600">
                <span>{h.type} hospital</span><span className="flex items-center gap-1"><MapPin size={14} />{h.area}, {h.city}</span>{dist !== null && <span className="font-semibold text-ink">{fmtKm(dist)} away</span>}
                <span className={cn('font-semibold', h.openNow ? 'text-brand-700' : 'text-danger-600')}>{h.openNow ? (h.is24h ? 'Open 24 hours' : 'Open now') : 'Closed now'}</span>
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button onClick={() => openBook()} disabled={!bookable.length} className="btn btn-primary col-span-2 sm:col-span-1 sm:px-6"><CalendarClock size={17} /> Book a slot</button>
            {h.emergencyPhone && h.status.emergency !== 'closed' && <a href={`tel:${h.emergencyPhone.replace(/\s/g, '')}`} className="btn col-span-2 bg-danger-600 text-white hover:bg-danger-700 sm:col-span-1" data-testid="call-emergency-line"><Siren size={16} /> Call emergency unit</a>}
            {h.phone && <a href={`tel:${h.phone.replace(/\s/g, '')}`} className="btn btn-secondary"><Phone size={16} /> Call</a>}
            <a href={directionsUrl(h.lat, h.lng, location)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"><Navigation size={16} /> Directions</a>
            {h.status.emergency !== 'closed' && <a href={directionsUrl(h.lat, h.lng, location)} target="_blank" rel="noopener noreferrer" className="btn col-span-2 bg-danger-50 text-danger-700 ring-1 ring-danger-100 hover:bg-danger-100 sm:col-span-1"><Siren size={16} /> Emergency route</a>}
          </div>
        </div>
      </section>

      {h.publicRecord && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100 sm:flex-row sm:items-center">
          <Info size={19} className="shrink-0 text-sky-700" />
          <p className="flex-1 text-[13.5px] leading-relaxed text-sky-900"><strong>Listed from public records.</strong> This hospital hasn't joined Medic Hub yet. Live status, capacity and slots on this page are demo data and are not reported by the hospital. Bookings here are demo bookings.</p>
          <Link to="/signup?role=hospital" className="btn btn-sm shrink-0 bg-white text-ink ring-1 ring-sky-100">Work here? Claim this listing</Link>
        </div>
      )}

      {h.announcements.length > 0 && (
        <section aria-labelledby="ann-h" className="mt-5 space-y-2">
          <h2 id="ann-h" className="sr-only">Announcements</h2>
          <AnimatePresence initial={false}>
            {h.announcements.slice(0, 3).map((a) => { const s = SEV[a.severity]; return (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className={cn('flex gap-3 rounded-2xl p-4 ring-1', s.tone)}>
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', s.ic)}><s.icon size={17} /></span>
                <div className="min-w-0"><p className="text-[14.5px] font-semibold text-ink">{a.title}</p>{a.body && <p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-600">{a.body}</p>}<p className="mt-1 flex items-center gap-1 text-[11.5px] text-slate-500"><Megaphone size={11} /> Posted {relTime(a.createdAt)}</p></div>
              </motion.div>
            ) })}
          </AnimatePresence>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="live-h">
            <div className="flex items-center justify-between">
              <h2 id="live-h" className="flex items-center gap-2 text-[20px] font-semibold">Live status</h2>
              <span className="flex items-center gap-2 text-[12.5px] font-medium text-slate-500">{h.publicRecord && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-amber-700">Demo</span>}<span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulseRing rounded-full bg-brand-500" /><span className="relative h-2 w-2 rounded-full bg-brand-500" /></span>Updated {relTime(h.status.updatedAt > h.capacity.updatedAt ? h.status.updatedAt : h.capacity.updatedAt)} {h.publicRecord ? '' : ' by hospital staff'}</span>
            </div>
            <FreshnessNote h={h} variant="banner" className="mt-3" />
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Tile label="Emergency department" icon={Siren} changed={changed.has('emergency')} big><Pill tone={emergencyTone(h.status.emergency)} pulse={h.status.emergency !== 'closed'}>{emergencyLabel(h.status.emergency)}</Pill><span className="ml-2 text-[12px] text-slate-500">Emergency capacity: <strong className={cn(changed.has('ecap') && 'text-amber-700')}>{capLabel(h.capacity.emergency)}</strong></span></Tile>
              <Tile label="Overall capacity" icon={Activity} changed={changed.has('overall')} big><Pill tone={capTone(h.capacity.overall)}>{capLabel(h.capacity.overall)}</Pill><span className="ml-2 text-[12px] text-slate-500 tabular"><BedDouble size={12} className="-mt-0.5 mr-1 inline" />{h.capacity.bedsAvailable} of {h.capacity.bedsTotal} beds free</span></Tile>
              {RES.map((r) => <Tile key={r.key} label={r.label} icon={r.icon} changed={changed.has(r.key)}><Pill tone={availTone(h.status[r.key])}>{availLabel(h.status[r.key])}</Pill></Tile>)}
            </div>
            <p className="mt-2 text-[12px] text-slate-500">{h.publicRecord ? 'Demo status for illustration. This hospital does not report to Medic Hub yet.' : 'Status is reported by the hospital and can change quickly.'} Call ahead if you're travelling far. In an emergency, call the hospital's emergency line or 112.</p>
          </section>

          <PhotoGallery hue={h.hue} seed={h.id} cover={h.cover} photos={h.photos} name={h.name} note={h.publicRecord ? 'Illustrative photos, not of this hospital.' : undefined} />
          <ReviewsSection hospitalId={h.id} publicRecord={h.publicRecord} />

          <section aria-labelledby="svc-h">
            <h2 id="svc-h" className="text-[20px] font-semibold">Services</h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
              {h.services.filter((s) => s.active).map((s) => {
                const dep = h.departments.find((d) => d.id === s.departmentId)
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mist text-brand-700"><Stethoscope size={16} /></span>
                    <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold text-ink">{s.name}</p><p className="text-[12.5px] text-slate-500">{dep?.name ?? s.category}{s.fee && !h.publicRecord ? ` · from ₦${s.fee.toLocaleString('en-NG')}` : ''}</p></div>
                    {s.bookable ? <button onClick={() => openBook(s.id)} className="btn btn-secondary btn-sm">Book</button> : <span className="text-[12.5px] font-medium text-slate-500">Walk-in</span>}
                  </li>
                )
              })}
              {h.services.length === 0 && <li className="px-4 py-6 text-center text-[14px] text-slate-500">No services listed yet.</li>}
            </ul>
          </section>

          <section aria-labelledby="dep-h" className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 id="dep-h" className="text-[20px] font-semibold">Departments</h2>
              <ul className="mt-3 space-y-2">{h.departments.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-line"><span className="text-[14px] font-medium text-ink">{d.name}</span><Pill tone={emergencyTone(d.status)} size="sm">{emergencyLabel(d.status)}</Pill></li>
              ))}</ul>
            </div>
            {h.doctors.length > 0 && <div>
              <h2 className="text-[20px] font-semibold">Doctors</h2>
              <ul className="mt-3 space-y-2">{h.doctors.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700"><UserRound size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{d.name}</span><span className="block text-[12.5px] text-slate-500">{d.specialty}</span></span><span className={cn('text-[12px] font-medium', d.available ? 'text-brand-700' : 'text-slate-400')}>{d.available ? 'Available' : 'Away'}</span></li>
              ))}</ul>
            </div>}
          </section>

          <section aria-labelledby="about-h">
            <h2 id="about-h" className="text-[20px] font-semibold">About</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-700">{h.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{h.facilities.map((f) => <span key={f} className="rounded-full bg-white px-3 py-1 text-[12.5px] font-medium text-slate-700 ring-1 ring-line">{f}</span>)}</div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-slate-500"><CalendarClock size={15} /> Next available appointment</p>
            {h.nextSlot ? (<><p className="mt-1.5 font-display text-[22px] font-semibold text-ink">{slotWhen(h.nextSlot)}</p><p className="text-[13px] text-slate-500">{h.nextSlot.serviceName}</p><button onClick={() => openBook(h.nextSlot!.serviceId)} className="btn btn-brand mt-4 w-full">Book this slot</button></>) : <p className="mt-1.5 text-[14px] text-slate-600">No appointment slots in the next two weeks. Call the hospital.</p>}
          </div>
          <div className="card p-5">
            <h2 className="text-[16px] font-semibold">Contact</h2>
            <ul className="mt-3 space-y-3 text-[14px]">
              <li className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-slate-400" /><span>{h.address}, {h.city}, {h.state}</span></li>
              {h.phone ? <li className="flex gap-3"><Phone size={17} className="mt-0.5 shrink-0 text-slate-400" /><a href={`tel:${h.phone.replace(/\s/g, '')}`} className="font-medium text-ink hover:underline">{h.phone}</a></li> : <li className="flex gap-3"><Phone size={17} className="mt-0.5 shrink-0 text-slate-400" /><span className="text-slate-600">Phone numbers aren't listed until the hospital joins Medic Hub. In an emergency, call <strong className="text-ink">112</strong>.</span></li>}
              {h.emergencyPhone && <li className="flex gap-3"><Siren size={17} className="mt-0.5 shrink-0 text-danger-500" /><span>Emergency line: <a href={`tel:${h.emergencyPhone.replace(/\s/g, '')}`} className="font-medium text-ink hover:underline">{h.emergencyPhone}</a></span></li>}
              {h.email && <li className="flex gap-3"><Mail size={17} className="mt-0.5 shrink-0 text-slate-400" /><span className="break-all">{h.email}</span></li>}
              {h.publicRecord && <li className="flex gap-3"><Globe size={17} className="mt-0.5 shrink-0 text-slate-400" /><a href="https://health.gov.ng" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">Federal Ministry of Health</a></li>}
              {h.website && <li className="flex gap-3"><Globe size={17} className="mt-0.5 shrink-0 text-slate-400" /><a href={h.website} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-brand-700 hover:underline">{h.website.replace(/^https?:\/\//, '')}</a></li>}
              {h.socials.map((s) => <li key={s.url} className="flex gap-3"><Globe size={17} className="mt-0.5 shrink-0 text-slate-400" /><a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">{s.label}</a></li>)}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold"><Clock size={16} /> Opening hours</h2>
            {h.is24h ? <p className="mt-2 text-[14px] text-slate-700">Open 24 hours, every day</p> : (
              <ul className="mt-3 space-y-1.5 text-[13.5px]">{[1, 2, 3, 4, 5, 6, 0].map((d) => { const x = h.hours[d]; return <li key={d} className={cn('flex justify-between', new Date().getDay() === d && 'font-semibold text-ink')}><span>{DAY_NAMES[d]}</span><span className="tabular">{x.closed ? 'Closed' : `${x.open} – ${x.close}`}</span></li> })}</ul>
            )}
          </div>
        </aside>
      </div>
      <BookingFlow h={h} open={bookOpen} onClose={closeBook} initialService={bookService} />
    </div>
  )
}
