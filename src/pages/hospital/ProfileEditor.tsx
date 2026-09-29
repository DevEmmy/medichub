import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, ImagePlus, Pencil, Plus, Trash2, UserRound, Stethoscope, Building, Clock, Images, Settings, MapPin, Layers } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { removeDepartment, removeDoctor, removeService, saveDepartment, saveDoctor, saveService, updateHospitalProfile, type HospitalView } from '../../services/hospitals'
import { Field, SelectField, TextArea, Toggle } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/States'
import { HospitalAvatar, HospitalCover } from '../../components/ui/HospitalAvatar'
import { Pill, emergencyLabel, emergencyTone } from '../../components/ui/StatusPill'
import { useToast } from '../../contexts/ToastContext'
import { ALL_SPECIALTIES, FACILITY_OPTIONS } from '../../data/seed'
import { NIGERIAN_STATES } from '../../data/locations'
import { resizeImage } from '../../utils/image'
import { DAY_NAMES } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { Department, Doctor, Hospital, Service } from '../../types'

const TABS = [
  { k: 'details', l: 'Details', i: Building }, { k: 'location', l: 'Location', i: MapPin }, { k: 'hours', l: 'Opening hours', i: Clock }, { k: 'services', l: 'Services', i: Stethoscope },
  { k: 'departments', l: 'Departments', i: Layers }, { k: 'doctors', l: 'Doctors', i: UserRound }, { k: 'media', l: 'Images', i: Images }, { k: 'settings', l: 'Facilities & settings', i: Settings },
] as const
type Tab = (typeof TABS)[number]['k']

function useSave(h: HospitalView) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const save = async (patch: Partial<Hospital>, msg = 'Profile saved') => {
    setBusy(true)
    try { await updateHospitalProfile(h.id, patch); toast('success', msg, 'Patients see the change now.') } catch (e) { toast('error', 'Could not save', (e as Error).message) } finally { setBusy(false) }
  }
  return { busy, save }
}

function SaveBar({ busy, onSave, dirty = true }: { busy: boolean; onSave: () => void; dirty?: boolean }) {
  return <div className="flex justify-end border-t border-line pt-4"><button onClick={onSave} disabled={busy || !dirty} className="btn btn-primary">{busy && <Spinner />} Save changes</button></div>
}

function Details({ h }: { h: HospitalView }) {
  const [f, setF] = useState({ name: h.name, tagline: h.tagline, description: h.description, type: h.type, phone: h.phone, emergencyPhone: h.emergencyPhone, email: h.email, website: h.website ?? '' })
  const [socials, setSocials] = useState(h.socials)
  const { busy, save } = useSave(h)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hospital name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <SelectField label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Hospital['type'] })}>{['Specialist', 'General', 'Private', 'Mission', 'Primary Care', 'Teaching', 'Federal Medical Centre'].map((t) => <option key={t}>{t}</option>)}</SelectField>
      </div>
      <Field label="Tagline" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} maxLength={80} hint="A short line shown under your name." />
      <TextArea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={5} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Main phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Field label="Emergency line" type="tel" value={f.emergencyPhone} onChange={(e) => setF({ ...f, emergencyPhone: e.target.value })} />
        <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="Website" type="url" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" />
      </div>
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-slate-700">Social links</p>
        {socials.map((s, i) => (
          <div key={i} className="flex gap-2"><input className="input w-36" value={s.label} placeholder="Label" aria-label="Social label" onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /><input className="input flex-1" value={s.url} placeholder="https://" aria-label="Social URL" onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} /><button onClick={() => setSocials(socials.filter((_, j) => j !== i))} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-mist" aria-label="Remove link"><Trash2 size={16} /></button></div>
        ))}
        <button onClick={() => setSocials([...socials, { label: 'Instagram', url: '' }])} className="btn btn-ghost btn-sm"><Plus size={15} /> Add link</button>
      </div>
      <SaveBar busy={busy} onSave={() => save({ ...f, website: f.website || undefined, socials: socials.filter((s) => s.url.trim()) })} />
    </div>
  )
}

function Location({ h }: { h: HospitalView }) {
  const [f, setF] = useState({ address: h.address, area: h.area, city: h.city, state: h.state, lat: String(h.lat), lng: String(h.lng) })
  const { busy, save } = useSave(h)
  const [err, setErr] = useState<string | null>(null)
  const submit = () => {
    const lat = Number(f.lat), lng = Number(f.lng)
    if (!(lat > 3 && lat < 14.5 && lng > 2.5 && lng < 15)) { setErr('Coordinates should be inside Nigeria (latitude 4–14, longitude 3–15).'); return }
    setErr(null); save({ address: f.address, area: f.area, city: f.city, state: f.state, lat, lng }, 'Location saved')
  }
  return (
    <div className="space-y-4">
      <Field label="Street address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} />
        <Field label="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        <SelectField label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} error={err} />
        <Field label="Longitude" inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} hint="Used for distance and directions." />
      </div>
      <SaveBar busy={busy} onSave={submit} />
    </div>
  )
}

function Hours({ h }: { h: HospitalView }) {
  const [is24h, set24] = useState(h.is24h)
  const [hours, setHours] = useState(h.hours)
  const { busy, save } = useSave(h)
  return (
    <div className="space-y-4">
      <Toggle checked={is24h} onChange={set24} label="Open 24 hours, every day" description="Turn off to set daily opening hours." />
      {!is24h && (
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => { const x = hours[d]; const upd = (p: Partial<typeof x>) => setHours(hours.map((y) => (y.day === d ? { ...y, ...p } : y))); return (
            <li key={d} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-28 text-[14px] font-semibold text-ink">{DAY_NAMES[d]}</span>
              <label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={!x.closed} onChange={(e) => upd({ closed: !e.target.checked })} className="h-4 w-4 accent-brand-600" /> Open</label>
              {!x.closed && <><input type="time" aria-label={`${DAY_NAMES[d]} opens`} value={x.open} onChange={(e) => upd({ open: e.target.value })} className="input h-10 min-h-0 w-32" /><span className="text-slate-400">to</span><input type="time" aria-label={`${DAY_NAMES[d]} closes`} value={x.close} onChange={(e) => upd({ close: e.target.value })} className="input h-10 min-h-0 w-32" /></>}
            </li>) })}
        </ul>
      )}
      <SaveBar busy={busy} onSave={() => save({ is24h, hours }, 'Opening hours saved')} />
    </div>
  )
}

function ServiceForm({ h, s, onDone }: { h: HospitalView; s?: Service; onDone: () => void }) {
  const [f, setF] = useState({ name: s?.name ?? '', category: s?.category ?? ALL_SPECIALTIES[1], departmentId: s?.departmentId ?? '', durationMins: s?.durationMins ?? 20, fee: s?.fee ?? 0, bookable: s?.bookable ?? true, active: s?.active ?? true })
  const [err, setErr] = useState<string | null>(null)
  const { toast } = useToast()
  const submit = async () => { try { await saveService(h.id, { ...f, id: s?.id, departmentId: f.departmentId || undefined, fee: f.fee || undefined }); toast('success', s ? 'Service updated' : 'Service added', f.bookable ? 'Appointment slots are ready for the next two weeks.' : undefined); onDone() } catch (e) { setErr((e as Error).message) } }
  return (
    <div className="space-y-4">
      <Field label="Service name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={err} placeholder="e.g. Diabetes clinic" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Specialty" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{ALL_SPECIALTIES.map((c) => <option key={c}>{c}</option>)}</SelectField>
        <SelectField label="Department" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">None</option>{h.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</SelectField>
        <Field label="Duration (minutes)" type="number" min={5} value={f.durationMins} onChange={(e) => setF({ ...f, durationMins: Number(e.target.value) })} />
        <Field label="Fee from (₦)" type="number" min={0} value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} hint="Leave 0 to show “Fee on arrival”." />
      </div>
      <Toggle checked={f.bookable} onChange={(v) => setF({ ...f, bookable: v })} label="Accept online bookings" description="Creates appointment slots patients can reserve." />
      <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Show on profile" />
      <div className="flex gap-2"><button onClick={onDone} className="btn btn-secondary flex-1">Cancel</button><button onClick={submit} className="btn btn-primary flex-1">Save service</button></div>
    </div>
  )
}

function Services({ h }: { h: HospitalView }) {
  const [modal, setModal] = useState<{ s?: Service } | null>(null)
  const [del, setDel] = useState<string | null>(null)
  const { toast } = useToast()
  return (
    <div>
      <div className="flex justify-end"><button onClick={() => setModal({})} className="btn btn-primary btn-sm"><Plus size={15} /> Add service</button></div>
      <ul className="mt-3 divide-y divide-line rounded-2xl ring-1 ring-line">
        {h.services.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1"><p className={cn('text-[14.5px] font-semibold', s.active ? 'text-ink' : 'text-slate-400 line-through')}>{s.name}</p><p className="text-[12.5px] text-slate-500">{s.category} · {s.bookable ? `Bookable · ${s.durationMins} min` : 'Walk-in only'}{s.fee ? ` · ₦${s.fee.toLocaleString('en-NG')}` : ''}</p></div>
            <button onClick={() => setModal({ s })} className="btn btn-secondary btn-sm" aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
            <button onClick={async () => { if (del !== s.id) { setDel(s.id); setTimeout(() => setDel(null), 3500); return } try { await removeService(h.id, s.id); toast('success', 'Service removed') } catch (e) { toast('error', 'Could not remove', (e as Error).message) } }} className={cn('btn btn-sm', del === s.id ? 'btn-danger' : 'btn-secondary')} aria-label={`Remove ${s.name}`}>{del === s.id ? 'Confirm' : <Trash2 size={14} />}</button>
          </li>
        ))}
      </ul>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.s ? 'Edit service' : 'Add service'}>{modal && <ServiceForm h={h} s={modal.s} onDone={() => setModal(null)} />}</Modal>
    </div>
  )
}

function Departments({ h }: { h: HospitalView }) {
  const [edit, setEdit] = useState<Partial<Department> | null>(null)
  const { toast } = useToast()
  return (
    <div>
      <div className="flex justify-end"><button onClick={() => setEdit({ name: '', status: 'open' })} className="btn btn-primary btn-sm"><Plus size={15} /> Add department</button></div>
      <ul className="mt-3 divide-y divide-line rounded-2xl ring-1 ring-line">
        {h.departments.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold text-ink">{d.name}</p><p className="text-[12.5px] text-slate-500">{d.head ? `Head: ${d.head}` : 'No head assigned'}</p></div>
            <Pill tone={emergencyTone(d.status)} size="sm">{emergencyLabel(d.status)}</Pill>
            <button onClick={() => setEdit(d)} className="btn btn-secondary btn-sm" aria-label={`Edit ${d.name}`}><Pencil size={14} /></button>
            <button onClick={async () => { await removeDepartment(h.id, d.id); toast('success', 'Department removed') }} className="btn btn-secondary btn-sm" aria-label={`Remove ${d.name}`}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit department' : 'Add department'} size="sm">
        {edit && (
          <div className="space-y-4">
            <Field label="Department name" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Field label="Head of department" value={edit.head ?? ''} onChange={(e) => setEdit({ ...edit, head: e.target.value })} />
            <Field label="Direct phone" type="tel" value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            <button onClick={async () => { try { await saveDepartment(h.id, edit as Department); toast('success', 'Department saved'); setEdit(null) } catch (e) { toast('error', 'Could not save', (e as Error).message) } }} className="btn btn-primary w-full">Save department</button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Doctors({ h }: { h: HospitalView }) {
  const [edit, setEdit] = useState<Partial<Doctor> | null>(null)
  const { toast } = useToast()
  return (
    <div>
      <div className="flex justify-end"><button onClick={() => setEdit({ name: '', specialty: 'General practice', available: true })} className="btn btn-primary btn-sm"><Plus size={15} /> Add doctor</button></div>
      <ul className="mt-3 divide-y divide-line rounded-2xl ring-1 ring-line">
        {h.doctors.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700"><UserRound size={17} /></span>
            <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold text-ink">{d.name}</p><p className="text-[12.5px] text-slate-500">{d.specialty}{d.departmentId ? ` · ${h.departments.find((x) => x.id === d.departmentId)?.name ?? ''}` : ''}</p></div>
            <Toggle checked={d.available} onChange={async (v) => { await saveDoctor(h.id, { ...d, available: v }); toast('success', `${d.name} marked ${v ? 'available' : 'away'}`) }} label={`${d.name} available`} />
            <button onClick={() => setEdit(d)} className="btn btn-secondary btn-sm" aria-label={`Edit ${d.name}`}><Pencil size={14} /></button>
            <button onClick={async () => { await removeDoctor(h.id, d.id); toast('success', 'Doctor removed') }} className="btn btn-secondary btn-sm" aria-label={`Remove ${d.name}`}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit doctor' : 'Add doctor'} size="sm">
        {edit && (
          <div className="space-y-4">
            <Field label="Full name" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Dr. " />
            <SelectField label="Specialty" value={edit.specialty} onChange={(e) => setEdit({ ...edit, specialty: e.target.value })}>{ALL_SPECIALTIES.map((c) => <option key={c}>{c}</option>)}</SelectField>
            <SelectField label="Department" value={edit.departmentId ?? ''} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value || undefined })}><option value="">None</option>{h.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</SelectField>
            <button onClick={async () => { try { await saveDoctor(h.id, edit as Doctor); toast('success', 'Doctor saved'); setEdit(null) } catch (e) { toast('error', 'Could not save', (e as Error).message) } }} className="btn btn-primary w-full">Save</button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Media({ h }: { h: HospitalView }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const upload = async (kind: 'logo' | 'cover', file?: File) => {
    if (!file) return
    setBusy(kind)
    try { const data = await resizeImage(file, kind === 'logo' ? 320 : 1400); await updateHospitalProfile(h.id, { [kind]: data }); toast('success', kind === 'logo' ? 'Logo updated' : 'Cover image updated') } catch (e) { toast('error', 'Upload failed', (e as Error).message) } finally { setBusy(null) }
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] font-medium text-slate-700">Cover image</p>
        <HospitalCover hue={h.hue} seed={h.id} cover={h.cover} className="mt-2 h-40 rounded-2xl" />
        <div className="mt-2 flex gap-2">
          <label className="btn btn-secondary btn-sm cursor-pointer">{busy === 'cover' ? <Spinner /> : <ImagePlus size={15} />} Upload cover<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload('cover', e.target.files?.[0])} /></label>
          {h.cover && <button onClick={() => updateHospitalProfile(h.id, { cover: undefined })} className="btn btn-ghost btn-sm">Remove</button>}
        </div>
      </div>
      <div>
        <p className="text-[13px] font-medium text-slate-700">Logo</p>
        <div className="mt-2 flex items-center gap-4">
          <HospitalAvatar name={h.name} hue={h.hue} logo={h.logo} size={72} />
          <label className="btn btn-secondary btn-sm cursor-pointer">{busy === 'logo' ? <Spinner /> : <ImagePlus size={15} />} Upload logo<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload('logo', e.target.files?.[0])} /></label>
          {h.logo && <button onClick={() => updateHospitalProfile(h.id, { logo: undefined })} className="btn btn-ghost btn-sm">Remove</button>}
        </div>
      </div>
      <div>
        <p className="text-[13px] font-medium text-slate-700">Brand colour</p>
        <input type="range" min={0} max={359} value={h.hue} onChange={(e) => updateHospitalProfile(h.id, { hue: Number(e.target.value) })} className="mt-2 w-full max-w-sm accent-brand-600" aria-label="Brand colour hue" />
      </div>
    </div>
  )
}

function SettingsTab({ h }: { h: HospitalView }) {
  const [fac, setFac] = useState(h.facilities)
  const [auto, setAuto] = useState(h.autoConfirm)
  const { busy, save } = useSave(h)
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] font-medium text-slate-700">Facilities</p>
        <div className="mt-2 flex flex-wrap gap-2">{FACILITY_OPTIONS.map((f) => <button key={f} onClick={() => setFac(fac.includes(f) ? fac.filter((x) => x !== f) : [...fac, f])} aria-pressed={fac.includes(f)} className={cn('chip', fac.includes(f) && 'chip-on')}>{f}</button>)}</div>
      </div>
      <Toggle checked={auto} onChange={setAuto} label="Confirm bookings automatically" description="Off: new bookings arrive as pending until your team confirms them." />
      <SaveBar busy={busy} onSave={() => save({ facilities: fac, autoConfirm: auto }, 'Settings saved')} />
    </div>
  )
}

export default function ProfileEditor() {
  useDocumentTitle('Hospital profile')
  const { h } = useMyHospital()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'details')
  useEffect(() => { setParams({ tab }, { replace: true }) }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!h) return null
  const Body = { details: Details, location: Location, hours: Hours, services: Services, departments: Departments, doctors: Doctors, media: Media, settings: SettingsTab }[tab]
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold">Hospital profile</h1><p className="mt-1 text-[14px] text-slate-600">Control what patients see on your public profile.</p></div>
        <a href={`#/hospitals/${h.id}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm"><Eye size={15} /> Preview as patient</a>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 ring-1 ring-line scrollbar-none lg:flex-col lg:self-start" aria-label="Profile sections">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} aria-current={tab === t.k} className={cn('relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[14px] font-medium', tab === t.k ? 'text-white' : 'text-slate-600 hover:bg-canvas')}>
              {tab === t.k && <motion.span layoutId="ptab" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <span className="relative flex items-center gap-2.5"><t.i size={16} />{t.l}</span>
            </button>
          ))}
        </nav>
        <motion.section key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6"><Body h={h} /></motion.section>
      </div>
    </div>
  )
}
