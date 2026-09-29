import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, BadgeCheck, CalendarCheck, Clock, HeartPulse, MapPin, Siren, Activity, ShieldCheck, ScanLine, Building2, UserRound, Stethoscope, Wind, PlayCircle, Megaphone } from 'lucide-react'
import { Logo } from '../../components/ui/Logo'
import { PHOTOS } from '../../data/photos'
import { Pill } from '../../components/ui/StatusPill'
import { QRCode } from '../../components/ui/QRCode'
import { Spinner } from '../../components/ui/States'
import { useAuth, homeFor } from '../../contexts/AuthContext'
import { useEmergency } from '../../contexts/EmergencyContext'
import { useToast } from '../../contexts/ToastContext'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../data/seed'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLive } from '../../hooks/useLive'
import { listPublicHospitals } from '../../services/hospitals'

type Lvl = 'open' | 'busy'
function LiveDemoCard() {
  // Self-running illustration of a status change arriving
  const [lvl, setLvl] = useState<Lvl>('open')
  useEffect(() => { const t = setInterval(() => setLvl((l) => (l === 'open' ? 'busy' : 'open')), 3200); return () => clearInterval(t) }, [])
  return (
    <div className="card w-full overflow-hidden p-0">
      <div className="relative h-32 overflow-hidden bg-ink p-4">
        <img src={PHOTOS.ext1} alt="" className="absolute inset-0 h-full w-full object-cover motion-safe:animate-[kenburns_18s_ease-in-out_infinite_alternate]" /><div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/10" />
        <div className="relative flex items-center gap-2 text-[12px] font-medium text-white/90"><span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulseRing rounded-full bg-brand-300" /><span className="relative h-2 w-2 rounded-full bg-brand-300" /></span> Live · updated just now</div>
      </div>
      <div className="relative -mt-7 px-4 pb-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white font-display text-lg font-semibold text-ink shadow-soft ring-1 ring-black/5">LC</div>
        <div className="mt-2"><p className="flex items-center gap-1 font-display text-[16px] font-semibold text-ink">Lagoon Crest Specialist <BadgeCheck size={15} className="fill-brand-600 text-white" /></p><p className="text-[12px] text-slate-500">Lekki Phase 1 · 2.4 km</p></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-canvas p-3">
            <p className="text-[11px] font-medium text-slate-500">Emergency</p>
            <AnimatePresence mode="wait">
              <motion.div key={lvl} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} className="mt-1">
                <Pill tone={lvl === 'open' ? 'good' : 'warn'} pulse>{lvl === 'open' ? 'Open' : 'Busy'}</Pill>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="rounded-xl bg-canvas p-3"><p className="text-[11px] font-medium text-slate-500">Oxygen</p><div className="mt-1"><Pill tone="good">Available</Pill></div></div>
          <div className="rounded-xl bg-canvas p-3"><p className="text-[11px] font-medium text-slate-500">Capacity</p><div className="mt-1"><Pill tone="warn">Moderate</Pill></div></div>
          <div className="rounded-xl bg-canvas p-3"><p className="text-[11px] font-medium text-slate-500">Next slot</p><p className="mt-1 text-[13px] font-semibold text-ink">11:30 AM</p></div>
        </div>
      </div>
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_40%,rgba(63,168,129,.25),transparent_70%)]" aria-hidden />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="relative z-10 w-[88%] sm:w-[78%]">
        <LiveDemoCard />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 24, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 3 }} transition={{ delay: 0.25, duration: 0.55 }}
        className="relative z-20 -mt-24 ml-auto w-[62%] rounded-3xl bg-ink p-4 text-white shadow-lift sm:-mt-28 sm:w-[52%]">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-200"><span>Medic Hub</span><span>Booking pass</span></div>
        <p className="mt-3 font-display text-[15px] font-semibold leading-tight">General consultation</p>
        <p className="text-[12px] text-white/60">Tomorrow · 10:00 AM</p>
        <div className="my-3 border-t border-dashed border-white/20" />
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white p-1.5"><QRCode value="MEDICHUB:MED-7X82K9:demo" size={56} /></div>
          <div><p className="text-[10px] uppercase tracking-wider text-white/50">Reference</p><p className="font-mono text-[14px] font-semibold tracking-wider">MED-7X82K9</p></div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }} className="relative z-30 -mt-10 flex w-fit items-center gap-2 rounded-full bg-white py-2 pl-2 pr-4 text-[13px] font-medium text-ink shadow-lift ring-1 ring-black/5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-amber-700"><Megaphone size={14} /></span> Additional slots opened today
      </motion.div>
    </div>
  )
}

export default function Landing() {
  useDocumentTitle('')
  const { user, hospitalId, signIn } = useAuth()
  const { enterEmergency } = useEmergency()
  const { toast } = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const { data: hospitals = [] } = useLive(listPublicHospitals, ['hospitals'])
  const cities = new Set(hospitals.map((h) => h.city)).size

  const demo = async (key: keyof typeof DEMO_ACCOUNTS) => {
    setBusy(key)
    try {
      const u = await signIn(DEMO_ACCOUNTS[key].email, DEMO_PASSWORD)
      toast('success', `Signed in as ${DEMO_ACCOUNTS[key].label.toLowerCase()}`, DEMO_ACCOUNTS[key].name)
      nav(homeFor(u.role, u.role === 'hospital' ? 'h_lagooncrest' : null))
    } catch (e) { toast('error', 'Could not sign in', (e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="min-h-[100dvh] overflow-x-clip">
      <header className="container-app flex h-[72px] items-center gap-4">
        <Logo />
        <nav className="ml-8 hidden items-center gap-6 text-[14px] font-medium text-slate-600 md:flex" aria-label="Main">
          <Link to="/find" className="hover:text-ink">Find care</Link><Link to="/first-aid" className="hover:text-ink">First aid</Link><Link to="/triage" className="hover:text-ink">Check symptoms</Link><a href="#hospitals" className="hover:text-ink">For hospitals</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? <Link to={homeFor(user.role, hospitalId)} className="btn btn-primary btn-sm">Open Medic Hub <ArrowRight size={15} /></Link> : (<><Link to="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">Sign in</Link><Link to="/signup" className="btn btn-primary btn-sm">Get started</Link></>)}
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="hero-grid absolute inset-0 -z-10 [mask-image:radial-gradient(70%_60%_at_50%_30%,#000,transparent)]" aria-hidden />
        <div className="container-app grid items-center gap-12 pb-16 pt-8 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24">
          <div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 shadow-soft ring-1 ring-black/5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Live hospital availability across {cities || 10} Nigerian cities
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6 text-[44px] font-semibold leading-[1.02] sm:text-[60px] lg:text-[68px]">
              Healthcare,<br /><span className="text-brand-600">without the guesswork.</span>
            </motion.h1>
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-6 space-y-2 text-[17px] text-slate-600 sm:text-[18px]">
              <li className="flex items-center gap-3"><MapPin size={18} className="text-brand-600" /> Find care near you.</li>
              <li className="flex items-center gap-3"><Activity size={18} className="text-brand-600" /> Know what's available right now.</li>
              <li className="flex items-center gap-3"><CalendarCheck size={18} className="text-brand-600" /> Reserve your place.</li>
              <li className="flex items-center gap-3"><Siren size={18} className="text-danger-600" /> Get emergency guidance when every second matters.</li>
            </motion.ul>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={user?.role === 'patient' ? '/app' : '/find'} className="btn btn-primary h-14 px-6 text-[16px]">Find care <ArrowRight size={18} /></Link>
              <button onClick={(e) => enterEmergency(e)} className="btn h-14 bg-danger-50 px-6 text-[16px] text-danger-700 ring-1 ring-danger-100 hover:bg-danger-100"><Siren size={18} /> Emergency help</button>
            </motion.div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Photo strip */}
      <section className="container-app pb-14" aria-label="Facilities on Medic Hub">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[[PHOTOS.ext2, 'Emergency-ready hospitals'], [PHOTOS.reception, 'See before you go'], [PHOTOS.ward, 'Live bed availability'], [PHOTOS.lab, 'Lab & pharmacy status']].map(([src, label], k) => (
            <motion.figure key={label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.06 }} className={`group relative overflow-hidden rounded-3xl ${k === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto' : 'aspect-[4/3]'}`}>
              <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
              <figcaption className="absolute bottom-3 left-4 right-4 font-display text-[15px] font-semibold text-white sm:text-[17px]">{label}</figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* Demo access */}
      <section className="container-app" aria-labelledby="demo-h">
        <div className="rounded-[28px] bg-ink p-6 text-white sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-300">Demo mode</p><h2 id="demo-h" className="mt-1.5 text-[26px] font-semibold text-white">Step into any side of Medic Hub</h2></div>
            <p className="max-w-sm text-[14px] text-white/60">Tip: open the hospital in one tab and the patient in another. Status changes appear instantly.</p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {([['patient', UserRound, 'Find a hospital, book a slot, get a QR pass, open your Health Vault.'], ['hospital', Building2, 'Change emergency status, manage capacity and slots, check patients in.'], ['admin', ShieldCheck, 'Review and verify hospitals waiting to join the platform.']] as const).map(([k, Icon, text]) => (
              <button key={k} onClick={() => demo(k)} disabled={!!busy} className="group flex flex-col rounded-2xl bg-white/[0.06] p-5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.1]">
                <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Icon size={20} /></span>{busy === k ? <Spinner /> : <ArrowRight size={18} className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />}</div>
                <p className="mt-4 font-display text-[18px] font-semibold">{DEMO_ACCOUNTS[k].label}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-white/60">{text}</p>
                <p className="mt-4 font-mono text-[11.5px] text-white/40">{DEMO_ACCOUNTS[k].email} · {DEMO_PASSWORD}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Problem → solution */}
      <section className="container-app py-20" aria-labelledby="how-h">
        <h2 id="how-h" className="max-w-2xl text-[32px] font-semibold leading-tight sm:text-[40px]">From “I need medical help” to knowing exactly where to go.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: MapPin, t: 'Nearest right hospital', d: 'Filter by specialty, open now, emergency and oxygen. Distance from where you are.' },
            { icon: Activity, t: 'Live from the hospital', d: 'Emergency status, capacity, oxygen and pharmacy, updated by hospital staff.' },
            { icon: CalendarCheck, t: 'Reserve your place', d: 'Pick a service and a time. Get a QR pass the front desk can scan.' },
            { icon: HeartPulse, t: 'Ready for emergencies', d: 'Call 112, find emergency care and follow first-aid steps with video.' },
          ].map((f) => (
            <div key={f.t} className="card-flat p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><f.icon size={20} /></span>
              <h3 className="mt-4 text-[17px] font-semibold">{f.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Emergency band */}
      <section className="container-app" aria-labelledby="em-h">
        <div className="grid gap-8 overflow-hidden rounded-[28px] bg-danger-50 p-6 ring-1 ring-danger-100 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-danger-700"><Siren size={16} /> Emergency mode</p>
            <h2 id="em-h" className="mt-3 text-[30px] font-semibold leading-tight">One tap to a calmer, focused screen.</h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-700">Large buttons, plain steps and short videos from the British Red Cross and St John Ambulance. The first thing you see is <strong>Call 112</strong>, Nigeria's national emergency number.</p>
            <div className="mt-6 flex flex-wrap gap-3"><button onClick={(e) => enterEmergency(e)} className="btn btn-danger"><Siren size={17} /> Open emergency mode</button><Link to="/triage" className="btn btn-secondary"><Stethoscope size={17} /> Check symptoms</Link></div>
          </div>
          <ul className="grid grid-cols-2 gap-2.5 self-center">
            {[['Severe bleeding', 'severe-bleeding'], ['Chest pain', 'chest-pain'], ['Choking', 'choking'], ['Difficulty breathing', 'difficulty-breathing'], ['Stroke symptoms', 'stroke'], ['Burn', 'burn']].map(([t, s]) => (
              <li key={s}><Link to={`/emergency/${s}`} className="flex min-h-[56px] items-center gap-2 rounded-2xl bg-white px-4 text-[14px] font-semibold text-ink shadow-soft transition hover:-translate-y-0.5">{s === 'difficulty-breathing' ? <Wind size={17} className="text-danger-600" /> : <PlayCircle size={17} className="text-danger-600" />}{t}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* Hospitals */}
      <section id="hospitals" className="container-app py-20" aria-labelledby="hosp-h">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">For hospitals</p>
            <h2 id="hosp-h" className="mt-2 text-[32px] font-semibold leading-tight sm:text-[38px]">An operations portal, not just a listing.</h2>
            <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed text-slate-600">Update emergency status and capacity in a tap. Manage services, departments and appointment slots. See today's queue and check patients in by QR. Verified facilities get the Medic Hub badge.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/signup?role=hospital" className="btn btn-primary">Register your facility</Link><button onClick={() => demo('hospital')} className="btn btn-secondary">Try the hospital demo</button></div>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between"><p className="font-display text-[15px] font-semibold">Today</p><p className="text-[12px] text-slate-500">Lagoon Crest · Ops</p></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[['Bookings', '12'], ['Checked in', '4'], ['Pending', '1']].map(([l, v]) => <div key={l} className="rounded-xl bg-canvas p-3"><p className="font-display text-[24px] font-semibold text-ink tabular">{v}</p><p className="text-[11.5px] text-slate-500">{l}</p></div>)}
            </div>
            <div className="mt-4 space-y-2">
              {[['Emergency department', 'Open', 'good'], ['Oxygen', 'Limited', 'warn'], ['Overall capacity', 'Moderate', 'warn']].map(([l, v, t]) => (
                <div key={l} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5"><span className="text-[13.5px] font-medium">{l}</span><Pill tone={t as 'good'}>{v}</Pill></div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800"><ScanLine size={16} /> MED-7X82K9 checked in · General consultation</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white/60">
        <div className="container-app flex flex-col gap-4 py-10 text-[13px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><Logo compact /><span>Medic Hub · Hackathon build. Federal hospitals are listed from public records; their live status is demo data.</span></div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>Team Medic Hub · <a href="mailto:medichubnigeria@gmail.com" className="font-medium text-ink hover:underline">medichubnigeria@gmail.com</a> · <span className="select-all">07042744090</span></span><span className="flex items-center gap-1.5"><Clock size={14} /> In an emergency, call <strong className="text-ink">112</strong>.</span></p>
        </div>
      </footer>
    </div>
  )
}
