import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, ArrowRight, CalendarPlus, HeartPulse, Hospital, MapPin, Search, ShieldPlus, Siren, QrCode, Salad, Sparkles, Wind } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useEmergency } from '../../contexts/EmergencyContext'
import { useUserLocation } from '../../contexts/LocationContext'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { myBookings, isUpcoming } from '../../services/bookings'
import { listPublicHospitals } from '../../services/hospitals'
import { myHealthProfile } from '../../services/health'
import { fmtDate, fmtTime, today } from '../../utils/date'
import { distanceKm, fmtKm } from '../../utils/geo'
import { BookingStatusPill, Pill, emergencyLabel, emergencyTone, capLabel, capTone } from '../../components/ui/StatusPill'
import { HospitalAvatar, HospitalCover } from '../../components/ui/HospitalAvatar'
import { VerifiedBadge } from '../../components/hospital-admin/VerificationPill'
import { slotWhen } from '../../components/hospitals/HospitalCard'
import { MEALS } from '../../data/wellness'
import { useT } from '../../i18n/LanguageContext'
import { LocationPicker } from '../../components/hospitals/LocationBar'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } }

export default function Home() {
  useDocumentTitle('Home')
  const { user } = useAuth()
  const { t } = useT()
  const h = new Date().getHours()
  const greet = t(h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : 'greet.evening')
  const nav = useNavigate()
  const { enterEmergency } = useEmergency()
  const { location } = useUserLocation()
  const [q, setQ] = useState('')
  const [pickLoc, setPickLoc] = useState(false)
  const { data: bookings = [] } = useLive(myBookings, ['bookings', 'hospitals', 'hospital_services'])
  const { data: hospitals = [] } = useLive(listPublicHospitals, ['hospitals', 'hospital_status', 'hospital_capacity', 'hospital_slots'])
  const { data: hp } = useLive(myHealthProfile, ['health_profiles'])
  const upcoming = bookings.filter(isUpcoming)[0]
  const upHospital = upcoming ? hospitals.find((h) => h.id === upcoming.hospitalId) : undefined
  const nearby = useMemo(() => hospitals.map((h) => ({ h, d: location ? distanceKm(location, h) : null }))
    .sort((a, b) => (a.d !== null && b.d !== null ? a.d - b.d : (a.h.nextSlot?.date ?? 'z').localeCompare(b.h.nextSlot?.date ?? 'z'))).slice(0, 6), [hospitals, location])
  const meal = MEALS[new Date().getDate() % MEALS.length]
  const submit = (e: FormEvent) => { e.preventDefault(); nav(`/find${q ? `?q=${encodeURIComponent(q)}` : ''}`) }
  const vaultEmpty = hp && !hp.bloodGroup && !hp.genotype

  return (
    <motion.div className="container-app py-6 sm:py-10" variants={stagger} initial="hidden" animate="show">
      <motion.div variants={item}>
        <h1 className="text-[32px] font-semibold leading-tight sm:text-[42px]">{greet}, {user?.name.split(' ')[0]}</h1>
        <p className="mt-1 text-[16px] text-slate-600">{t('home.help')}</p>
      </motion.div>

      <motion.form variants={item} onSubmit={submit} className="relative mt-6" role="search">
        <label htmlFor="home-search" className="sr-only">Find a hospital, doctor or service</label>
        <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('home.search')} className="input h-[60px] rounded-2xl pl-14 pr-28 text-[16px] shadow-soft" />
        <button className="btn btn-primary absolute right-2 top-1/2 h-11 -translate-y-1/2 rounded-xl px-4">{t('home.searchBtn')}</button>
      </motion.form>

      <motion.div variants={item} className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: t('home.findCare'), sub: t('home.findCareSub'), icon: Hospital, onClick: () => nav('/find'), tone: 'bg-white', ic: 'bg-brand-50 text-brand-700' },
          { label: t('home.book'), sub: t('home.bookSub'), icon: CalendarPlus, onClick: () => nav('/find?appt=1'), tone: 'bg-white', ic: 'bg-amber-50 text-amber-700' },
          { label: t('home.emergency'), sub: t('home.emergencySub'), icon: Siren, onClick: (e: React.MouseEvent) => enterEmergency(e), tone: 'bg-danger-600 text-white', ic: 'bg-white/15 text-white' },
          { label: t('home.vault'), sub: t('home.vaultSub'), icon: ShieldPlus, onClick: () => nav('/app/health'), tone: 'bg-white', ic: 'bg-sky-50 text-sky-700' },
        ].map((a) => (
          <button key={a.label} onClick={a.onClick} className={`flex min-h-[112px] flex-col justify-between rounded-3xl p-4 text-left shadow-soft ring-1 ring-black/5 transition hover:-translate-y-0.5 active:scale-[0.98] ${a.tone}`}>
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${a.ic}`}><a.icon size={21} /></span>
            <span><span className="block font-display text-[17px] font-semibold leading-tight">{a.label}</span><span className="block text-[12.5px] opacity-70">{a.sub}</span></span>
          </button>
        ))}
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <motion.section variants={item} aria-labelledby="up-h">
            <div className="flex items-center justify-between"><h2 id="up-h" className="text-[20px] font-semibold">Upcoming booking</h2><Link to="/app/bookings" className="text-[13.5px] font-semibold text-brand-700">All bookings</Link></div>
            {upcoming ? (
              <div className="mt-3 overflow-hidden rounded-3xl bg-ink text-white shadow-lift">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><BookingStatusPill status={upcoming.status} size="sm" /><span className="font-mono text-[12px] tracking-wider text-white/60">{upcoming.ref}</span></div>
                    <p className="mt-3 font-display text-[22px] font-semibold leading-tight">{upcoming.serviceName}</p>
                    <p className="text-[14px] text-white/70">{upcoming.hospitalName}</p>
                    <p className="mt-3 text-[15px] font-semibold">{upcoming.date === today() ? 'Today' : fmtDate(upcoming.date)} · {fmtTime(upcoming.time)}</p>
                  </div>
                  <Link to={`/app/bookings/${upcoming.id}`} className="btn bg-white text-ink hover:bg-brand-50"><QrCode size={17} /> Show pass</Link>
                </div>
                {upHospital && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/[0.04] px-5 py-3 text-[12.5px] text-white/70">
                    <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulseRing rounded-full bg-brand-300" /><span className="relative h-2 w-2 rounded-full bg-brand-300" /></span> Live at the hospital:
                    <Pill tone={emergencyTone(upHospital.status.emergency)} size="sm">Emergency {emergencyLabel(upHospital.status.emergency).toLowerCase()}</Pill>
                    <Pill tone={capTone(upHospital.capacity.overall)} size="sm">Capacity {capLabel(upHospital.capacity.overall).toLowerCase()}</Pill>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-start gap-3 rounded-3xl border border-dashed border-line bg-white/60 p-5 sm:flex-row sm:items-center">
                <p className="flex-1 text-[14.5px] text-slate-600">No upcoming appointments. Book a slot and your pass will appear here.</p>
                <Link to="/find?appt=1" className="btn btn-primary btn-sm">Book a slot</Link>
              </div>
            )}
          </motion.section>

          <motion.section variants={item} aria-labelledby="near-h">
            <div className="flex items-center justify-between gap-3">
              <h2 id="near-h" className="text-[20px] font-semibold">{location ? 'Nearby hospitals' : 'Hospitals with open slots'}</h2>
              <button onClick={() => setPickLoc(true)} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-700"><MapPin size={14} />{location ? location.label : 'Set location'}</button>
            </div>
            <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
              {nearby.map(({ h, d }) => (
                <Link key={h.id} to={`/hospitals/${h.id}`} className="card w-[78%] shrink-0 snap-start overflow-hidden transition hover:-translate-y-0.5 sm:w-auto">
                  <HospitalCover hue={h.hue} seed={h.id} cover={h.cover} className="h-28" still />
                  <div className="p-4 pt-3">
                  <div className="flex items-center gap-3">
                    <HospitalAvatar name={h.name} hue={h.hue} logo={h.logo} size={44} />
                    <div className="min-w-0 flex-1"><p className="flex items-center gap-1 truncate text-[15px] font-semibold text-ink"><span className="truncate">{h.name}</span>{h.verification === 'verified' && <VerifiedBadge size={14} />}</p><p className="text-[12.5px] text-slate-500">{h.area}{d !== null ? ` · ${fmtKm(d)}` : ''}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5"><Pill tone={emergencyTone(h.status.emergency)} size="sm">ER {emergencyLabel(h.status.emergency).toLowerCase()}</Pill><Pill tone={capTone(h.capacity.overall)} size="sm">{capLabel(h.capacity.overall)} capacity</Pill></div>
                  <p className="mt-3 text-[12.5px] text-slate-600">{h.nextSlot ? <>Next slot <strong className="text-ink">{slotWhen(h.nextSlot)}</strong></> : 'No open slots this week'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        </div>

        <div className="space-y-6">
          <motion.section variants={item} aria-labelledby="snap-h" className="card p-5">
            <div className="flex items-center justify-between"><h2 id="snap-h" className="flex items-center gap-2 text-[17px] font-semibold"><HeartPulse size={18} className="text-danger-600" /> Health snapshot</h2><Link to="/app/health" className="text-[13px] font-semibold text-brand-700">Open vault</Link></div>
            {vaultEmpty ? (
              <div className="mt-3 rounded-2xl bg-brand-50 p-4"><p className="text-[14px] text-brand-900">Add your blood group, genotype and allergies so they're ready in an emergency.</p><Link to="/app/health" className="btn btn-brand btn-sm mt-3">Complete your vault</Link></div>
            ) : hp && (
              <dl className="mt-4 grid grid-cols-2 gap-2">
                {[['Blood group', hp.bloodGroup || '—'], ['Genotype', hp.genotype || '—'], ['Allergies', hp.allergies.join(', ') || 'None'], ['Conditions', hp.conditions.join(', ') || 'None']].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-canvas p-3"><dt className="text-[11.5px] font-medium text-slate-500">{k}</dt><dd className="mt-0.5 truncate font-display text-[17px] font-semibold text-ink" title={v}>{v}</dd></div>
                ))}
              </dl>
            )}
          </motion.section>
          <motion.section variants={item} aria-labelledby="well-h" className="card overflow-hidden">
            <div className="p-5 pb-3"><h2 id="well-h" className="flex items-center gap-2 text-[17px] font-semibold"><Sparkles size={17} className="text-amber-600" /> Today's wellness pick</h2></div>
            <div className="mx-5 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, hsl(${meal.hue} 50% 92%), hsl(${meal.hue + 25} 45% 86%))` }}>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700"><Salad size={14} /> {meal.mealType} · {meal.calories} kcal</p>
              <p className="mt-1 font-display text-[20px] font-semibold text-ink">{meal.name}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{meal.note}</p>
            </div>
            <Link to="/wellness" className="flex items-center justify-between px-5 py-4 text-[13.5px] font-semibold text-brand-700 hover:bg-canvas">More meals and exercise <ArrowRight size={16} /></Link>
          </motion.section>
          <motion.div variants={item}>
            <Link to="/assistant" className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-white shadow-lift transition hover:-translate-y-0.5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-brand-300"><Bot size={20} /></span>
              <span className="flex-1"><span className="block text-[15px] font-semibold">{t('nav.assistant')}</span><span className="block text-[12.5px] text-white/60">English · Pidgin · Yorùbá · Hausa · Igbo</span></span><ArrowRight size={18} className="text-white/50" />
            </Link>
          </motion.div>
          <motion.div variants={item}>
            <Link to="/first-aid" className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-black/5 hover:-translate-y-0.5 transition">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger-50 text-danger-600"><Wind size={20} /></span>
              <span className="flex-1"><span className="block text-[15px] font-semibold">First aid, step by step</span><span className="block text-[12.5px] text-slate-500">Short videos from the British Red Cross</span></span><ArrowRight size={18} className="text-slate-400" />
            </Link>
          </motion.div>
        </div>
      </div>
      <LocationPicker open={pickLoc} onClose={() => setPickLoc(false)} />
    </motion.div>
  )
}
