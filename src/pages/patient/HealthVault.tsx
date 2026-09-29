import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { CalendarCheck, Contact, Droplet, FlaskConical, HeartPulse, Lock, Pencil, Phone, Pill as PillIcon, Plus, Star, Stethoscope, Syringe, Trash2, UserRound, X, History, ShieldPlus } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { addEvent, deleteContact, deleteEvent, myContacts, myEvents, myHealthProfile, saveContact, saveHealthProfile } from '../../services/health'
import { myBookings } from '../../services/bookings'
import { useToast } from '../../contexts/ToastContext'
import { Modal } from '../../components/ui/Modal'
import { Field, SelectField, TextArea, Toggle } from '../../components/ui/Field'
import { EmptyState, Spinner } from '../../components/ui/States'
import { fmtDate, parseDate, today } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { EmergencyContact, HealthEventType, HealthProfile } from '../../types'

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENO = ['AA', 'AS', 'AC', 'SS', 'SC']

function TagInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState('')
  const add = () => { const t = v.trim(); if (t && !values.includes(t)) onChange([...values, t]); setV('') }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } else if (e.key === 'Backspace' && !v && values.length) onChange(values.slice(0, -1)) }
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-slate-700">{label}</label>
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
        {values.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-mist px-2 py-1 text-[13px] font-medium text-ink">{t}<button type="button" onClick={() => onChange(values.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-slate-500 hover:text-ink"><X size={13} /></button></span>)}
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={values.length ? '' : placeholder} className="min-w-[120px] flex-1 bg-transparent px-1.5 py-1 text-[15px] outline-none" aria-label={label} />
      </div>
      <p className="text-[12px] text-slate-500">Press Enter to add.</p>
    </div>
  )
}

function ProfileEditor({ hp, onDone }: { hp: HealthProfile; onDone: () => void }) {
  const [f, setF] = useState(hp)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const save = async () => {
    setBusy(true)
    try { await saveHealthProfile({ ...f, medications: f.medications.filter((m) => m.name.trim()) }); toast('success', 'Health Vault updated'); onDone() } catch (e) { toast('error', 'Could not save', (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Blood group" value={f.bloodGroup} onChange={(e) => setF({ ...f, bloodGroup: e.target.value })}><option value="">Not sure</option>{BLOOD.map((b) => <option key={b}>{b}</option>)}</SelectField>
        <SelectField label="Genotype" value={f.genotype} onChange={(e) => setF({ ...f, genotype: e.target.value })}><option value="">Not sure</option>{GENO.map((b) => <option key={b}>{b}</option>)}</SelectField>
      </div>
      <TagInput label="Allergies" values={f.allergies} onChange={(allergies) => setF({ ...f, allergies })} placeholder="e.g. Penicillin, groundnuts" />
      <TagInput label="Chronic conditions" values={f.conditions} onChange={(conditions) => setF({ ...f, conditions })} placeholder="e.g. Asthma, hypertension" />
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-slate-700">Medications</p>
        {f.medications.map((m, i) => (
          <div key={i} className="flex gap-2">
            <input className="input flex-1" value={m.name} placeholder="Name" aria-label={`Medication ${i + 1} name`} onChange={(e) => setF({ ...f, medications: f.medications.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <input className="input w-[40%]" value={m.dose} placeholder="Dose" aria-label={`Medication ${i + 1} dose`} onChange={(e) => setF({ ...f, medications: f.medications.map((x, j) => (j === i ? { ...x, dose: e.target.value } : x)) })} />
            <button type="button" onClick={() => setF({ ...f, medications: f.medications.filter((_, j) => j !== i) })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-mist" aria-label="Remove medication"><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setF({ ...f, medications: [...f.medications, { name: '', dose: '' }] })} className="btn btn-ghost btn-sm"><Plus size={15} /> Add medication</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)" type="number" inputMode="numeric" value={f.heightCm ?? ''} onChange={(e) => setF({ ...f, heightCm: e.target.value ? Number(e.target.value) : undefined })} />
        <Field label="Weight (kg)" type="number" inputMode="numeric" value={f.weightKg ?? ''} onChange={(e) => setF({ ...f, weightKg: e.target.value ? Number(e.target.value) : undefined })} />
      </div>
      <TextArea label="Important information" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Anything responders should know, like a pacemaker or pregnancy." />
      <div className="flex gap-2 pt-1"><button onClick={onDone} className="btn btn-secondary flex-1">Cancel</button><button onClick={save} disabled={busy} className="btn btn-primary flex-1">{busy && <Spinner />} Save</button></div>
    </div>
  )
}

function ContactForm({ c, onDone }: { c?: EmergencyContact; onDone: () => void }) {
  const [f, setF] = useState({ name: c?.name ?? '', relationship: c?.relationship ?? 'Family', phone: c?.phone ?? '', primary: c?.primary ?? false })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const save = async () => { setBusy(true); setErr(null); try { await saveContact({ ...f, id: c?.id }); toast('success', c ? 'Contact updated' : 'Contact added'); onDone() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }
  return (
    <div className="space-y-4">
      <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
      <SelectField label="Relationship" value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>{['Family', 'Mother', 'Father', 'Spouse', 'Partner', 'Brother', 'Sister', 'Friend', 'Neighbour', 'Colleague', 'Doctor'].map((r) => <option key={r}>{r}</option>)}</SelectField>
      <Field label="Phone number" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+234 803 000 0000" error={err} autoComplete="tel" />
      <Toggle checked={f.primary} onChange={(primary) => setF({ ...f, primary })} label="Primary contact" description="Shown first in emergency mode." />
      <div className="flex gap-2"><button onClick={onDone} className="btn btn-secondary flex-1">Cancel</button><button onClick={save} disabled={busy} className="btn btn-primary flex-1">{busy && <Spinner />} Save contact</button></div>
    </div>
  )
}

const EV_ICON: Record<HealthEventType, typeof Syringe> = { appointment: CalendarCheck, visit: Stethoscope, vaccination: Syringe, lab: FlaskConical, medication: PillIcon, profile: UserRound }
const EV_LABEL: Record<HealthEventType, string> = { appointment: 'Appointment', visit: 'Hospital visit', vaccination: 'Vaccination', lab: 'Lab record', medication: 'Medication', profile: 'Profile update' }

function EventForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ type: 'vaccination' as HealthEventType, title: '', detail: '', date: today(), place: '' })
  const [err, setErr] = useState<string | null>(null)
  const { toast } = useToast()
  const save = async () => { try { await addEvent(f); toast('success', 'Added to your timeline'); onDone() } catch (e) { setErr((e as Error).message) } }
  return (
    <div className="space-y-4">
      <SelectField label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as HealthEventType })}>{(['vaccination', 'lab', 'medication', 'visit'] as HealthEventType[]).map((t) => <option key={t} value={t}>{EV_LABEL[t]}</option>)}</SelectField>
      <Field label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Yellow fever vaccine" error={err} />
      <Field label="Date" type="date" value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} />
      <Field label="Where (optional)" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} />
      <TextArea label="Notes (optional)" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
      <div className="flex gap-2"><button onClick={onDone} className="btn btn-secondary flex-1">Cancel</button><button onClick={save} className="btn btn-primary flex-1">Add entry</button></div>
    </div>
  )
}

export default function HealthVault() {
  useDocumentTitle('Health Vault')
  const { data: hp } = useLive(myHealthProfile, ['health_profiles'])
  const { data: contacts = [] } = useLive(myContacts, ['emergency_contacts'])
  const { data: events = [] } = useLive(myEvents, ['health_events'])
  const { data: bookings = [] } = useLive(myBookings, ['bookings', 'hospitals', 'hospital_services'])
  const { toast } = useToast()
  const [tab, setTab] = useState<'snapshot' | 'contacts' | 'timeline'>(() => (location.hash.includes('contacts') ? 'contacts' : 'snapshot'))
  const [editing, setEditing] = useState(false)
  const [contactModal, setContactModal] = useState<{ c?: EmergencyContact } | null>(null)
  const [eventModal, setEventModal] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  useEffect(() => { if (confirmDel) { const t = setTimeout(() => setConfirmDel(null), 3500); return () => clearTimeout(t) } }, [confirmDel])

  const timeline = useMemo(() => {
    const fromBookings = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'completed').map((b) => ({ id: 'b' + b.id, type: 'appointment' as HealthEventType, title: b.serviceName, detail: b.date >= today() ? `Upcoming · ${b.ref}` : `Booked · ${b.ref}`, date: b.date, place: b.hospitalName, own: false }))
    return [...events.map((e) => ({ ...e, own: e.type !== 'profile' })), ...fromBookings].sort((a, b) => b.date.localeCompare(a.date))
  }, [events, bookings])
  const byMonth = useMemo(() => {
    const m = new Map<string, typeof timeline>()
    timeline.forEach((e) => { const k = parseDate(e.date).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }); m.set(k, [...(m.get(k) ?? []), e]) })
    return [...m.entries()]
  }, [timeline])

  if (!hp) return null
  const bmi = hp.heightCm && hp.weightKg ? (hp.weightKg / (hp.heightCm / 100) ** 2).toFixed(1) : null

  return (
    <div className="container-app max-w-4xl py-8">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-[32px] font-semibold">Health Vault</h1><p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-slate-600"><Lock size={14} /> Private to you. Hospitals can't see this.</p></div>
      </div>
      <div className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-soft ring-1 ring-black/5 scrollbar-none" role="tablist">
        {([['snapshot', 'Snapshot', ShieldPlus], ['contacts', 'Emergency contacts', Contact], ['timeline', 'Timeline', History]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[14px] font-semibold', tab === k ? 'text-white' : 'text-slate-600')}>
            {tab === k && <motion.span layoutId="vtab" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative flex items-center gap-2"><I size={16} />{l}</span>
          </button>
        ))}
      </div>

      {tab === 'snapshot' && (
        <section className="mt-6 space-y-5">
          <div className="overflow-hidden rounded-[28px] bg-white shadow-lift ring-1 ring-black/5">
            <div className="flex items-center justify-between bg-danger-600 px-5 py-3.5 text-white">
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em]"><HeartPulse size={16} /> Emergency snapshot</p>
              {!editing && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/25"><Pencil size={13} /> Edit</button>}
            </div>
            {editing ? <div className="p-5"><ProfileEditor hp={hp} onDone={() => setEditing(false)} /></div> : (
              <div className="p-5">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[['Blood group', hp.bloodGroup || '—', Droplet], ['Genotype', hp.genotype || '—', HeartPulse]].map(([k, v, I]) => (
                    <div key={k as string} className="rounded-2xl bg-danger-50 p-4"><dt className="flex items-center gap-1.5 text-[12px] font-semibold text-danger-700"><I size={13} />{k as string}</dt><dd className="mt-1 font-display text-[34px] font-semibold leading-none text-ink">{v as string}</dd></div>
                  ))}
                  <div className="col-span-2 rounded-2xl bg-canvas p-4"><dt className="text-[12px] font-semibold text-slate-500">Allergies</dt><dd className="mt-1.5 flex flex-wrap gap-1.5">{hp.allergies.length ? hp.allergies.map((a) => <span key={a} className="rounded-lg bg-coral-100 px-2.5 py-1 text-[14px] font-semibold text-coral-600">{a}</span>) : <span className="text-[15px] text-slate-500">None recorded</span>}</dd></div>
                  <div className="col-span-2 rounded-2xl bg-canvas p-4"><dt className="text-[12px] font-semibold text-slate-500">Conditions</dt><dd className="mt-1.5 text-[16px] font-semibold text-ink">{hp.conditions.join(', ') || <span className="font-normal text-slate-500">None recorded</span>}</dd></div>
                  <div className="col-span-2 rounded-2xl bg-canvas p-4"><dt className="text-[12px] font-semibold text-slate-500">Medications</dt><dd className="mt-1.5 space-y-1">{hp.medications.length ? hp.medications.map((m) => <p key={m.name} className="text-[15px]"><strong className="text-ink">{m.name}</strong> <span className="text-slate-500">· {m.dose}</span></p>) : <span className="text-[15px] text-slate-500">None recorded</span>}</dd></div>
                </dl>
                {(hp.notes || bmi) && <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">{hp.notes && <p className="rounded-2xl bg-amber-50 p-4 text-[14.5px] text-amber-900 ring-1 ring-amber-100"><strong>Important:</strong> {hp.notes}</p>}{bmi && <p className="rounded-2xl bg-canvas p-4 text-[13px] text-slate-600">{hp.heightCm} cm · {hp.weightKg} kg<br /><span className="text-slate-500">BMI {bmi}</span></p>}</div>}
                {contacts[0] && (
                  <a href={`tel:${contacts[0].phone.replace(/\s/g, '')}`} className="mt-3 flex min-h-[56px] items-center gap-3 rounded-2xl bg-ink px-4 text-white"><Phone size={18} /><span className="flex-1 text-[15px] font-semibold">Call {contacts[0].name} <span className="font-normal text-white/60">· {contacts[0].relationship}</span></span><span className="select-all text-[13px] text-white/60">{contacts[0].phone}</span></a>
                )}
              </div>
            )}
          </div>
          <p className="text-[12.5px] text-slate-500">Updated {fmtDate(hp.updatedAt.slice(0, 10))}. This snapshot also appears in emergency mode.</p>
        </section>
      )}

      {tab === 'contacts' && (
        <section className="mt-6">
          <div className="flex items-center justify-between"><h2 className="text-[20px] font-semibold">Trusted contacts</h2><button onClick={() => setContactModal({})} className="btn btn-primary btn-sm"><Plus size={15} /> Add contact</button></div>
          {contacts.length === 0 ? <EmptyState className="mt-4" icon={<Contact size={22} />} title="No emergency contacts" body="Add someone we can help you reach quickly in an emergency." action={<button onClick={() => setContactModal({})} className="btn btn-primary btn-sm">Add contact</button>} /> : (
            <ul className="mt-4 space-y-3">
              {contacts.map((c) => (
                <motion.li layout key={c.id} className="card flex flex-wrap items-center gap-3 p-4">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 font-display text-[16px] font-semibold text-brand-800">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-[15.5px] font-semibold text-ink">{c.name}{c.primary && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Star size={11} fill="currentColor" /> Primary</span>}</p><p className="text-[13px] text-slate-500">{c.relationship} · <span className="select-all">{c.phone}</span></p></div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="btn btn-brand btn-sm flex-1 sm:flex-none"><Phone size={15} /> Call</a>
                    <button onClick={() => setContactModal({ c })} className="btn btn-secondary btn-sm" aria-label={`Edit ${c.name}`}><Pencil size={15} /></button>
                    <button onClick={async () => { if (confirmDel !== c.id) { setConfirmDel(c.id); return } await deleteContact(c.id); toast('success', 'Contact removed') }} className={cn('btn btn-sm', confirmDel === c.id ? 'btn-danger' : 'btn-secondary')} aria-label={`Remove ${c.name}`}>{confirmDel === c.id ? 'Confirm' : <Trash2 size={15} />}</button>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'timeline' && (
        <section className="mt-6">
          <div className="flex items-center justify-between"><h2 className="text-[20px] font-semibold">Health timeline</h2><button onClick={() => setEventModal(true)} className="btn btn-primary btn-sm"><Plus size={15} /> Add entry</button></div>
          {byMonth.length === 0 ? <EmptyState className="mt-4" icon={<History size={22} />} title="Your timeline is empty" body="Appointments, visits and records you add will show up here." /> : (
            <div className="mt-5 space-y-8">
              {byMonth.map(([month, list]) => (
                <div key={month}>
                  <p className="eyebrow">{month}</p>
                  <ol className="relative mt-3 space-y-3 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-line">
                    {list.map((e) => { const I = EV_ICON[e.type]; return (
                      <motion.li layout key={e.id} className="relative flex gap-4">
                        <span className={cn('relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full ring-4 ring-canvas', e.type === 'appointment' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-canvas shadow-soft')}><I size={17} /></span>
                        <div className="card min-w-0 flex-1 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0"><p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">{EV_LABEL[e.type]} · {fmtDate(e.date)}</p><p className="mt-0.5 text-[15px] font-semibold text-ink">{e.title}</p></div>
                            {e.own && <button onClick={async () => { await deleteEvent(e.id); toast('success', 'Entry removed') }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-mist hover:text-ink" aria-label={`Delete ${e.title}`}><Trash2 size={14} /></button>}
                          </div>
                          {(e.detail || e.place) && <p className="mt-1 text-[13.5px] text-slate-600">{[e.place, e.detail].filter(Boolean).join(' · ')}</p>}
                        </div>
                      </motion.li>
                    ) })}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal open={!!contactModal} onClose={() => setContactModal(null)} title={contactModal?.c ? 'Edit contact' : 'Add emergency contact'} size="sm">{contactModal && <ContactForm c={contactModal.c} onDone={() => setContactModal(null)} />}</Modal>
      <Modal open={eventModal} onClose={() => setEventModal(false)} title="Add to timeline" size="sm"><EventForm onDone={() => setEventModal(false)} /></Modal>
    </div>
  )
}
