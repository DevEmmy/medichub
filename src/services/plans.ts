import { rpc } from '../lib/rpc'
// Freemium for hospitals.
// Basic (free forever): everything patients depend on — listing, live status, emergency line,
// bookings, check-in, slots, announcements, 12-hour status reminders, ratings + replies.
// Premium (paid): data analysis and automation that saves staff time.
// Paying never changes search ranking or the order of emergency results.
import { db } from '../lib/store'
import type { Automations, Hospital } from '../types'
import { AppError, ENUMS, latency, mailer, oneOf, requireHospitalStaff } from './core'
import { notify } from './notifications'
import { addDays, today } from '../utils/date'

export const PREMIUM_PRICE_NGN = 25000
export const TRIAL_DAYS = 30

export const BASIC_FEATURES = [
  'Listing in search and on the map',
  'Live status: emergency, beds, oxygen, blood bank and more',
  'Direct emergency line in emergency mode',
  'Online bookings, QR check-in and slot management',
  'Announcements to patients',
  'Status reminders every 12 hours',
  'Verified ratings and public replies',
]
export const PREMIUM_FEATURES = [
  { key: 'analytics', title: 'Analytics dashboard', body: '30-day booking trends, no-show rate, busiest hours, demand by service, rating trends.' },
  { key: 'export', title: 'CSV export', body: 'Download bookings for your records team or the State Ministry.' },
  { key: 'patientReminders', title: 'Automatic patient reminders', body: 'Patients get a reminder the day before their visit, cutting no-shows.' },
  { key: 'lowBedAlert', title: 'Low-bed alerts', body: 'Staff are alerted when free beds drop below 10%.' },
  { key: 'weeklyReport', title: 'Weekly performance report', body: 'A Monday summary of bookings, no-shows, ratings and status freshness.' },
]

export function isPremium(h?: Pick<Hospital, 'plan' | 'planTrialEndsAt'> | null): boolean {
  if (!h || h.plan !== 'premium') return false
  return !h.planTrialEndsAt || h.planTrialEndsAt >= today()
}
export function trialDaysLeft(h: Pick<Hospital, 'planTrialEndsAt'>): number | null {
  if (!h.planTrialEndsAt) return null
  return Math.max(0, Math.round((new Date(h.planTrialEndsAt).getTime() - new Date(today()).getTime()) / 86_400_000))
}

export const startPremiumTrial = rpc('plans.startPremiumTrial', async function startPremiumTrial(hospitalId: string) {
  requireHospitalStaff(hospitalId)
  await latency(400)
  db.write(['hospitals'], (d) => {
    const h = d.hospitals.find((x) => x.id === hospitalId)!
    h.plan = 'premium'; h.planTrialEndsAt = addDays(today(), TRIAL_DAYS)
    h.automations = { patientReminders: true, lowBedAlert: true, weeklyReport: true }
  })
  runAutomations()
})

export const downgradeToBasic = rpc('plans.downgradeToBasic', async function downgradeToBasic(hospitalId: string) {
  requireHospitalStaff(hospitalId)
  await latency(250)
  db.write(['hospitals'], (d) => {
    const h = d.hospitals.find((x) => x.id === hospitalId)!
    h.plan = 'basic'; h.planTrialEndsAt = undefined
  })
})

export const setAutomation = rpc('plans.setAutomation', async function setAutomation(hospitalId: string, key: keyof Automations, on: boolean) {
  oneOf(key, ENUMS.automation, 'automation'); on = on === true
  requireHospitalStaff(hospitalId)
  const h = db.select('hospitals').find((x) => x.id === hospitalId)
  if (!isPremium(h)) throw new AppError('forbidden', 'Automations are part of Premium.')
  db.write(['hospitals'], (d) => {
    const x = d.hospitals.find((y) => y.id === hospitalId)!
    x.automations = { ...(x.automations ?? { patientReminders: false, lowBedAlert: false, weeklyReport: false }), [key]: on }
  })
  if (on) runAutomations()
})

/** Weekly report, on demand (in production this goes out every Monday morning by email). */
export function weeklyReport(hospitalId: string) {
  const since = addDays(today(), -7)
  const bk = db.select('bookings').filter((b) => b.hospitalId === hospitalId && b.date >= since && b.date < today())
  const attended = bk.filter((b) => ['completed', 'checked_in', 'in_consultation'].includes(b.status)).length
  const noShow = bk.filter((b) => b.status === 'no_show').length
  const rv = db.select('hospital_reviews').filter((r) => r.hospitalId === hospitalId && r.createdAt.slice(0, 10) >= since)
  const avg = rv.length ? (rv.reduce((a, r) => a + r.rating, 0) / rv.length).toFixed(1) : '—'
  return { bookings: bk.length, attended, noShow, ratings: rv.length, avg }
}
export const sendWeeklyReportNow = rpc('plans.sendWeeklyReportNow', async function sendWeeklyReportNow(hospitalId: string) {
  requireHospitalStaff(hospitalId)
  await latency(250)
  await deliverWeeklyReport(hospitalId)
})

async function deliverWeeklyReport(hospitalId: string) {
  const r = weeklyReport(hospitalId)
  const text = `Last 7 days: ${r.bookings} bookings, ${r.attended} attended, ${r.noShow} no-shows, ${r.ratings} new ratings (avg ${r.avg}).`
  db.select('hospital_staff').filter((s) => s.hospitalId === hospitalId).forEach((s) => notify(s.userId, 'system', 'Your weekly report', text, '/hospital/analytics'))
  const h = db.select('hospitals').find((x) => x.id === hospitalId)
  const to = h?.admin.email || h?.email
  if (mailer.enabled && to) await mailer.send({ to, subject: `Weekly report · ${h!.name}`, text: `${text}\n\nFull analytics: ${mailer.appUrl}#/hospital/analytics\n\nMedic Hub` })
}

/** Runs the Premium automations that are switched on. Called on load, every few minutes and after relevant changes. */
export function runAutomations() {
  const tomorrow = addDays(today(), 1)
  const hospitals = db.select('hospitals').filter((h) => isPremium(h))
  if (!hospitals.length) return
  const staff = db.select('hospital_staff')
  for (const h of hospitals) {
    const a = h.automations
    if (a?.patientReminders) {
      const due = db.select('bookings').filter((b) => b.hospitalId === h.id && b.date === tomorrow && (b.status === 'confirmed' || b.status === 'pending') && !b.remindedAt)
      if (due.length) {
        const svc = db.select('hospital_services')
        db.write(['bookings'], (d) => { due.forEach((b) => { const x = d.bookings.find((y) => y.id === b.id); if (x) x.remindedAt = new Date().toISOString() }) })
        due.forEach((b) => notify(b.patientId, 'booking', 'Reminder: your visit is tomorrow', `${svc.find((s) => s.id === b.serviceId)?.name ?? 'Appointment'} at ${h.name}, ${b.time}. Can't make it? Cancel so someone else can have the slot.`, `/app/bookings/${b.id}`))
      }
    }
    if (a?.weeklyReport) {
      // Mondays from 08:00 Lagos time (UTC+1), once a week
      const lagos = new Date(Date.now() + 3_600_000)
      if (lagos.getUTCDay() === 1 && lagos.getUTCHours() >= 8) {
        const ids = new Set(staff.filter((s) => s.hospitalId === h.id).map((s) => s.userId))
        const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString()
        if (!db.select('notifications').some((n) => ids.has(n.userId) && n.title === 'Your weekly report' && n.createdAt > weekAgo)) deliverWeeklyReport(h.id).catch(() => {})
      }
    }
    if (a?.lowBedAlert) {
      const c = db.select('hospital_capacity').find((x) => x.hospitalId === h.id)
      if (c && c.bedsTotal > 0 && c.updatedAt > h.createdAt && c.bedsAvailable / c.bedsTotal < 0.1) {
        const ids = new Set(staff.filter((s) => s.hospitalId === h.id).map((s) => s.userId))
        const already = db.select('notifications').some((n) => ids.has(n.userId) && n.title === 'Low beds alert' && n.createdAt >= c.updatedAt)
        if (!already) ids.forEach((uid) => notify(uid, 'system', 'Low beds alert', `Only ${c.bedsAvailable} of ${c.bedsTotal} beds free. Consider setting capacity to High or Full so patients are routed elsewhere.`, '/hospital/status'))
      }
    }
  }
}
