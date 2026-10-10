import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Clock3, Crown, Mail, MailCheck, MailWarning, Pencil, Phone, Plus, Send, Trash2, UserRound, Users } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLive } from '../../hooks/useLive'
import { useToast } from '../../contexts/ToastContext'
import { db } from '../../lib/store'
import { ALERT_LABELS, DEFAULT_ALERTS, emailStatus, removeTeamMember, saveTeamMember, sendTestEmail, TEAM_ROLES, type MemberInput } from '../../services/team'
import { isPremium } from '../../services/plans'
import { Modal } from '../../components/ui/Modal'
import { Field, SelectField, Toggle } from '../../components/ui/Field'
import { EmptyState, Spinner } from '../../components/ui/States'
import { relTime } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { EmailLog, TeamAlerts, TeamMember } from '../../types'

const KIND: Record<EmailLog['kind'], string> = {
  doctor_assigned: 'Doctor told', new_booking: 'New booking', paid: 'Paid booking', cancelled: 'Cancellation', rescheduled: 'Reschedule', daily_schedule: 'Morning schedule',
  test: 'Test email', patient_confirmation: 'Patient confirmation', patient_update: 'Patient update',
}
const STATUS: Record<EmailLog['status'], { label: string; cls: string; icon: typeof MailCheck }> = {
  sent: { label: 'Delivered', cls: 'bg-brand-50 text-brand-700', icon: MailCheck },
  queued: { label: 'Sending', cls: 'bg-slate-100 text-slate-600', icon: Clock3 },
  failed: { label: 'Failed', cls: 'bg-danger-50 text-danger-700', icon: MailWarning },
  simulated: { label: 'Demo (not sent)', cls: 'bg-amber-50 text-amber-800', icon: Mail },
}
const blank = (): MemberInput => ({ name: '', role: 'Front desk', email: '', phone: '', departmentId: '', alerts: { ...DEFAULT_ALERTS } })

export default function Team() {
  useDocumentTitle('Team & email alerts')
  const { h, hospitalId } = useMyHospital()
  const { toast } = useToast()
  const { data: team = [] } = useLive(() => db.select('hospital_team').filter((m) => m.hospitalId === hospitalId).sort((a, b) => a.name.localeCompare(b.name)), ['hospital_team'], [hospitalId])
  const { data: log = [] } = useLive(() => db.select('email_log').filter((m) => m.hospitalId === hospitalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60), ['email_log'], [hospitalId])
  const { data: depts = [] } = useLive(() => db.select('hospital_departments').filter((d) => d.hospitalId === hospitalId), ['hospital_departments'], [hospitalId])
  const [live, setLive] = useState<boolean | null>(null)
  const [form, setForm] = useState<MemberInput | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<TeamMember | null>(null)
  const premium = isPremium(h)
  useEffect(() => { emailStatus().then((r) => setLive(r.enabled)).catch(() => setLive(false)) }, [])

  const deptName = useMemo(() => Object.fromEntries(depts.map((d) => [d.id, d.name])), [depts])
  const sentToday = log.filter((l) => l.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length

  const save = async () => {
    if (!form) return
    setBusy('save'); setErr(null)
    try {
      const m = await saveTeamMember(hospitalId, { ...form, departmentId: form.departmentId || undefined })
      toast('success', form.id ? 'Team member updated' : 'Team member added', `${m.name} will get booking emails at ${m.email}.`)
      setForm(null)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }
  const test = async (m: TeamMember) => {
    setBusy('test-' + m.id)
    try {
      const r = await sendTestEmail(hospitalId, m.id)
      if (r.status === 'failed') toast('error', 'Email could not be delivered', r.error)
      else toast('success', r.status === 'simulated' ? 'Test email recorded' : 'Test email sent', r.status === 'simulated' ? 'This demo has no email provider. The live app delivers it to the inbox.' : `Check ${m.email} (and the spam folder the first time).`)
    } catch (e) { toast('error', 'Could not send', (e as Error).message) } finally { setBusy(null) }
  }
  const toggleActive = async (m: TeamMember) => {
    try { await saveTeamMember(hospitalId, { ...m, active: !m.active }) } catch (e) { toast('error', 'Could not update', (e as Error).message) }
  }
  const remove = async (m: TeamMember) => {
    setConfirm(null)
    try { await removeTeamMember(hospitalId, m.id); toast('success', `${m.name} removed`, 'They will no longer receive booking emails.') } catch (e) { toast('error', 'Could not remove', (e as Error).message) }
  }
  const setAlert = (k: keyof TeamAlerts, v: boolean) => form && setForm({ ...form, alerts: { ...form.alerts, [k]: v } })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold">Team & email alerts</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-slate-600">Add the people who handle appointments, with their Gmail or work email. Every time a patient books, pays, cancels or is rescheduled, each of them gets an email straight away. They don't need a Medic Hub login.</p>
        </div>
        <button onClick={() => { setErr(null); setForm(blank()) }} className="btn btn-primary" data-testid="add-member"><Plus size={16} /> Add team member</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="People on the team" value={String(team.filter((m) => m.active).length)} />
        <Stat icon={Send} label="Emails today" value={String(sentToday)} />
        <div className={cn('rounded-2xl p-4 ring-1', live ? 'bg-brand-50 ring-brand-100' : 'bg-amber-50 ring-amber-100')} data-testid="email-mode">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">{live ? <MailCheck size={16} className="text-brand-700" /> : <Mail size={16} className="text-amber-700" />} Email delivery</p>
          <p className="mt-1 text-[14px] font-bold text-ink">{live === null ? '…' : live ? 'Live: emails go to inboxes' : 'Demo: emails are recorded, not sent'}</p>
        </div>
      </div>

      <section>
        <h2 className="text-[17px] font-semibold">Who gets booking emails</h2>
        {team.length === 0 ? (
          <EmptyState className="mt-3" icon={<Users size={22} />} title="No one is getting booking emails yet" body="Add your front desk, doctors and nurses so nobody misses a booking." action={<button onClick={() => setForm(blank())} className="btn btn-primary btn-sm"><Plus size={15} /> Add the first person</button>} />
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2" data-testid="team-list">
            <AnimatePresence initial={false}>
              {team.map((m) => (
                <motion.li key={m.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: m.active ? 1 : 0.6, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lime-200 text-[15px] font-bold text-ink" aria-hidden>{m.name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '').split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-ink">{m.name}</p>
                      <p className="text-[12.5px] text-slate-500">{m.role}{m.departmentId ? ` · ${deptName[m.departmentId] ?? 'Department'} only` : ' · All bookings'}</p>
                      <a href={`mailto:${m.email}`} className="mt-1 flex items-start gap-1.5 break-all text-[13.5px] font-semibold text-brand-700"><Mail size={13} className="mt-1 shrink-0" /> {m.email}</a>
                      {m.phone && <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500"><Phone size={12} /> {m.phone}</p>}
                    </div>
                    <button type="button" role="switch" aria-checked={m.active} aria-label={`Booking emails for ${m.name}`} onClick={() => toggleActive(m)} title={m.active ? 'Emails on' : 'Emails paused'}
                      className={cn('relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition', m.active ? 'bg-brand-600' : 'bg-slate-300')}>
                      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition', m.active ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Object.keys(ALERT_LABELS) as (keyof TeamAlerts)[]).filter((k) => m.alerts[k]).map((k) => <span key={k} className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 ring-1 ring-line">{ALERT_LABELS[k].label}</span>)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    <button onClick={() => test(m)} disabled={busy === 'test-' + m.id || !m.active} className="btn btn-secondary btn-sm" data-testid="test-email">{busy === 'test-' + m.id ? <Spinner /> : <Send size={14} />} Send test email</button>
                    <button onClick={() => { setErr(null); setForm({ id: m.id, name: m.name, role: m.role, email: m.email, phone: m.phone ?? '', departmentId: m.departmentId ?? '', alerts: { ...m.alerts }, active: m.active }) }} className="btn btn-ghost btn-sm"><Pencil size={14} /> Edit</button>
                    <button onClick={() => setConfirm(m)} className="btn btn-ghost btn-sm ml-auto text-danger-700" aria-label={`Remove ${m.name}`}><Trash2 size={14} /> Remove</button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-[17px] font-semibold">Email activity</h2>
          <p className="text-[12.5px] text-slate-500">Every email sent for your hospital, newest first</p>
        </div>
        {log.length === 0 ? <EmptyState className="mt-3" icon={<Mail size={22} />} title="No emails yet" body="When patients book, the emails sent to your team and to patients appear here." /> : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line" data-testid="email-log">
            {log.map((l) => { const st = STATUS[l.status]; const isOpen = open === l.id; return (
              <li key={l.id}>
                <button onClick={() => setOpen(isOpen ? null : l.id)} aria-expanded={isOpen} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-canvas">
                  <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', st.cls)}><st.icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{l.subject}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">{KIND[l.kind]} · to {l.toName ? `${l.toName} <${l.toEmail}>` : l.toEmail}{l.audience === 'patient' ? ' (patient)' : ''}</span>
                  </span>
                  <span className="shrink-0 text-right"><span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-bold', st.cls)}>{st.label}</span><span className="mt-0.5 block text-[11.5px] text-slate-400">{relTime(l.createdAt)}</span></span>
                </button>
                {isOpen && (
                  <div className="bg-canvas px-4 pb-4 pt-1">
                    {l.error && <p className={cn('mb-2 rounded-xl px-3 py-2 text-[12.5px]', l.status === 'failed' ? 'bg-danger-50 text-danger-700' : 'bg-amber-50 text-amber-800')}>{l.error}</p>}
                    <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 font-sans text-[13px] leading-relaxed text-slate-700 ring-1 ring-line">{l.body}</pre>
                  </div>
                )}
              </li>
            ) })}
          </ul>
        )}
      </section>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit team member' : 'Add team member'} footer={
        <div className="flex gap-2"><button onClick={() => setForm(null)} className="btn btn-ghost flex-1">Cancel</button><button onClick={save} disabled={busy === 'save'} className="btn btn-primary flex-1" data-testid="save-member">{busy === 'save' ? <Spinner /> : <CheckCircle2 size={16} />} Save</button></div>
      }>
        {form && (
          <div className="space-y-3.5">
            {err && <p role="alert" className="rounded-xl bg-danger-50 px-3 py-2.5 text-[13.5px] font-medium text-danger-700">{err}</p>}
            <Field label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ngozi Eze" maxLength={120} data-autofocus />
            <Field label="Email (Gmail or work email)" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@gmail.com" maxLength={200} />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberInput['role'] })}>{TEAM_ROLES.map((r) => <option key={r}>{r}</option>)}</SelectField>
              <Field label="Phone (optional)" type="tel" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 …" maxLength={40} />
            </div>
            <SelectField label="Which bookings?" hint="Pick a department so specialists only hear about their own patients." value={form.departmentId ?? ''} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">All bookings</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name} only</option>)}
            </SelectField>
            <fieldset className="space-y-3 rounded-2xl bg-canvas p-4 ring-1 ring-line">
              <legend className="sr-only">Emails to send</legend>
              <p className="text-[13px] font-semibold text-slate-700">Email them about</p>
              {(Object.keys(ALERT_LABELS) as (keyof TeamAlerts)[]).map((k) => (
                <div key={k}>
                  <Toggle checked={form.alerts[k]} onChange={(v) => setAlert(k, v)} label={ALERT_LABELS[k].label} description={ALERT_LABELS[k].hint} />
                  {ALERT_LABELS[k].premium && !premium && form.alerts[k] && <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700"><Crown size={13} /> Morning schedules start when you're on Premium. <Link to="/hospital/plan" className="underline">See plans</Link></p>}
                </div>
              ))}
            </fieldset>
          </div>
        )}
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Remove from team?" size="sm" footer={
        <div className="flex gap-2"><button onClick={() => setConfirm(null)} className="btn btn-ghost flex-1">Keep</button><button onClick={() => confirm && remove(confirm)} className="btn btn-danger flex-1" data-testid="confirm-remove">Remove</button></div>
      }>
        <p className="text-[14.5px] text-slate-600"><UserRound size={15} className="mr-1 inline" /> {confirm?.name} ({confirm?.email}) will stop getting booking emails. You can add them again any time.</p>
      </Modal>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-600"><Icon size={16} /> {label}</p>
      <p className="mt-1 font-display text-[26px] font-extrabold text-ink tabular">{value}</p>
    </div>
  )
}
