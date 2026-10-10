// What each person is allowed to receive. This is the read-side access policy:
// the browser only ever holds rows that pass these rules.
import { db, TABLE_ORDER, type TableName, type Tables } from '../src/lib/store'
import type { User } from '../src/types'

const HOSPITAL_CHILDREN: TableName[] = ['hospital_departments', 'hospital_services', 'hospital_doctors', 'hospital_status', 'hospital_capacity', 'hospital_slots', 'hospital_announcements', 'hospital_reviews', 'hospital_documents']

export function visibleData(userId: string | null, only?: TableName[]): Partial<Tables> {
  const all = db.all()
  const u: User | undefined = userId ? all.users.find((x) => x.id === userId) : undefined
  const role = u?.role
  const staffOf = new Set(u && role === 'hospital' ? all.hospital_staff.filter((s) => s.userId === u.id).map((s) => s.hospitalId) : [])
  // Hospitals: verified ones are public; staff also see their own (any status); reviewers see all.
  const hospIds = new Set(all.hospitals.filter((h) => role === 'admin' || h.verification === 'verified' || h.publicRecord || staffOf.has(h.id)).map((h) => h.id))
  const byHosp = <T extends { hospitalId: string }>(rows: T[]) => rows.filter((r) => hospIds.has(r.hospitalId))
  const own = <T extends { userId: string }>(rows: T[]) => (u ? rows.filter((r) => r.userId === u.id) : [])
  const doctorIds = new Set(u && role === 'doctor' ? all.hospital_doctors.filter((d) => d.userId === u.id).map((d) => d.id) : [])
  const bookings = u ? all.bookings.filter((b) => b.patientId === u.id || staffOf.has(b.hospitalId) || (b.doctorId && doctorIds.has(b.doctorId) && b.status !== 'awaiting_payment')) : []
  const bookingIds = new Set(bookings.map((b) => b.id))

  const out: Partial<Tables> = {
    users: u ? [{ ...u, passwordHash: '' }] : [],
    patient_profiles: own(all.patient_profiles),
    hospitals: all.hospitals.filter((h) => hospIds.has(h.id)),
    hospital_staff: u ? all.hospital_staff.filter((s) => s.userId === u.id || (role === 'admin')) : [],
    hospital_departments: byHosp(all.hospital_departments),
    hospital_services: byHosp(all.hospital_services),
    // Doctors' contact details stay private to their own hospital's staff (and the doctor)
    hospital_doctors: byHosp(all.hospital_doctors).map((d) => (staffOf.has(d.hospitalId) || role === 'admin' || (u && d.userId === u.id) ? d : { ...d, email: undefined, phone: undefined, userId: undefined })),
    hospital_status: byHosp(all.hospital_status),
    hospital_capacity: byHosp(all.hospital_capacity),
    hospital_slots: byHosp(all.hospital_slots),
    bookings,
    booking_events: all.booking_events.filter((e) => bookingIds.has(e.bookingId)),
    health_profiles: own(all.health_profiles),
    health_events: own(all.health_events),
    emergency_contacts: own(all.emergency_contacts),
    notifications: own(all.notifications),
    hospital_announcements: byHosp(all.hospital_announcements),
    hospital_documents: all.hospital_documents.filter((d) => role === 'admin' || staffOf.has(d.hospitalId)),
    password_resets: [],
    email_verifications: [],
    hospital_reviews: byHosp(all.hospital_reviews),
    payments: u ? all.payments.filter((p) => p.patientId === u.id || staffOf.has(p.hospitalId)) : [],
    hospital_payouts: all.hospital_payouts.filter((p) => role === 'admin' || staffOf.has(p.hospitalId)),
    hospital_team: all.hospital_team.filter((m) => staffOf.has(m.hospitalId)),
    email_log: all.email_log.filter((m) => staffOf.has(m.hospitalId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300),
  }
  if (!only) return out
  // Visibility of child rows depends on these tables, so send the dependants together.
  const want = new Set(only)
  if (want.has('hospitals')) HOSPITAL_CHILDREN.forEach((t) => want.add(t))
  if (want.has('hospital_staff')) return out
  if (want.has('bookings')) { want.add('booking_events'); want.add('payments') }
  if (want.has('payments')) want.add('bookings')
  only = [...want]
  return Object.fromEntries(only.filter((t) => TABLE_ORDER.includes(t)).map((t) => [t, out[t]])) as Partial<Tables>
}
