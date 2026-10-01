import { useState } from 'react'
import { BellRing, CheckCheck, Mail } from 'lucide-react'
import { ageLabel, freshnessOf, hoursSince, lastUpdate, REMINDER_HOURS, STALE_HOURS } from '../../utils/freshness'
import { confirmStatus } from '../../services/reminders'
import { useToast } from '../../contexts/ToastContext'
import { cn } from '../../utils/cn'
import type { HospitalView } from '../../services/hospitals'

/** Staff-side: how stale your status is, the reminder schedule, and a one-tap "still correct". */
export function FreshnessPanel({ h, detailed = false }: { h: HospitalView; detailed?: boolean }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const f = freshnessOf(h)
  const hrs = hoursSince(lastUpdate(h))
  const confirm = async () => {
    setBusy(true)
    try { await confirmStatus(h.id); toast('success', 'Status confirmed', 'Patients now see it as freshly updated.') }
    catch (e) { toast('error', 'Could not confirm', (e as Error).message) }
    finally { setBusy(false) }
  }
  if (f === 'fresh' && !detailed) return null
  const tone = f === 'stale' ? 'bg-danger-50 ring-danger-100' : f === 'ageing' ? 'bg-amber-50 ring-amber-100' : 'bg-white ring-line'
  const head = f === 'stale' ? `Not updated for ${ageLabel(hrs)}. Patients are told your availability is at risk.` : f === 'ageing' ? `Not updated for ${ageLabel(hrs)}. Patients now see a "not updated" warning.` : `Last updated ${ageLabel(hrs)} ago. Patients see your status as current.`
  return (
    <section className={cn('rounded-2xl p-4 ring-1 sm:p-5', tone)} aria-labelledby="fresh-h" data-testid="freshness-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <BellRing size={20} className={cn('shrink-0', f === 'stale' ? 'text-danger-600' : f === 'ageing' ? 'text-amber-700' : 'text-brand-700')} />
        <div className="min-w-0 flex-1">
          <h2 id="fresh-h" className="text-[15px] font-semibold text-ink">{head}</h2>
          <p className="mt-0.5 text-[13px] text-slate-600">If nothing has changed, confirm it. Any change you make below also counts as an update.</p>
        </div>
        <button onClick={confirm} disabled={busy} className="btn btn-primary btn-sm shrink-0" data-testid="confirm-status"><CheckCheck size={15} /> {busy ? 'Confirming…' : 'Still correct'}</button>
      </div>
      {detailed && (
        <div className="mt-4 grid gap-2 text-[13px] text-slate-700 sm:grid-cols-3">
          <p className="rounded-xl bg-canvas p-3"><strong className="block text-ink">Every {REMINDER_HOURS} hours</strong>Medic Hub emails your operations contact ({h.admin.email || h.email}) if the status hasn't been touched, timed to shift handover.</p>
          <p className="rounded-xl bg-canvas p-3"><strong className="block text-ink">After {REMINDER_HOURS} hours</strong>Patients see "Not updated, may have changed" on your card and profile.</p>
          <p className="rounded-xl bg-canvas p-3"><strong className="block text-ink">After {STALE_HOURS} hours</strong>Patients are told availability is at risk and to call before travelling. A second, urgent email goes out.</p>
          <p className="flex items-center gap-1.5 text-[12px] text-slate-500 sm:col-span-3"><Mail size={13} /> In this demo the emails arrive in your notifications (bell icon) instead of an inbox.</p>
        </div>
      )}
    </section>
  )
}
