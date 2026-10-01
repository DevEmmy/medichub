import { BedDouble, BellRing, CalendarCheck, FileBarChart, Send } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../contexts/ToastContext'
import { isPremium, sendWeeklyReportNow, setAutomation } from '../../services/plans'
import { updateHospitalProfile } from '../../services/hospitals'
import { PremiumLock } from './Analytics'
import type { Automations as A } from '../../types'
import { cn } from '../../utils/cn'

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-brand-600' : 'bg-slate-300', disabled && 'opacity-50')}>
      <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

export default function Automations() {
  useDocumentTitle('Automations')
  const { h } = useMyHospital()
  const { toast } = useToast()
  if (!h) return null
  const premium = isPremium(h)
  const a: A = h.automations ?? { patientReminders: false, lowBedAlert: false, weeklyReport: false }
  const set = async (key: keyof A, v: boolean) => { try { await setAutomation(h.id, key, v); toast('success', v ? 'Automation on' : 'Automation off') } catch (e) { toast('error', 'Could not change', (e as Error).message) } }
  const rows: { key: keyof A; icon: typeof BellRing; title: string; body: string }[] = [
    { key: 'patientReminders', icon: BellRing, title: 'Patient reminders', body: 'The day before each visit, patients get a reminder with a one-tap cancel, so empty slots can be rebooked.' },
    { key: 'lowBedAlert', icon: BedDouble, title: 'Low-bed alert', body: 'When free beds fall below 10%, staff on duty are alerted to update capacity so patients are routed elsewhere.' },
    { key: 'weeklyReport', icon: FileBarChart, title: 'Weekly report', body: 'Every Monday at 8:00, management gets bookings, no-shows, ratings and status freshness for the week.' },
  ]
  const body = (
    <div className="space-y-3">
      {rows.map((r) => (
        <section key={r.key} className="flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-line">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><r.icon size={20} /></span>
          <div className="min-w-0 flex-1"><h2 className="text-[16px] font-semibold">{r.title}</h2><p className="mt-0.5 text-[13.5px] text-slate-600">{r.body}</p>
            {r.key === 'weeklyReport' && premium && <button onClick={async () => { await sendWeeklyReportNow(h.id); toast('success', 'Report sent', 'Check your notifications.') }} className="btn btn-secondary btn-sm mt-3"><Send size={14} /> Send this week's report now</button>}
          </div>
          <Toggle label={r.title} on={premium && a[r.key]} disabled={!premium} onChange={(v) => set(r.key, v)} />
        </section>
      ))}
      <section className="flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-line">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><CalendarCheck size={20} /></span>
        <div className="min-w-0 flex-1"><h2 className="text-[16px] font-semibold">Auto-confirm bookings <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-brand-700">Free</span></h2><p className="mt-0.5 text-[13.5px] text-slate-600">Confirm new bookings instantly instead of reviewing each one.</p></div>
        <Toggle label="Auto-confirm bookings" on={h.autoConfirm} onChange={async (v) => { await updateHospitalProfile(h.id, { autoConfirm: v }); toast('success', v ? 'Bookings confirm automatically' : 'You will confirm each booking') }} />
      </section>
    </div>
  )
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="flex items-center gap-2 text-[28px] font-semibold">Automations <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-700">Premium</span></h1><p className="mt-1 text-[14px] text-slate-600">Let Medic Hub handle routine follow-ups. 12-hour status reminders are always on, on every plan.</p></div>
      {premium ? body : <PremiumLock title="Automations">{body}</PremiumLock>}
    </div>
  )
}
