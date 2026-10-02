import { rpc } from '../lib/rpc'
import { db } from '../lib/store'
import { bookingRef, secureToken, uid } from '../lib/ids'
import type { Booking, BookingStatus } from '../types'
import { AppError, ENUMS, currentUser, latency, oneOf, requireHospitalStaff, requireRole, text } from './core'
import { notify } from './notifications'
import { refundPayment, requiresPayment } from './payments'
import { fmtDate, fmtTime, nowHHMM, today } from '../utils/date'

export interface BookingView extends Booking {
  hospitalName: string
  hospitalArea: string
  hospitalCity: string
  hospitalPhone: string
  hospitalLat: number
  hospitalLng: number
  serviceName: string
  departmentName?: string
  demo?: boolean
}

function enrich(b: Booking): BookingView {
  const h = db.select('hospitals').find((x) => x.id === b.hospitalId)
  const s = db.select('hospital_services').find((x) => x.id === b.serviceId)
  const dep = s?.departmentId ? db.select('hospital_departments').find((x) => x.id === s.departmentId) : undefined
  return { ...b, hospitalName: h?.name ?? 'Unknown facility', hospitalArea: h?.area ?? '', hospitalCity: h?.city ?? '', hospitalPhone: h?.phone ?? '', hospitalLat: h?.lat ?? 0, hospitalLng: h?.lng ?? 0, demo: !!h?.publicRecord, serviceName: s?.name ?? 'Service', departmentName: dep?.name }
}

export const QR_PREFIX = 'MEDICHUB'
/** Public address of the app, used inside QR codes so any phone camera can open them. */
export function appBase() {
  if (typeof window === 'undefined') return ''
  const framed = (() => { try { return window.self !== window.top } catch { return true } })()
  return framed || /claudeusercontent|claude\.ai/.test(location.host) ? 'https://devemmy.github.io/medichub/' : location.origin + location.pathname
}
/** The QR on a booking pass is a secure link: ref + a secret token only the patient's pass contains. */
export const qrPayload = (b: Booking) => `${appBase()}#/pass/${b.ref}?t=${b.token}`
export function parsePassCode(code: string): { ref: string; token: string | null } {
  const raw = code.trim()
  const url = raw.match(/\/pass\/(MED-[A-Z0-9]{6})\?t=([A-Za-z0-9]+)/i)
  if (url) return { ref: url[1].toUpperCase(), token: url[2] }
  if (raw.toUpperCase().startsWith(QR_PREFIX + ':')) { const p = raw.split(':'); return { ref: (p[1] || '').toUpperCase(), token: p[2] || null } }
  let ref = raw.toUpperCase()
  if (/^[A-Z0-9]{6}$/.test(ref)) ref = 'MED-' + ref
  return { ref, token: null }
}

export interface PassCheck {
  valid: boolean
  message?: string
  ref?: string; status?: BookingStatus; patientName?: string; patientPhone?: string; reason?: string
  hospitalId?: string; hospitalName?: string; hospitalAddress?: string; serviceName?: string; departmentName?: string
  date?: string; time?: string; amount?: number; paymentStatus?: string; payAtHospital?: boolean; paidAt?: string; bookedAt?: string
  bookingId?: string; viewer?: 'staff' | 'owner' | 'public'
}

/** Anyone holding the QR (ref + secret token) can confirm a pass is genuine. Staff of that hospital and the patient see every detail. */
export const verifyPass = rpc('bookings.verifyPass', async function verifyPass(code: string): Promise<PassCheck> {
  text(code, 400, 'a code', true)
  const { ref, token } = parsePassCode(code)
  const b = db.select('bookings').find((x) => x.ref === ref)
  const u = currentUser()
  const staff = !!(b && u && u.role === 'hospital' && db.select('hospital_staff').some((s) => s.userId === u.id && s.hospitalId === b.hospitalId))
  const owner = !!(b && u && b.patientId === u.id)
  if (!b || (!staff && !owner && token !== b.token) || (token && token !== b.token)) return { valid: false, message: 'This pass is not valid. Ask the patient to open their pass again.' }
  const v = enrich(b)
  const h = db.select('hospitals').find((x) => x.id === b.hospitalId)
  const full = staff || owner
  return {
    valid: true, viewer: staff ? 'staff' : owner ? 'owner' : 'public', bookingId: full ? b.id : undefined,
    ref: b.ref, status: b.status, patientName: full ? b.patientName : b.patientName.split(' ')[0] + ' ' + (b.patientName.split(' ').slice(-1)[0]?.[0] ?? '') + '.',
    patientPhone: full ? b.patientPhone : undefined, reason: full ? b.reason : undefined,
    hospitalId: b.hospitalId, hospitalName: v.hospitalName, hospitalAddress: h?.address, serviceName: v.serviceName, departmentName: v.departmentName,
    date: b.date, time: b.time, amount: b.amount, paymentStatus: b.paymentStatus, payAtHospital: b.payAtHospital, paidAt: b.paidAt, bookedAt: b.createdAt,
  }
})

// ---------------- Patient ----------------
export function myBookings(): BookingView[] {
  const u = requireRole('patient')
  return db.select('bookings').filter((b) => b.patientId === u.id).map(enrich).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
export function myBooking(idOrRef: string): BookingView | null {
  const u = requireRole('patient')
  const b = db.select('bookings').find((x) => (x.id === idOrRef || x.ref === idOrRef) && x.patientId === u.id)
  return b ? enrich(b) : null
}
export function isUpcoming(b: Booking) {
  return (b.status === 'awaiting_payment' || b.status === 'confirmed' || b.status === 'pending' || b.status === 'checked_in' || b.status === 'in_consultation') && (b.date > today() || (b.date === today()))
}

export const createBooking = rpc('bookings.createBooking', async function createBooking(input: { hospitalId: string; serviceId: string; slotId: string; reason?: string; phone?: string }): Promise<BookingView> {
  const u = requireRole('patient')
  text(input?.slotId, 100, 'a time', true); text(input.hospitalId, 100, 'a hospital', true); text(input.serviceId, 100, 'a service', true); text(input.reason, 500, 'a reason'); text(input.phone, 40, 'a phone number')
  await latency(650)
  const slot = db.select('hospital_slots').find((s) => s.id === input.slotId && s.hospitalId === input.hospitalId && s.serviceId === input.serviceId)
  if (!slot) throw new AppError('not_found', 'That time is no longer offered. Pick another time.')
  if (slot.date < today() || (slot.date === today() && slot.time <= nowHHMM())) throw new AppError('past', 'That time has already passed. Pick a later time.')
  if (slot.booked >= slot.capacity) throw new AppError('full', 'Someone just took the last place at that time. Pick another time.')
  const h = db.select('hospitals').find((x) => x.id === input.hospitalId)
  if (!h || (h.verification !== 'verified' && !h.publicRecord)) throw new AppError('unavailable', 'This facility is not accepting bookings right now.')
  const dup = db.select('bookings').find((b) => b.patientId === u.id && b.slotId === slot.id && b.status !== 'cancelled')
  if (dup) throw new AppError('duplicate', `You already have a booking at this time (${dup.ref}).`)
  let ref = bookingRef()
  while (db.select('bookings').some((b) => b.ref === ref)) ref = bookingRef()
  const now = new Date().toISOString()
  const svc0 = db.select('hospital_services').find((s) => s.id === slot.serviceId)
  const fee = svc0?.fee && svc0.fee > 0 ? svc0.fee : undefined
  const mustPay = requiresPayment(h.id, fee)
  const status: BookingStatus = mustPay ? 'awaiting_payment' : h.autoConfirm ? 'confirmed' : 'pending'
  const booking: Booking = { id: uid('bk_'), ref, token: secureToken(), patientId: u.id, patientName: u.name, patientPhone: input.phone || u.phone, hospitalId: h.id, serviceId: slot.serviceId, slotId: slot.id, date: slot.date, time: slot.time, reason: input.reason?.trim() || undefined, status, createdAt: now, updatedAt: now,
    ...(fee ? { amount: fee, paymentStatus: 'unpaid' as const, payAtHospital: !mustPay } : {}) }
  db.write(['bookings', 'booking_events', 'hospital_slots'], (d) => {
    const s = d.hospital_slots.find((x) => x.id === slot.id)!
    if (s.booked >= s.capacity) throw new AppError('full', 'Someone just took the last place at that time. Pick another time.')
    s.booked++
    d.bookings.push(booking)
    d.booking_events.push({ id: uid('be_'), bookingId: booking.id, status, at: now, by: 'patient' })
  })
  const svc = svc0
  if (mustPay) return enrich(booking) // confirmations go out once payment is verified
  notify(u.id, 'booking', status === 'confirmed' ? 'Booking confirmed' : 'Booking requested', `${svc?.name} at ${h.name}, ${fmtDate(slot.date)} at ${fmtTime(slot.time)}. Ref ${ref}.`, `/app/bookings/${booking.id}`)
  db.select('hospital_staff').filter((s) => s.hospitalId === h.id).forEach((s) => notify(s.userId, 'booking', 'New booking', `${u.name} booked ${svc?.name} for ${fmtDate(slot.date)} at ${fmtTime(slot.time)}.`, '/hospital/bookings'))
  return enrich(booking)
})

export const cancelMyBooking = rpc('bookings.cancelMyBooking', async function cancelMyBooking(id: string) {
  const u = requireRole('patient')
  await latency(400)
  const b = db.select('bookings').find((x) => x.id === id && x.patientId === u.id)
  if (!b) throw new AppError('not_found', 'Booking not found.')
  if (!['awaiting_payment', 'pending', 'confirmed'].includes(b.status)) throw new AppError('invalid', 'This booking can no longer be cancelled here. Call the hospital.')
  transition(b, 'cancelled', 'patient', 'Cancelled by patient')
  if (b.paymentStatus === 'paid' && b.paymentRef) await refundPayment(b.paymentRef, 'You cancelled the appointment.')
  db.select('hospital_staff').filter((s) => s.hospitalId === b.hospitalId).forEach((s) => notify(s.userId, 'booking', 'Booking cancelled', `${b.patientName} cancelled ${b.ref}.`, '/hospital/bookings'))
})

function transition(b: Booking, status: BookingStatus, by: 'patient' | 'hospital', note?: string) {
  const releases = (status === 'cancelled' || status === 'no_show') && (b.status === 'pending' || b.status === 'confirmed' || b.status === 'awaiting_payment')
  const now = new Date().toISOString()
  db.write(['bookings', 'booking_events', 'hospital_slots'], (d) => {
    const x = d.bookings.find((y) => y.id === b.id)!
    x.status = status; x.updatedAt = now
    d.booking_events.push({ id: uid('be_'), bookingId: b.id, status, at: now, by, note })
    if (releases) { const s = d.hospital_slots.find((y) => y.id === b.slotId); if (s && s.booked > 0) s.booked-- }
  })
}

// ---------------- Hospital ----------------
export const NEXT_STATUSES: Record<BookingStatus, BookingStatus[]> = {
  awaiting_payment: ['cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['in_consultation', 'completed', 'cancelled'],
  in_consultation: ['completed'],
  completed: [],
  cancelled: [],
  no_show: ['checked_in'],
}

export function hospitalBookings(hospitalId: string): BookingView[] {
  requireHospitalStaff(hospitalId)
  return db.select('bookings').filter((b) => b.hospitalId === hospitalId).map(enrich)
}

const STATUS_MSG: Partial<Record<BookingStatus, [string, string]>> = {
  confirmed: ['Booking confirmed', 'The hospital confirmed your appointment.'],
  checked_in: ['You are checked in', 'Please wait to be called.'],
  in_consultation: ['You are being seen', 'Your consultation has started.'],
  completed: ['Visit completed', 'Thanks for visiting. Your timeline has been updated.'],
  cancelled: ['Your appointment has been updated', 'The hospital cancelled this booking.'],
  no_show: ['Missed appointment', 'You were marked as not attending. Book again if you still need care.'],
}

export const setBookingStatus = rpc('bookings.setBookingStatus', async function setBookingStatus(hospitalId: string, id: string, status: BookingStatus, note?: string) {
  oneOf(status, ENUMS.bookingStatus, 'booking status'); text(note, 500, 'a note')
  requireHospitalStaff(hospitalId)
  await latency(220)
  const b = db.select('bookings').find((x) => x.id === id && x.hospitalId === hospitalId)
  if (!b) throw new AppError('not_found', 'Booking not found.')
  if (!NEXT_STATUSES[b.status].includes(status)) throw new AppError('invalid', `A ${b.status.replace('_', ' ')} booking cannot move to ${status.replace('_', ' ')}.`)
  transition(b, status, 'hospital', note)
  if (status === 'cancelled' && b.paymentStatus === 'paid' && b.paymentRef) await refundPayment(b.paymentRef, 'The hospital cancelled the appointment.')
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  const m = STATUS_MSG[status]
  if (m) notify(b.patientId, 'booking', m[0], `${h.name} · ${b.ref}. ${note || m[1]}`, `/app/bookings/${b.id}`)
  if (status === 'completed') {
    const svc = db.select('hospital_services').find((s) => s.id === b.serviceId)
    db.write(['health_events'], (d) => d.health_events.push({ id: uid('he_'), userId: b.patientId, type: 'visit', title: svc?.name ?? 'Hospital visit', detail: 'Visit completed.', date: b.date, place: h.name }))
  }
})

export const rescheduleBooking = rpc('bookings.rescheduleBooking', async function rescheduleBooking(hospitalId: string, id: string, newSlotId: string) {
  requireHospitalStaff(hospitalId)
  await latency(300)
  const b = db.select('bookings').find((x) => x.id === id && x.hospitalId === hospitalId)
  const ns = db.select('hospital_slots').find((s) => s.id === newSlotId && s.hospitalId === hospitalId)
  if (!b || !ns) throw new AppError('not_found', 'Booking or slot not found.')
  if (!['pending', 'confirmed'].includes(b.status)) throw new AppError('invalid', 'Only pending or confirmed bookings can be rescheduled.')
  if (ns.booked >= ns.capacity) throw new AppError('full', 'That time is full. Pick another.')
  const now = new Date().toISOString()
  db.write(['bookings', 'booking_events', 'hospital_slots'], (d) => {
    const old = d.hospital_slots.find((s) => s.id === b.slotId); if (old && old.booked > 0) old.booked--
    d.hospital_slots.find((s) => s.id === ns.id)!.booked++
    const x = d.bookings.find((y) => y.id === id)!
    x.slotId = ns.id; x.date = ns.date; x.time = ns.time; x.serviceId = ns.serviceId; x.updatedAt = now; x.status = 'confirmed'
    d.booking_events.push({ id: uid('be_'), bookingId: id, status: 'confirmed', at: now, by: 'hospital', note: `Rescheduled to ${fmtDate(ns.date)} ${fmtTime(ns.time)}` })
  })
  notify(b.patientId, 'booking', 'Your appointment has been updated', `${b.ref} moved to ${fmtDate(ns.date)} at ${fmtTime(ns.time)}.`, `/app/bookings/${id}`)
})

/** Check-in lookup. Accepts a booking reference ("MED-7X82K9") or the full QR payload. */
export function lookupBooking(hospitalId: string, code: string): BookingView | { error: string } {
  requireHospitalStaff(hospitalId)
  const { ref, token } = parsePassCode(code)
  const b = db.select('bookings').find((x) => x.ref === ref)
  if (!b) return { error: 'No booking matches that code. Check the reference and try again.' }
  if (b.hospitalId !== hospitalId) return { error: 'This booking is for a different facility.' }
  if (token && token !== b.token) return { error: 'This QR code is not valid. Ask the patient to reopen their pass.' }
  return enrich(b)
}

export function bookingEvents(bookingId: string) {
  const u = requireRole('patient', 'hospital')
  const b = db.select('bookings').find((x) => x.id === bookingId)
  if (!b) return []
  if (u.role === 'patient' && b.patientId !== u.id) return []
  if (u.role === 'hospital') requireHospitalStaff(b.hospitalId)
  return db.select('booking_events').filter((e) => e.bookingId === bookingId).sort((a, b) => a.at.localeCompare(b.at))
}
