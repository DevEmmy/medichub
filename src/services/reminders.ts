// Status-freshness reminders.
// Demo: a sweep runs in the browser on load and every few minutes, and the "email" is
// delivered as an in-app notification to the hospital's staff (no email provider here).
// Production: server/reminders.example.ts runs the same rule on a schedule and sends a
// real email (and SMS) to the hospital's operations contact.
import { db } from '../lib/store'
import { notify } from './notifications'
import { requireHospitalStaff } from './core'
import { ageLabel, hoursSince, lastUpdate, REMINDER_HOURS, STALE_HOURS } from '../utils/freshness'

export function runReminderSweep(now = Date.now()) {
  const hospitals = db.select('hospitals').filter((h) => !h.publicRecord && h.verification === 'verified')
  const statuses = db.select('hospital_status')
  const caps = db.select('hospital_capacity')
  const staff = db.select('hospital_staff')
  const due: { id: string; hrs: number; name: string; email: string }[] = []
  for (const h of hospitals) {
    const status = statuses.find((s) => s.hospitalId === h.id)
    const capacity = caps.find((c) => c.hospitalId === h.id)
    if (!status || !capacity) continue
    const hrs = hoursSince(lastUpdate({ status, capacity }), now)
    if (hrs < REMINDER_HOURS) continue
    if (status.lastReminderAt && hoursSince(status.lastReminderAt, now) < REMINDER_HOURS) continue
    due.push({ id: h.id, hrs, name: h.name, email: h.admin.email || h.email })
  }
  if (!due.length) return 0
  db.write(['hospital_status'], (d) => {
    for (const x of due) { const s = d.hospital_status.find((s) => s.hospitalId === x.id); if (s) s.lastReminderAt = new Date(now).toISOString() }
  })
  for (const x of due) {
    const urgent = x.hrs >= STALE_HOURS
    const title = urgent ? 'Urgent: patients now see your status as at risk' : 'Reminder: confirm your live status'
    const body = `Your live status was last updated ${ageLabel(x.hrs)} ago. ${urgent ? 'Patients are being told availability may be wrong.' : 'Patients now see a "not updated" warning.'} Update it or tap "Still correct". Email reminder sent to ${x.email}.`
    staff.filter((s) => s.hospitalId === x.id).forEach((s) => notify(s.userId, 'system', title, body, '/hospital/status'))
  }
  return due.length
}

/** "Nothing has changed" — staff confirm the current status is still correct. */
export async function confirmStatus(hospitalId: string) {
  requireHospitalStaff(hospitalId)
  const at = new Date().toISOString()
  db.write(['hospital_status', 'hospital_capacity'], (d) => {
    const s = d.hospital_status.find((x) => x.hospitalId === hospitalId); if (s) { s.updatedAt = at; s.lastReminderAt = undefined }
    const c = d.hospital_capacity.find((x) => x.hospitalId === hospitalId); if (c) c.updatedAt = at
  })
}

let timer: number | undefined
export function startReminderScheduler() {
  if (timer) return
  try { runReminderSweep() } catch { /* best effort */ }
  timer = window.setInterval(() => { try { runReminderSweep() } catch { /* ignore */ } }, 5 * 60_000)
}
