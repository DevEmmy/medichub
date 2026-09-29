import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, FileText, Upload, X, CircleCheck, LocateFixed, PartyPopper } from 'lucide-react'
import { Logo } from '../../components/ui/Logo'
import { Field, SelectField, TextArea, Toggle } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { submitOnboarding, type OnboardingInput } from '../../services/hospitals'
import { ALL_SPECIALTIES, FACILITY_OPTIONS } from '../../data/seed'
import { CITIES, NIGERIAN_STATES } from '../../data/locations'
import { fmtBytes } from '../../utils/image'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'

const STEPS = ['Hospital details', 'Location', 'Services', 'Registration', 'Documents', 'Administrator', 'Review', 'Submitted']
const REQUIRED_DOCS = ['CAC certificate', 'Facility operating licence', 'Medical director licence (MDCN)']

export default function Onboarding() {
  useDocumentTitle('Register your facility')
  const { user, hospitalId, refresh } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState<OnboardingInput>({
    name: '', type: 'Private', tagline: '', description: '', phone: '', emergencyPhone: '', email: user?.email ?? '', website: '',
    address: '', area: '', city: 'Lagos', state: 'Lagos', lat: 6.5244, lng: 3.3792,
    specialties: ['General practice', 'Laboratory', 'Pharmacy'], facilities: ['Pharmacy', 'Laboratory'], is24h: false,
    registration: { cacNumber: '', licenseNumber: '', licensingBody: '', yearEstablished: '', bedCount: 20 },
    documents: [], admin: { name: user?.name ?? '', title: 'Medical Director', email: user?.email ?? '', phone: user?.phone ?? '' },
  })
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({})
  if (hospitalId && step < 7) return <Navigate to="/hospital" replace />
  const set = (p: Partial<OnboardingInput>) => setF((x) => ({ ...x, ...p }))

  const validate = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 0) { if (!f.name.trim()) e.name = 'Enter your facility name.'; if (!/^\+?[\d\s()-]{7,}$/.test(f.phone)) e.phone = 'Enter a valid phone number.'; if (!f.description.trim()) e.description = 'Add a short description patients will read.' }
    if (s === 1) { if (!f.address.trim()) e.address = 'Enter the street address.'; if (!f.area.trim()) e.area = 'Enter the area or neighbourhood.' }
    if (s === 2 && f.specialties.length === 0) e.specialties = 'Choose at least one service.'
    if (s === 3) { if (!f.registration.cacNumber.trim()) e.cac = 'Enter your CAC registration number.'; if (!f.registration.licenseNumber.trim()) e.lic = 'Enter your operating licence number.'; if (!f.registration.licensingBody.trim()) e.body = 'Who issued the licence?' }
    if (s === 4) REQUIRED_DOCS.forEach((d) => { if (!docFiles[d]) e[d] = 'Required' })
    if (s === 5) { if (!f.admin.name.trim()) e.aname = 'Enter the administrator\'s name.'; if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.admin.email)) e.aemail = 'Enter a valid email.' }
    setErrors(e)
    return Object.keys(e).length === 0
  }
  const next = () => { if (!validate(step)) return; setDir(1); setStep((s) => s + 1) }
  const back = () => { setDir(-1); setErrors({}); setStep((s) => s - 1) }
  const submit = async () => {
    setBusy(true)
    try {
      await submitOnboarding({ ...f, website: f.website || undefined, documents: Object.entries(docFiles).filter(([, v]) => v).map(([k, v]) => ({ name: v!.name, kind: k, size: v!.size })) })
      refresh(); setDir(1); setStep(7)
      toast('success', 'Your verification documents were submitted')
    } catch (e) { toast('error', 'Submission failed', (e as Error).message) } finally { setBusy(false) }
  }

  const bodies = [
    <div key="0" className="space-y-4">
      <Field label="Facility name" value={f.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} placeholder="e.g. Harbour Point Medical Centre" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Facility type" value={f.type} onChange={(e) => set({ type: e.target.value as OnboardingInput['type'] })}>{['Private', 'General', 'Specialist', 'Mission', 'Primary Care', 'Teaching', 'Federal Medical Centre'].map((t) => <option key={t}>{t}</option>)}</SelectField>
        <Field label="Tagline (optional)" value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={80} />
      </div>
      <TextArea label="Description" value={f.description} onChange={(e) => set({ description: e.target.value })} error={errors.description} placeholder="What you offer and who you serve." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Main phone" type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} error={errors.phone} placeholder="+234 …" />
        <Field label="Emergency line (optional)" type="tel" value={f.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value })} />
        <Field label="Public email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        <Field label="Website (optional)" type="url" value={f.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
      </div>
    </div>,
    <div key="1" className="space-y-4">
      <Field label="Street address" value={f.address} onChange={(e) => set({ address: e.target.value })} error={errors.address} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Area" value={f.area} onChange={(e) => set({ area: e.target.value })} error={errors.area} placeholder="e.g. Ikeja GRA" />
        <SelectField label="City" value={f.city} onChange={(e) => { const c = CITIES.find((x) => x.name === e.target.value); set({ city: e.target.value, ...(c ? { state: c.state, lat: c.lat, lng: c.lng } : {}) }) }}>{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}<option>Other</option></SelectField>
        <SelectField label="State" value={f.state} onChange={(e) => set({ state: e.target.value })}>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</SelectField>
      </div>
      <div className="rounded-2xl bg-canvas p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] font-medium text-slate-700">Map pin</p><button type="button" onClick={() => navigator.geolocation?.getCurrentPosition((p) => set({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }), () => toast('info', 'Location unavailable', 'Enter coordinates or keep the city centre.'))} className="btn btn-secondary btn-sm"><LocateFixed size={15} /> Use this device's location</button></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Latitude" inputMode="decimal" value={f.lat} onChange={(e) => set({ lat: Number(e.target.value) })} /><Field label="Longitude" inputMode="decimal" value={f.lng} onChange={(e) => set({ lng: Number(e.target.value) })} /></div>
        <p className="mt-2 text-[12px] text-slate-500">Defaults to the city centre. You can refine it later in your profile.</p>
      </div>
    </div>,
    <div key="2" className="space-y-5">
      <div><p className="text-[13px] font-medium text-slate-700">Services and specialties</p>{errors.specialties && <p className="text-[12.5px] font-medium text-danger-600">{errors.specialties}</p>}
        <div className="mt-2 flex flex-wrap gap-2">{ALL_SPECIALTIES.map((s) => <button key={s} type="button" onClick={() => set({ specialties: f.specialties.includes(s) ? f.specialties.filter((x) => x !== s) : [...f.specialties, s] })} aria-pressed={f.specialties.includes(s)} className={cn('chip', f.specialties.includes(s) && 'chip-on')}>{f.specialties.includes(s) && <Check size={14} />}{s}</button>)}</div></div>
      <div><p className="text-[13px] font-medium text-slate-700">Facilities</p>
        <div className="mt-2 flex flex-wrap gap-2">{FACILITY_OPTIONS.map((s) => <button key={s} type="button" onClick={() => set({ facilities: f.facilities.includes(s) ? f.facilities.filter((x) => x !== s) : [...f.facilities, s] })} aria-pressed={f.facilities.includes(s)} className={cn('chip', f.facilities.includes(s) && 'chip-on')}>{s}</button>)}</div></div>
      <Toggle checked={f.is24h} onChange={(v) => set({ is24h: v })} label="Open 24 hours" description="You can set detailed hours after setup." />
    </div>,
    <div key="3" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CAC registration number" value={f.registration.cacNumber} onChange={(e) => set({ registration: { ...f.registration, cacNumber: e.target.value } })} error={errors.cac} placeholder="RC 1234567" />
        <Field label="Operating licence number" value={f.registration.licenseNumber} onChange={(e) => set({ registration: { ...f.registration, licenseNumber: e.target.value } })} error={errors.lic} />
        <Field label="Licensing body" value={f.registration.licensingBody} onChange={(e) => set({ registration: { ...f.registration, licensingBody: e.target.value } })} error={errors.body} placeholder="e.g. HEFAMAA, State Ministry of Health" />
        <Field label="Year established" inputMode="numeric" value={f.registration.yearEstablished} onChange={(e) => set({ registration: { ...f.registration, yearEstablished: e.target.value } })} />
        <Field label="Number of beds" type="number" min={0} value={f.registration.bedCount} onChange={(e) => set({ registration: { ...f.registration, bedCount: Number(e.target.value) } })} />
      </div>
    </div>,
    <div key="4" className="space-y-3">
      <p className="text-[14px] text-slate-600">Upload clear scans or photos (PDF, JPG or PNG). Our team checks them against official registries.</p>
      {REQUIRED_DOCS.map((d) => { const file = docFiles[d]; return (
        <div key={d} className={cn('flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1', errors[d] ? 'ring-danger-200 bg-danger-50/50' : 'ring-line bg-white')}>
          <FileText size={20} className="text-slate-400" />
          <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold text-ink">{d}</p><p className="truncate text-[12.5px] text-slate-500">{file ? `${file.name} · ${fmtBytes(file.size)}` : errors[d] ? 'This document is required.' : 'Not uploaded'}</p></div>
          {file ? <button type="button" onClick={() => setDocFiles({ ...docFiles, [d]: null })} className="btn btn-ghost btn-sm"><X size={14} /> Remove</button> : (
            <label className="btn btn-secondary btn-sm cursor-pointer"><Upload size={14} /> Upload<input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => { const x = e.target.files?.[0]; if (x) { if (x.size > 10e6) { toast('error', 'File too large', 'Upload a file under 10 MB.'); return } setDocFiles({ ...docFiles, [d]: x }) } }} /></label>
          )}
        </div>) })}
    </div>,
    <div key="5" className="space-y-4">
      <p className="text-[14px] text-slate-600">The person accountable for this facility on Medic Hub.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" value={f.admin.name} onChange={(e) => set({ admin: { ...f.admin, name: e.target.value } })} error={errors.aname} />
        <Field label="Role" value={f.admin.title} onChange={(e) => set({ admin: { ...f.admin, title: e.target.value } })} />
        <Field label="Email" type="email" value={f.admin.email} onChange={(e) => set({ admin: { ...f.admin, email: e.target.value } })} error={errors.aemail} />
        <Field label="Phone" type="tel" value={f.admin.phone} onChange={(e) => set({ admin: { ...f.admin, phone: e.target.value } })} />
      </div>
    </div>,
    <div key="6" className="space-y-3">
      {[
        ['Facility', `${f.name} · ${f.type}`, 0], ['Contact', `${f.phone}${f.email ? ` · ${f.email}` : ''}`, 0], ['Location', `${f.address}, ${f.area}, ${f.city}, ${f.state}`, 1],
        ['Services', f.specialties.join(', '), 2], ['Registration', `${f.registration.cacNumber} · ${f.registration.licenseNumber} (${f.registration.licensingBody})`, 3],
        ['Documents', `${Object.values(docFiles).filter(Boolean).length} of ${REQUIRED_DOCS.length} uploaded`, 4], ['Administrator', `${f.admin.name}, ${f.admin.title}`, 5],
      ].map(([k, v, s]) => (
        <div key={k as string} className="flex items-start gap-3 rounded-2xl bg-canvas p-4"><div className="min-w-0 flex-1"><p className="text-[12px] font-medium text-slate-500">{k}</p><p className="text-[14.5px] font-semibold text-ink">{v}</p></div><button onClick={() => { setDir(-1); setStep(s as number) }} className="text-[13px] font-semibold text-brand-700">Edit</button></div>
      ))}
      <p className="text-[12.5px] leading-relaxed text-slate-500">By submitting, you confirm this information is accurate and that you are authorised to act for this facility. Your profile stays hidden from patients until it is verified.</p>
    </div>,
    <div key="7" className="py-4 text-center">
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white"><PartyPopper size={28} /></motion.span>
      <h2 className="mt-5 text-[26px] font-semibold">Submitted for verification</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-slate-600">Status: <strong className="text-amber-700">Pending</strong>. We'll notify you when a reviewer has checked your documents. Meanwhile, set up your services, slots and live status.</p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><button onClick={() => nav('/hospital')} className="btn btn-primary">Open your dashboard <ArrowRight size={16} /></button><Link to="/hospital/verification" className="btn btn-secondary">Track verification</Link></div>
    </div>,
  ]

  return (
    <div className="min-h-[100dvh] bg-[#F3F5F2]">
      <header className="border-b border-line bg-white/80 backdrop-blur"><div className="container-app flex h-16 items-center justify-between"><Logo to="/" /><span className="text-[13px] font-medium text-slate-500">Facility registration</span></div></header>
      <div className="container-app grid max-w-5xl gap-8 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <ol className="hidden space-y-1 lg:block" aria-label="Registration steps">
          {STEPS.map((s, i) => (
            <li key={s} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px]', i === step ? 'bg-white font-semibold text-ink shadow-soft' : i < step ? 'text-slate-700' : 'text-slate-400')} aria-current={i === step ? 'step' : undefined}>
              <span className={cn('grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold', i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-ink text-white' : 'bg-mist')}>{i < step ? <Check size={14} /> : i + 1}</span>{s}
            </li>
          ))}
        </ol>
        <div>
          <div className="lg:hidden"><p className="text-[13px] font-medium text-slate-500">Step {step + 1} of {STEPS.length}</p><div className="mt-2 h-1.5 rounded-full bg-line"><motion.div className="h-full rounded-full bg-brand-600" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div></div>
          <section className="mt-4 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-black/5 sm:p-8 lg:mt-0">
            {step < 7 && <h1 className="mb-6 text-[26px] font-semibold">{STEPS[step]}</h1>}
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={step} custom={dir} initial={{ opacity: 0, x: 24 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 * dir }} transition={{ duration: 0.2 }}>{bodies[step]}</motion.div>
            </AnimatePresence>
            {step < 7 && (
              <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
                {step > 0 ? <button onClick={back} className="btn btn-ghost"><ArrowLeft size={16} /> Back</button> : <span />}
                {step < 6 ? <button onClick={next} className="btn btn-primary">Continue <ArrowRight size={16} /></button> : <button onClick={submit} disabled={busy} className="btn btn-brand">{busy ? <Spinner /> : <CircleCheck size={17} />} Submit for verification</button>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
