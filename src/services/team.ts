// Hospital team + booking emails.
// Every hospital lists the people who should hear about bookings (front desk, doctors, nurses, billing…)
// with their email (Gmail or any address). On every booking event each matching person gets an email.
// A person can be limited to one department (e.g. the cardiologist only hears about cardiology bookings).
// Every email is written to `email_log` so the hospital can see exactly who was told what, and when.
import { rpc } from '../lib/rpc'
import { db } from '../lib/store'
import { uid } from '../lib/ids'
import type { Booking, EmailKind, EmailLog, TeamAlerts, TeamMember, TeamRole } from '../types'
import { AppError, latency, mailer, requireHospitalStaff, text } from './core'
import { isPremium } from './plans'
import { fmtDateLong, fmtTime, today } from '../utils/date'

export const TEAM_ROLES: TeamRole[] = ['Doctor', 'Nurse', 'Front desk', 'Admin', 'Lab', 'Pharmacy', 'Billing', 'Other']
export const ALERT_LABELS: Record<keyof TeamAlerts, { label: string; hint: string; premium?: boolean }> = {
  newBooking: { label: 'New bookings', hint: 'The moment a patient books (or pays for) an appointment' },
  paid: { label: 'Payments', hint: 'When a patient pays online for their visit' },
  cancelled: { label: 'Cancellations', hint: 'When a booking is cancelled by the patient or your team' },
  rescheduled: { label: 'Reschedules', hint: 'When an appointment moves to another time' },
  dailySchedule: { label: 'Morning schedule', hint: "Each morning at 7:00, today's appointments in one email", premium: true },
}
export const DEFAULT_ALERTS: TeamAlerts = { newBooking: true, paid: true, cancelled: true, rescheduled: true, dailySchedule: true }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_TEAM = 50

export function teamOf(hospitalId: string): TeamMember[] {
  requireHospitalStaff(hospitalId)
  return db.select('hospital_team').filter((m) => m.hospitalId === hospitalId).sort((a, b) => a.name.localeCompare(b.name))
}
export function emailLogOf(hospitalId: string): EmailLog[] {
  requireHospitalStaff(hospitalId)
  return db.select('email_log').filter((m) => m.hospitalId === hospitalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export interface MemberInput { id?: string; name: string; role: TeamRole; email: string; phone?: string; departmentId?: string; alerts: TeamAlerts; active?: boolean }

export const saveTeamMember = rpc('team.saveTeamMember', async function saveTeamMember(hospitalId: string, input: MemberInput): Promise<TeamMember> {
  requireHospitalStaff(hospitalId)
  const name = text(input?.name, 120, 'a name', true).trim()
  const email = text(input.email, 200, 'an email address', true).trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new AppError('validation', 'Enter a valid email address, like name@gmail.com.')
  if (!TEAM_ROLES.includes(input.role)) throw new AppError('validation', 'Choose a role.')
  const phone = text(input.phone, 40, 'a phone number').trim() || undefined
  const departmentId = input.departmentId ? text(input.departmentId, 100, 'a department') : undefined
  if (departmentId && !db.select('hospital_departments').some((d) => d.id === departmentId && d.hospitalId === hospitalId)) throw new AppError('validation', 'Choose one of your departments.')
  const a = input.alerts ?? DEFAULT_ALERTS
  const alerts: TeamAlerts = { newBooking: !!a.newBooking, paid: !!a.paid, cancelled: !!a.cancelled, rescheduled: !!a.rescheduled, dailySchedule: !!a.dailySchedule }
  await latency(300)
  const mine = db.select('hospital_team').filter((m) => m.hospitalId === hospitalId)
  if (mine.some((m) => m.email === email && m.id !== input.id)) throw new AppError('duplicate', `${email} is already on your team.`)
  let saved!: TeamMember
  db.write(['hospital_team'], (d) => {
    const existing = input.id ? d.hospital_team.find((m) => m.id === input.id && m.hospitalId === hospitalId) : undefined
    if (input.id && !existing) throw new AppError('not_found', 'Team member not found.')
    if (existing) {
      Object.assign(existing, { name, role: input.role, email, phone, departmentId, alerts, active: input.active ?? existing.active })
      saved = { ...existing }
    } else {
      if (mine.length >= MAX_TEAM) throw new AppError('limit', `You can add up to ${MAX_TEAM} people.`)
      saved = { id: uid('tm_'), hospitalId, name, role: input.role, email, phone, departmentId, alerts, active: true, createdAt: new Date().toISOString() }
      d.hospital_team.push(saved)
    }
  })
  return saved
})

export const removeTeamMember = rpc('team.removeTeamMember', async function removeTeamMember(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency(200)
  db.write(['hospital_team'], (d) => { d.hospital_team = d.hospital_team.filter((m) => !(m.id === id && m.hospitalId === hospitalId)) })
})

export const sendTestEmail = rpc('team.sendTestEmail', async function sendTestEmail(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  const m = db.select('hospital_team').find((x) => x.id === id && x.hospitalId === hospitalId)
  if (!m) throw new AppError('not_found', 'Team member not found.')
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  await latency(300)
  const log = await deliver(hospitalId, {
    to: m.email, toName: m.name, audience: 'team', kind: 'test',
    subject: `You're on the Medic Hub team for ${h.name}`,
    heading: 'Booking emails are working',
    lines: [`Hello ${m.name.split(' ')[0]},`, `${h.name} added you to its Medic Hub team as ${m.role}. You'll get an email here whenever ${m.departmentId ? `a patient books with ${deptName(m.departmentId)}` : 'a patient books'}, pays, cancels or is rescheduled.`, 'Tip: in Gmail, add this sender to your contacts so alerts never land in spam.'],
    cta: { label: 'Open the hospital portal', path: '/hospital/bookings' },
  })
  return log
})

// ------------------------------------------------------------------ booking alerts

type AlertEvent = 'new' | 'paid' | 'cancelled' | 'rescheduled'
const EVENT_ALERT: Record<AlertEvent, keyof TeamAlerts> = { new: 'newBooking', paid: 'paid', cancelled: 'cancelled', rescheduled: 'rescheduled' }
const EVENT_KIND: Record<AlertEvent, EmailKind> = { new: 'new_booking', paid: 'paid', cancelled: 'cancelled', rescheduled: 'rescheduled' }

const deptName = (id?: string) => (id ? db.select('hospital_departments').find((d) => d.id === id)?.name ?? 'your department' : '')
const naira = (n: number) => '₦' + n.toLocaleString('en-NG')

/** Emails everyone on the hospital's team who wants to hear about this booking event. Never throws. */
export async function alertTeam(b: Booking, event: AlertEvent, extra?: { by?: string; note?: string; amount?: number }) {
  try {
    const h = db.select('hospitals').find((x) => x.id === b.hospitalId)
    if (!h) return
    const svc = db.select('hospital_services').find((s) => s.id === b.serviceId)
    const dep = svc?.departmentId
    const team = db.select('hospital_team').filter((m) => m.hospitalId === b.hospitalId && m.active && (m.alerts[EVENT_ALERT[event]] || (event === 'paid' && m.alerts.newBooking)) && (!m.departmentId || m.departmentId === dep))
    if (!team.length) return
    const when = `${fmtDateLong(b.date)} at ${fmtTime(b.time)}`
    const subject = {
      new: `New booking: ${b.patientName}, ${fmtTime(b.time)} ${shortDate(b.date)} · ${b.ref}`,
      paid: `Paid booking: ${b.patientName} · ${naira(extra?.amount ?? b.amount ?? 0)} · ${b.ref}`,
      cancelled: `Cancelled: ${b.patientName}, ${fmtTime(b.time)} ${shortDate(b.date)} · ${b.ref}`,
      rescheduled: `Rescheduled: ${b.patientName} now ${fmtTime(b.time)} ${shortDate(b.date)} · ${b.ref}`,
    }[event]
    const heading = { new: 'New appointment booked', paid: 'New paid appointment', cancelled: 'Appointment cancelled', rescheduled: 'Appointment rescheduled' }[event]
    const payment = b.amount ? (b.paymentStatus === 'paid' ? `${naira(b.amount)} paid online` : b.payAtHospital ? `${naira(b.amount)} to pay at the hospital` : `${naira(b.amount)} awaiting payment`) : 'No fee'
    const facts: [string, string][] = [
      ['Patient', b.patientName], ['Phone', b.patientPhone || 'Not given'], ['Service', svc?.name ?? 'Appointment'],
      ...(dep ? [['Department', deptName(dep)] as [string, string]] : []),
      ['When', when], ['Reference', b.ref], ['Payment', payment],
      ...(b.reason ? [['Reason for visit', b.reason] as [string, string]] : []),
      ...(extra?.note ? [['Note', extra.note] as [string, string]] : []),
    ]
    const intro = {
      new: b.status === 'pending' ? 'A patient has requested this appointment. Please confirm it in the portal.' : 'A patient has booked this appointment. It is confirmed.',
      paid: 'Payment has been verified and the appointment is confirmed. The money settles to your hospital account.',
      cancelled: `This appointment was cancelled${extra?.by ? ` by ${extra.by}` : ''}. The time slot is free again.`,
      rescheduled: 'This appointment has moved to a new time.',
    }[event]
    await Promise.all(team.map((m) => deliver(b.hospitalId, {
      to: m.email, toName: m.name, audience: 'team', kind: EVENT_KIND[event], bookingId: b.id, replyTo: h.email || undefined,
      subject, heading, lines: [`Hello ${m.name.split(' ')[0]},`, intro], facts,
      cta: { label: event === 'cancelled' ? 'View bookings' : 'Open booking in portal', path: '/hospital/bookings' },
    })))
  } catch (e) { console.error('[team] alert failed', e) }
}

/** Confirmation and update emails to the patient. Never throws. */
export async function emailPatient(b: Booking, kind: 'confirmed' | 'requested' | 'paid' | 'cancelled' | 'rescheduled', note?: string) {
  try {
    const u = db.select('users').find((x) => x.id === b.patientId)
    const h = db.select('hospitals').find((x) => x.id === b.hospitalId)
    if (!u?.email || !h || u.email.endsWith('.demo')) return
    const svc = db.select('hospital_services').find((s) => s.id === b.serviceId)
    const heading = { confirmed: 'Your appointment is confirmed', requested: 'Booking request received', paid: 'Payment received, you are booked', cancelled: 'Your appointment was cancelled', rescheduled: 'Your appointment has a new time' }[kind]
    await deliver(b.hospitalId, {
      to: u.email, toName: u.name, audience: 'patient', kind: kind === 'confirmed' || kind === 'requested' || kind === 'paid' ? 'patient_confirmation' : 'patient_update', bookingId: b.id, replyTo: h.email || undefined,
      subject: `${heading} · ${h.name} · ${b.ref}`, heading,
      lines: [`Hello ${u.name.split(' ')[0]},`, kind === 'requested' ? `${h.name} will confirm shortly. We'll email you when they do.` : kind === 'cancelled' ? (note || 'If you still need care, you can book another time.') : 'Show the QR pass in the app at the front desk.'],
      facts: [['Hospital', h.name], ['Address', h.address], ['Service', svc?.name ?? 'Appointment'], ['When', `${fmtDateLong(b.date)} at ${fmtTime(b.time)}`], ['Reference', b.ref], ...(h.phone ? [['Hospital phone', h.phone] as [string, string]] : [])],
      cta: { label: 'Open my pass', path: `/app/bookings/${b.id}` },
    })
  } catch (e) { console.error('[team] patient email failed', e) }
}

// ------------------------------------------------------------------ morning schedule (Premium)

export async function runTeamDigests(now = new Date()) {
  if (now.getHours() < 7) return 0
  const day = today()
  let sent = 0
  for (const h of db.select('hospitals')) {
    if (!isPremium(h)) continue
    const due = db.select('hospital_team').filter((m) => m.hospitalId === h.id && m.active && m.alerts.dailySchedule && m.lastDigestOn !== day)
    if (!due.length) continue
    db.write(['hospital_team'], (d) => d.hospital_team.forEach((m) => { if (due.some((x) => x.id === m.id)) m.lastDigestOn = day }))
    const services = db.select('hospital_services').filter((s) => s.hospitalId === h.id)
    const todays = db.select('bookings').filter((b) => b.hospitalId === h.id && b.date === day && ['pending', 'confirmed', 'checked_in'].includes(b.status)).sort((a, b) => a.time.localeCompare(b.time))
    for (const m of due) {
      const mine = todays.filter((b) => !m.departmentId || services.find((s) => s.id === b.serviceId)?.departmentId === m.departmentId)
      await deliver(h.id, {
        to: m.email, toName: m.name, audience: 'team', kind: 'daily_schedule', replyTo: h.email || undefined,
        subject: `Today at ${h.name}: ${mine.length} appointment${mine.length === 1 ? '' : 's'}${m.departmentId ? ` in ${deptName(m.departmentId)}` : ''}`,
        heading: `Good morning, ${m.name.split(' ')[0]}`,
        lines: [mine.length ? `Here is ${m.departmentId ? deptName(m.departmentId) + "'s" : 'the'} schedule for ${fmtDateLong(day)}.` : `No appointments booked${m.departmentId ? ' for ' + deptName(m.departmentId) : ''} today (${fmtDateLong(day)}) so far. New bookings will still be emailed as they come in.`],
        facts: mine.map((b) => [fmtTime(b.time), `${b.patientName} · ${services.find((s) => s.id === b.serviceId)?.name ?? 'Appointment'} · ${b.ref}${b.status === 'pending' ? ' (needs confirming)' : ''}`] as [string, string]),
        cta: { label: "Open today's bookings", path: '/hospital/bookings' },
      })
      sent++
    }
  }
  return sent
}

// ------------------------------------------------------------------ delivery

export interface Compose {
  to: string; toName?: string; audience: 'team' | 'patient'; kind: EmailKind; bookingId?: string; replyTo?: string
  subject: string; heading: string; lines: string[]; facts?: [string, string][]; cta?: { label: string; path: string }
}

const shortDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function render(c: Compose, hospitalName: string) {
  const link = c.cta ? `${mailer.appUrl || ''}#${c.cta.path}` : ''
  const textBody = [c.heading, '', ...c.lines.flatMap((l) => [l, '']), ...(c.facts ?? []).map(([k, v]) => `${k}: ${v}`), ...(c.cta ? ['', `${c.cta.label}: ${link}`] : []), '', `Sent by Medic Hub for ${hospitalName}.`].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#FBF8F1;font-family:Arial,Helvetica,sans-serif;color:#06281F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #ece6d8">
<tr><td style="background:#06281F;padding:18px 24px;color:#C6F36B;font-weight:800;font-size:18px">Medic Hub <span style="color:#ffffff;font-weight:600;font-size:13px">· ${esc(hospitalName)}</span></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(c.heading)}</h1>
${c.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155">${esc(l)}</p>`).join('')}
${c.facts?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-collapse:collapse">${c.facts.map(([k, v]) => `<tr><td style="padding:8px 0;border-top:1px solid #eef0ea;font-size:13px;color:#64748b;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #eef0ea;font-size:14px;font-weight:700">${esc(v)}</td></tr>`).join('')}</table>` : ''}
${c.cta ? `<a href="${esc(link)}" style="display:inline-block;background:#C6F36B;color:#06281F;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px;font-size:14px">${esc(c.cta.label)}</a>` : ''}
</td></tr>
<tr><td style="padding:14px 24px;background:#f7f5ee;font-size:12px;color:#64748b">You get this because ${esc(hospitalName)} added you on Medic Hub. Ask your facility admin to change what you receive.</td></tr>
</table></td></tr></table></body></html>`
  return { text: textBody, html }
}

async function deliver(hospitalId: string, c: Compose): Promise<EmailLog> {
  const h = db.select('hospitals').find((x) => x.id === hospitalId)
  const { text: body, html } = render(c, h?.name ?? 'your hospital')
  const row: EmailLog = {
    id: uid('em_'), hospitalId, bookingId: c.bookingId, toEmail: c.to, toName: c.toName, audience: c.audience, kind: c.kind,
    subject: c.subject, body, status: mailer.enabled ? 'queued' : 'simulated',
    error: mailer.enabled ? undefined : 'No email provider on this copy of the app (demo). On the live server this is delivered to the inbox.',
    createdAt: new Date().toISOString(),
  }
  db.write(['email_log'], (d) => {
    d.email_log.push(row)
    const mine = d.email_log.filter((x) => x.hospitalId === hospitalId)
    if (mine.length > 500) { const drop = new Set(mine.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, mine.length - 500).map((x) => x.id)); d.email_log = d.email_log.filter((x) => !drop.has(x.id)) }
  })
  if (!mailer.enabled) return row
  let status: EmailLog['status'] = 'sent'; let error: string | undefined
  try { await mailer.send({ to: c.to, subject: c.subject, text: body, html, replyTo: c.replyTo, fromName: h?.name }) }
  catch (e) { status = 'failed'; error = String((e as Error)?.message ?? e).slice(0, 300); console.error('[mail]', error) }
  db.write(['email_log'], (d) => { const x = d.email_log.find((y) => y.id === row.id); if (x) { x.status = status; x.error = error } })
  return { ...row, status, error }
}

/** Whether this copy of the app can really send email (server with Gmail SMTP or Resend configured). */
export const emailStatus = rpc('team.emailStatus', async function emailStatus(): Promise<{ enabled: boolean }> {
  return { enabled: mailer.enabled }
})
