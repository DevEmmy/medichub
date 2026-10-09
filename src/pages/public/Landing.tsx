import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, BadgeCheck, Bot, Building2, CalendarCheck, HeartPulse, Languages, LogIn, Mail, MapPin, Phone, QrCode, Search, ShieldCheck, Siren, Sparkles, Star, UserRound } from 'lucide-react'
import { DEMO } from '../../config'
import { Logo } from '../../components/ui/Logo'
import { Spinner } from '../../components/ui/States'
import { Slideshow } from '../../components/ui/Slideshow'
import { useAuth, homeFor } from '../../contexts/AuthContext'
import { useEmergency } from '../../contexts/EmergencyContext'
import { useToast } from '../../contexts/ToastContext'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../data/seed'
import { HERO_SLIDES, SCENES } from '../../data/scenes'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLive } from '../../hooks/useLive'
import { listPublicHospitals } from '../../services/hospitals'
import { cn } from '../../utils/cn'
import { A11yButton } from '../../contexts/A11yContext'

const SERVICES = ['Antenatal care', 'Ultrasound scan', 'Dental check-up', 'Emergency care', 'Lab tests', 'Child health', 'Blood pressure check', 'Eye clinic', 'Physiotherapy', 'Pharmacy', 'Blood bank', 'Mental health']
const QUICK = ['Antenatal', 'Scan', 'Dentist', 'Lab test', 'Child clinic']

const CHAT = [
  { me: true, t: 'My pikin get high fever since morning. Wetin I fit do?' },
  { me: false, t: 'Sorry about your child. Give paracetamol in the right dose for their age, keep them cool and give plenty fluids. If the fever passes 39°C, they are very drowsy or have a fit, go to an emergency unit now.' },
  { me: false, t: 'Nearest open children\'s clinic: 1.8 km away · slots from 2:30 PM.', card: true },
]

function Header() {
  const { user, hospitalId } = useAuth()
  const [solid, setSolid] = useState(false)
  useEffect(() => { const f = () => setSolid(window.scrollY > 40); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f) }, [])
  return (
    <header className={cn('fixed inset-x-0 top-0 z-40 transition-colors duration-300', solid ? 'bg-ink/90 shadow-lift backdrop-blur-xl' : 'bg-transparent')}>
      <div className="container-app flex h-[68px] items-center gap-3">
        <Logo light />
        <nav className="ml-6 hidden items-center gap-1 text-[14px] font-semibold text-white/80 lg:flex" aria-label="Main">
          {[['Find care', '/find'], ['First aid', '/first-aid'], ['Medic AI', '/assistant'], ['Check symptoms', '/triage']].map(([l, to]) => <Link key={to} to={to} className="rounded-full px-3.5 py-2 hover:bg-white/10 hover:text-white">{l}</Link>)}
          <a href="#hospitals" className="rounded-full px-3.5 py-2 hover:bg-white/10 hover:text-white">For hospitals</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <A11yButton dark />
          {user ? <Link to={homeFor(user.role, hospitalId)} className="btn btn-lime btn-sm">Open my dashboard <ArrowRight size={15} /></Link> : (
            <>
              <Link to="/login" className="btn btn-sm hidden text-white hover:bg-white/10 sm:inline-flex"><LogIn size={15} /> Sign in</Link>
              <Link to="/signup" className="btn btn-lime btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Hero({ count }: { count: number }) {
  const nav = useNavigate()
  const { enterEmergency } = useEmergency()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const onIndex = useCallback((n: number) => setI(n), [])
  const go = (e?: FormEvent, term?: string) => { e?.preventDefault(); const v = (term ?? q).trim(); nav(v ? `/find?q=${encodeURIComponent(v)}` : '/find') }
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-ink text-white grain">
      <Slideshow slides={HERO_SLIDES} onIndex={onIndex} className="absolute inset-0 -z-10" overlay="bg-[linear-gradient(100deg,rgba(6,40,31,.96)_0%,rgba(6,40,31,.86)_38%,rgba(6,40,31,.35)_72%,rgba(6,40,31,.15)_100%)]" />
      <div className="absolute inset-0 -z-10 adire opacity-60 [mask-image:linear-gradient(90deg,black,transparent_60%)]" aria-hidden />
      <div className="container-app flex min-h-[100svh] flex-col justify-center pb-28 pt-28">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-lime-300 ring-1 ring-white/15 backdrop-blur">
          <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulseRing rounded-full bg-lime-400" /><span className="relative h-2 w-2 rounded-full bg-lime-400" /></span>
          Built in Nigeria, for Nigerians · {count} hospitals listed
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-6 max-w-3xl text-[44px] font-extrabold leading-[0.98] tracking-[-0.03em] text-white sm:text-[68px] lg:text-[84px]">
          The right hospital,<br /><span className="text-lime-400">right now.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/75 sm:text-[19px]">
          See which hospitals near you are open, have beds, oxygen and the service you need. Book a time, skip the queue with a QR pass, and call the emergency unit in one tap.
        </motion.p>
        <motion.form onSubmit={go} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex max-w-xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-lift" role="search">
          <Search size={20} className="shrink-0 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you need? Scan, dentist, antenatal…" aria-label="Search for a service or hospital" className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] text-ink outline-none placeholder:text-slate-400" />
          <button className="btn btn-primary shrink-0 px-5">Search</button>
        </motion.form>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK.map((s) => <button key={s} onClick={() => go(undefined, s)} className="rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/90 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">{s}</button>)}
          <button onClick={(e) => enterEmergency(e)} className="inline-flex items-center gap-1.5 rounded-full bg-danger-600 px-3.5 py-1.5 text-[13px] font-bold text-white shadow-lift hover:bg-danger-700"><Siren size={14} /> Emergency</button>
        </div>
      </div>
      {/* caption of the current photo */}
      <div className="pointer-events-none absolute bottom-24 right-4 hidden max-w-xs sm:right-8 md:block">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-md">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-lime-300">{HERO_SLIDES[i].caption}</p>
            <p className="mt-1 font-display text-[18px] font-semibold text-white">{HERO_SLIDES[i].place}</p>
            <div className="mt-3 flex gap-1.5">{HERO_SLIDES.map((_, k) => <span key={k} className={cn('h-1 rounded-full transition-all', k === i ? 'w-8 bg-lime-400' : 'w-3 bg-white/30')} />)}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      {/* service ticker */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-white/10 bg-ink/70 py-3.5 backdrop-blur">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap text-[14px] font-semibold text-white/70">
          {[...SERVICES, ...SERVICES].map((s, k) => <Link key={k} to={`/find?q=${encodeURIComponent(s)}`} className="flex items-center gap-8 hover:text-lime-300">{s}<span className="h-1.5 w-1.5 rounded-full bg-lime-400" /></Link>)}
        </div>
      </div>
    </section>
  )
}

function Bento() {
  const tiles = [
    { to: '/find', img: SCENES.nurseWard, k: 'Live availability', t: 'Beds, oxygen and blood, before you leave home', cls: 'md:col-span-2 md:row-span-2 min-h-[360px]' },
    { to: '/find?appt=1', img: SCENES.qrCheckin, k: 'Book & check in', t: 'Book a time. Show your QR pass. Done.', cls: 'min-h-[220px]' },
    { to: '/find?q=Antenatal', img: SCENES.antenatal, k: 'Antenatal & scans', t: 'Find who offers it, and when', cls: 'min-h-[220px]' },
    { to: '/find?q=Pharmacy', img: SCENES.pharmacy, k: 'Pharmacy & labs', t: 'See what is open today', cls: 'min-h-[220px]' },
    { to: '/find?q=check-up', img: SCENES.bpCheck, k: 'Regular check-ups', t: 'For parents and grandparents too', cls: 'min-h-[220px]' },
  ]
  return (
    <section className="container-app py-20 sm:py-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow text-brand-700">Everyday care, sorted</p><h2 className="mt-2 max-w-2xl text-[36px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[52px]">No more guessing. No more <span className="hl">wasted trips.</span></h2></div>
        <Link to="/find" className="btn btn-primary w-fit">Explore hospitals <ArrowRight size={16} /></Link>
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-4 md:grid-rows-2">
        {tiles.map((x, k) => (
          <motion.div key={x.k} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: k * 0.06 }} className={cn('relative', x.cls)}>
            <Link to={x.to} className="group absolute inset-0 overflow-hidden rounded-4xl bg-ink">
              <img src={x.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <div><p className="text-[12px] font-bold uppercase tracking-[0.12em] text-lime-300">{x.k}</p><p className="mt-1 font-display text-[20px] font-semibold leading-tight text-white sm:text-[22px]">{x.t}</p></div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition group-hover:bg-lime-400 group-hover:text-ink"><ArrowUpRight size={18} /></span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function Steps() {
  const steps = [
    { icon: Search, t: 'Search what you need', d: 'A service, a specialty or a hospital name. We show what is close and open.' },
    { icon: HeartPulse, t: 'See it live', d: 'Hospitals update their status. Old information is flagged, never hidden.' },
    { icon: CalendarCheck, t: 'Book and pay', d: 'Pick a time. Pay securely if there is a fee, straight to the hospital.' },
    { icon: QrCode, t: 'Walk in with a QR pass', d: 'The front desk scans it. You are checked in, no folder hunting.' },
  ]
  return (
    <section className="relative overflow-hidden bg-sand-100 py-20 sm:py-28">
      <div className="absolute inset-0 adire-dark" aria-hidden />
      <div className="container-app relative grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="eyebrow text-brand-700">How it works</p>
          <h2 className="mt-2 text-[36px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[48px]">From "I need a doctor" to "I'm being seen", in four steps.</h2>
          <ol className="mt-8 space-y-3">
            {steps.map((s, k) => (
              <motion.li key={s.t} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.08 }} className="flex gap-4 rounded-3xl bg-white p-5 shadow-soft">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink font-display text-[18px] font-bold text-lime-400">{k + 1}</span>
                <div><p className="flex items-center gap-2 font-display text-[19px] font-semibold text-ink"><s.icon size={18} className="text-brand-600" />{s.t}</p><p className="mt-1 text-[14.5px] leading-relaxed text-slate-600">{s.d}</p></div>
              </motion.li>
            ))}
          </ol>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-[40px] shadow-lift"><img src={SCENES.qrCheckin} alt="A patient shows his QR pass at a hospital reception" className="aspect-[4/5] w-full object-cover" loading="lazy" /></div>
          <div className="absolute -left-4 bottom-10 w-[230px] animate-floaty rounded-3xl bg-ink p-4 text-white shadow-lift sm:-left-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-lime-300">Booking pass</p>
            <p className="mt-1 font-display text-[16px] font-semibold">Ultrasound scan</p>
            <p className="text-[12px] text-white/60">Today · 10:30 AM · Paid ₦12,000</p>
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-lime-300"><BadgeCheck size={14} /> Checked in at reception</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function AiSection() {
  const [n, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN((x) => (x >= CHAT.length + 1 ? 0 : x + 1)), 1700); return () => clearInterval(t) }, [])
  return (
    <section className="relative overflow-hidden bg-ink py-20 text-white sm:py-28 grain">
      <div className="absolute inset-0 adire opacity-70" aria-hidden />
      <div className="absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="container-app relative grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-lime-300 ring-1 ring-white/15"><Sparkles size={14} /> Medic AI</p>
          <h2 className="mt-4 text-[36px] font-extrabold leading-[1.02] tracking-[-0.02em] text-white sm:text-[52px]">Ask anything. In <span className="text-lime-400">your</span> language.</h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/70">English, Pidgin, Yorùbá, Hausa or Igbo. Medic AI explains symptoms, first aid and what to do next, spots danger signs, and points you to the right hospital in the app.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-[13px] font-semibold">{['English', 'Pidgin', 'Yorùbá', 'Hausa', 'Igbo'].map((l) => <span key={l} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10"><Languages size={13} /> {l}</span>)}</div>
          <Link to="/assistant" className="btn btn-lime mt-8">Ask Medic AI <ArrowRight size={16} /></Link>
          <p className="mt-3 text-[12px] text-white/45">General health information, not a diagnosis. In an emergency, go to the nearest emergency unit.</p>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="rounded-[36px] bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-400 text-ink"><Bot size={20} /></span><div><p className="font-display text-[16px] font-semibold">Medic AI</p><p className="text-[12px] text-lime-300">● online · Pidgin</p></div></div>
            <div className="min-h-[300px] space-y-3 px-1 pt-4">
              {CHAT.slice(0, n).map((m, k) => (
                <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('max-w-[86%] rounded-3xl px-4 py-3 text-[14px] leading-relaxed', m.me ? 'ml-auto rounded-br-lg bg-lime-400 text-ink' : m.card ? 'rounded-bl-lg bg-white text-ink' : 'rounded-bl-lg bg-white/10 text-white/90')}>
                  {m.card ? <span className="flex items-center gap-2 font-semibold"><MapPin size={15} className="shrink-0 text-brand-600" />{m.t}</span> : m.t}
                </motion.div>
              ))}
              {n <= CHAT.length && n > 0 && <div className="flex w-16 gap-1 rounded-full bg-white/10 px-4 py-3">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-blink rounded-full bg-white/70" style={{ animationDelay: `${d * 0.2}s` }} />)}</div>}
            </div>
          </div>
          <p className="mt-2 text-center text-[11.5px] text-white/65">Example conversation</p>
        </div>
      </div>
    </section>
  )
}

function EmergencyBand() {
  const { enterEmergency } = useEmergency()
  return (
    <section className="container-app py-20 sm:py-28">
      <div className="relative overflow-hidden rounded-[40px] bg-danger-900 text-white">
        <img src={SCENES.emergencyEntrance} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#3a0606] via-[#3a0606]/85 to-transparent" />
        <div className="relative max-w-xl p-8 sm:p-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-bold text-danger-100 ring-1 ring-white/15"><Siren size={14} /> Emergency mode</p>
          <h2 className="mt-4 text-[36px] font-extrabold leading-[1.02] tracking-[-0.02em] text-white sm:text-[52px]">One tap. The nearest open emergency unit.</h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-white/80">Medic Hub finds the closest hospital with an open emergency unit and calls it directly, then walks you through first aid with short videos while you wait.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={(e) => enterEmergency(e)} className="btn bg-white text-danger-700 hover:bg-danger-50"><Siren size={17} /> Open emergency mode</button>
            <Link to="/first-aid" className="btn bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">First-aid guides</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function ForHospitals() {
  return (
    <section id="hospitals" className="container-app grid items-center gap-12 pb-20 sm:pb-28 lg:grid-cols-2">
      <div className="relative order-2 lg:order-1">
        <div className="overflow-hidden rounded-[40px]"><img src={SCENES.nurseWard} alt="A nurse with a tablet in a hospital ward" className="aspect-[4/3] w-full object-cover" loading="lazy" /></div>
        <div className="absolute -bottom-6 right-4 w-[260px] rounded-3xl bg-white p-4 shadow-lift ring-1 ring-black/5 sm:right-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Today</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">{[['Booked', '24'], ['Paid', '18'], ['Checked in', '9']].map(([l, v]) => <div key={l} className="rounded-2xl bg-canvas p-2"><p className="font-display text-[22px] font-bold text-ink">{v}</p><p className="text-[10.5px] font-semibold text-slate-500">{l}</p></div>)}</div>
          <p className="mt-2 text-center text-[10.5px] text-slate-400">Example dashboard</p>
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <p className="eyebrow text-brand-700">For hospitals</p>
        <h2 className="mt-2 text-[36px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[48px]">Fuller clinics. Calmer waiting rooms.</h2>
        <p className="mt-4 max-w-lg text-[16.5px] leading-relaxed text-slate-600">Publish your live status in one tap, take bookings and payments straight to your bank account, and check patients in by QR. Basic is free forever.</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {['Live status & capacity', 'Online bookings & payments', 'QR check-in', 'Verified ratings', 'Analytics (Premium)', 'Automatic reminders (Premium)'].map((x) => <li key={x} className="flex items-center gap-2 text-[14.5px] font-semibold text-ink"><BadgeCheck size={17} className="text-brand-600" />{x}</li>)}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3"><Link to="/signup?role=hospital" className="btn btn-primary">Register your hospital <ArrowRight size={16} /></Link><Link to="/login" className="btn btn-secondary">Hospital sign in</Link></div>
      </div>
    </section>
  )
}

function DemoStrip() {
  const { signIn } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const demo = async (key: keyof typeof DEMO_ACCOUNTS) => {
    setBusy(key)
    try { const u = await signIn(DEMO_ACCOUNTS[key].email, DEMO_PASSWORD); toast('success', `Signed in as ${DEMO_ACCOUNTS[key].label.toLowerCase()}`, DEMO_ACCOUNTS[key].name); nav(homeFor(u.role, u.role === 'hospital' ? 'h_lagooncrest' : null)) }
    catch (e) { toast('error', 'Could not sign in', (e as Error).message) } finally { setBusy(null) }
  }
  return (
    <section className="container-app pb-20">
      <div className="flex flex-col items-start gap-4 rounded-4xl bg-lime-400 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex-1"><p className="font-display text-[24px] font-extrabold text-ink">Try it now, no sign-up.</p><p className="text-[14.5px] font-medium text-ink/70">Step into any side of Medic Hub with a demo account.</p></div>
        <div className="flex flex-wrap gap-2">
          {([['patient', UserRound], ['hospital', Building2], ['admin', ShieldCheck]] as const).map(([k, I]) => (
            <button key={k} onClick={() => demo(k)} disabled={!!busy} className="btn btn-primary">{busy === k ? <Spinner /> : <I size={16} />} {DEMO_ACCOUNTS[k].label}</button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="container-app grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div><Logo light /><p className="mt-4 max-w-xs text-[14px] leading-relaxed text-white/60">The right hospital, right now. Built in Nigeria by Team Medic Hub.</p></div>
        <div><p className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/65">Patients</p><ul className="mt-3 space-y-2 text-[14px] text-white/80">{[['Find care', '/find'], ['Medic AI', '/assistant'], ['First aid', '/first-aid'], ['Check symptoms', '/triage'], ['Scan a QR code', '/scan']].map(([l, to]) => <li key={to}><Link to={to} className="hover:text-lime-300">{l}</Link></li>)}</ul></div>
        <div><p className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/65">Hospitals</p><ul className="mt-3 space-y-2 text-[14px] text-white/80">{[['Register', '/signup?role=hospital'], ['Sign in', '/login']].map(([l, to]) => <li key={to}><Link to={to} className="hover:text-lime-300">{l}</Link></li>)}</ul></div>
        <div><p className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/65">Contact</p><ul className="mt-3 space-y-2 text-[14px] text-white/80"><li className="flex items-center gap-2"><Mail size={14} /><a href="mailto:medichubnigeria@gmail.com" className="hover:text-lime-300">medichubnigeria@gmail.com</a></li><li className="flex items-center gap-2"><Phone size={14} /><a href="tel:+2347042744090" className="hover:text-lime-300">0704 274 4090</a></li></ul></div>
      </div>
      <div className="border-t border-white/10"><p className="container-app py-5 text-[12.5px] text-white/65">© {new Date().getFullYear()} Medic Hub. Medic Hub helps you find care and does not dispatch ambulances. {DEMO ? 'Demo build: some hospitals show sample status.' : ''}</p></div>
    </footer>
  )
}

export default function Landing() {
  useDocumentTitle('')
  const { data: hospitals = [] } = useLive(listPublicHospitals, ['hospitals', 'hospital_status', 'hospital_capacity'])
  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-canvas">
      <Header />
      <main>
        <Hero count={hospitals.length} />
        <Bento />
        <Steps />
        <AiSection />
        <EmergencyBand />
        <ForHospitals />
        {DEMO && <DemoStrip />}
        <section className="container-app pb-20">
          <div className="grid gap-3 sm:grid-cols-3">
            {[[Star, 'Verified ratings', 'Only patients who checked in can rate.'], [ShieldCheck, 'Verified hospitals', 'Every hospital is checked against its documents.'], [Languages, 'Five languages', 'English, Pidgin, Yorùbá, Hausa and Igbo.']].map(([I, t, d]) => { const Icon = I as typeof Star; return (
              <div key={t as string} className="flex gap-3 rounded-3xl bg-white p-5 shadow-soft"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={20} /></span><div><p className="font-display text-[17px] font-semibold text-ink">{t as string}</p><p className="text-[13.5px] text-slate-600">{d as string}</p></div></div>
            ) })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
