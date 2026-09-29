import { db } from '../lib/store'
import { uid } from '../lib/ids'
import { ensureSlots, SPECIALTY_SERVICE } from '../data/seed'
import type {
  Announcement, AnnouncementSeverity, Availability, Department, Doctor, EmergencyCapacity, EmergencyLevel, Hospital, HospitalCapacity,
  HospitalStatus, OverallCapacity, ResourceKey, Service, Slot, Verification,
} from '../types'
import { AppError, latency, myHospitalId, requireHospitalStaff, requireRole, requireUser } from './core'
import { notify } from './notifications'
import { nowHHMM, today } from '../utils/date'

export interface HospitalView extends Hospital {
  status: HospitalStatus
  capacity: HospitalCapacity
  services: Service[]
  departments: Department[]
  doctors: Doctor[]
  announcements: Announcement[]
  nextSlot: (Slot & { serviceName: string }) | null
  openNow: boolean
}

export const PUBLIC_VERIFICATIONS: Verification[] = ['verified']

export function isOpenNow(h: Hospital, at = new Date()): boolean {
  if (h.is24h) return true
  const d = h.hours[at.getDay()]
  if (!d || d.closed) return false
  const t = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return t >= d.open && t < d.close
}

function nextSlotFor(hospitalId: string, serviceIds: Set<string>, services: Service[]) {
  const t = today(), n = nowHHMM()
  let best: Slot | null = null
  for (const s of db.select('hospital_slots')) {
    if (s.hospitalId !== hospitalId || !serviceIds.has(s.serviceId) || s.booked >= s.capacity) continue
    if (s.date < t || (s.date === t && s.time <= n)) continue
    if (!best || s.date < best.date || (s.date === best.date && s.time < best.time)) best = s
  }
  return best ? { ...best, serviceName: services.find((x) => x.id === best!.serviceId)?.name ?? '' } : null
}

function view(h: Hospital): HospitalView {
  const services = db.select('hospital_services').filter((s) => s.hospitalId === h.id)
  const bookable = new Set(services.filter((s) => s.bookable && s.active).map((s) => s.id))
  return {
    ...h,
    status: db.select('hospital_status').find((s) => s.hospitalId === h.id)!,
    capacity: db.select('hospital_capacity').find((s) => s.hospitalId === h.id)!,
    services,
    departments: db.select('hospital_departments').filter((s) => s.hospitalId === h.id),
    doctors: db.select('hospital_doctors').filter((s) => s.hospitalId === h.id),
    announcements: db.select('hospital_announcements').filter((a) => a.hospitalId === h.id && a.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    nextSlot: nextSlotFor(h.id, bookable, services),
    openNow: isOpenNow(h),
  }
}

/** Public directory: only verified facilities are listed. */
export function listPublicHospitals(): HospitalView[] {
  return db.select('hospitals').filter((h) => PUBLIC_VERIFICATIONS.includes(h.verification) || h.publicRecord).map(view)
}

/** Public profile. Staff of the hospital (and reviewers) can preview unlisted profiles. */
export function getHospitalView(id: string): HospitalView | null {
  const h = db.select('hospitals').find((x) => x.id === id || x.slug === id)
  if (!h) return null
  if (!PUBLIC_VERIFICATIONS.includes(h.verification) && !h.publicRecord) {
    const mine = myHospitalId() === h.id
    let admin = false
    try { admin = requireUser().role === 'admin' } catch { admin = false }
    if (!mine && !admin) return null
  }
  return view(h)
}

export function slotsFor(hospitalId: string, serviceId: string, date: string): Slot[] {
  return db.select('hospital_slots').filter((s) => s.hospitalId === hospitalId && s.serviceId === serviceId && s.date === date).sort((a, b) => a.time.localeCompare(b.time))
}

// ---------------- Staff operations ----------------
function patientsWithUpcoming(hospitalId: string) {
  const t = today()
  return [...new Set(db.select('bookings').filter((b) => b.hospitalId === hospitalId && b.date >= t && (b.status === 'confirmed' || b.status === 'pending')).map((b) => b.patientId))]
}

const LEVEL_LABEL: Record<string, string> = { open: 'Open', busy: 'Busy', closed: 'Closed', available: 'Available', limited: 'Limited', unavailable: 'Unavailable', moderate: 'Moderate', high: 'High', full: 'Full' }

export async function setEmergency(hospitalId: string, level: EmergencyLevel) {
  requireHospitalStaff(hospitalId)
  await latency(160)
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  db.write(['hospital_status', 'hospital_departments'], (d) => {
    const s = d.hospital_status.find((x) => x.hospitalId === hospitalId)!
    s.emergency = level; s.updatedAt = new Date().toISOString()
    const ed = d.hospital_departments.find((x) => x.hospitalId === hospitalId && x.name === 'Emergency Department')
    if (ed) ed.status = level
  })
  patientsWithUpcoming(hospitalId).forEach((p) => notify(p, 'status', 'Hospital status changed', `${h.name}: emergency department is now ${LEVEL_LABEL[level].toLowerCase()}.`, `/hospitals/${hospitalId}`))
}

export async function setResource(hospitalId: string, key: ResourceKey, value: Availability) {
  requireHospitalStaff(hospitalId)
  await latency(160)
  db.write(['hospital_status'], (d) => {
    const s = d.hospital_status.find((x) => x.hospitalId === hospitalId)!
    s[key] = value; s.updatedAt = new Date().toISOString()
  })
}

export async function setCapacity(hospitalId: string, patch: Partial<Pick<HospitalCapacity, 'overall' | 'emergency' | 'bedsAvailable' | 'bedsTotal' | 'icuAvailable'>>) {
  requireHospitalStaff(hospitalId)
  await latency(160)
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  const prev = db.select('hospital_capacity').find((x) => x.hospitalId === hospitalId)!
  if (patch.bedsAvailable !== undefined && patch.bedsAvailable < 0) throw new AppError('validation', 'Available beds cannot be negative.')
  db.write(['hospital_capacity'], (d) => {
    const c = d.hospital_capacity.find((x) => x.hospitalId === hospitalId)!
    Object.assign(c, patch)
    if (c.bedsAvailable > c.bedsTotal) c.bedsAvailable = c.bedsTotal
    c.updatedAt = new Date().toISOString()
  })
  if (patch.overall && patch.overall !== prev.overall) {
    patientsWithUpcoming(hospitalId).forEach((p) => notify(p, 'status', 'Hospital status changed', `${h.name}: capacity is now ${LEVEL_LABEL[patch.overall as OverallCapacity].toLowerCase()}.`, `/hospitals/${hospitalId}`))
  }
}
export type { EmergencyCapacity }

export async function updateSlot(hospitalId: string, slotId: string, capacity: number) {
  requireHospitalStaff(hospitalId)
  await latency(120)
  const slot = db.select('hospital_slots').find((s) => s.id === slotId && s.hospitalId === hospitalId)
  if (!slot) throw new AppError('not_found', 'Slot not found.')
  if (capacity < slot.booked) throw new AppError('validation', `${slot.booked} patient(s) already booked this time. Capacity cannot go below that.`)
  db.write(['hospital_slots'], (d) => { d.hospital_slots.find((s) => s.id === slotId)!.capacity = Math.min(50, Math.max(0, capacity)) })
}

export async function closeDay(hospitalId: string, serviceId: string, date: string) {
  requireHospitalStaff(hospitalId)
  await latency(160)
  db.write(['hospital_slots'], (d) => d.hospital_slots.forEach((s) => { if (s.hospitalId === hospitalId && s.serviceId === serviceId && s.date === date) s.capacity = s.booked }))
}

export async function addSlotTime(hospitalId: string, serviceId: string, date: string, time: string, capacity: number) {
  requireHospitalStaff(hospitalId)
  await latency(160)
  const id = `sl_${serviceId}_${date}_${time.replace(':', '')}`
  if (db.select('hospital_slots').some((s) => s.id === id)) throw new AppError('exists', 'That time already exists. Edit its capacity instead.')
  db.write(['hospital_slots'], (d) => d.hospital_slots.push({ id, hospitalId, serviceId, date, time, capacity, booked: 0 }))
}

export async function saveService(hospitalId: string, s: Partial<Service> & { name: string; category: string }) {
  requireHospitalStaff(hospitalId)
  await latency()
  if (!s.name.trim()) throw new AppError('validation', 'Give the service a name.')
  db.write(['hospital_services', 'hospital_slots', 'hospitals'], (d) => {
    if (s.id) {
      const x = d.hospital_services.find((y) => y.id === s.id && y.hospitalId === hospitalId)
      if (!x) throw new AppError('not_found', 'Service not found.')
      Object.assign(x, s)
    } else {
      d.hospital_services.push({ id: uid('sv_'), hospitalId, name: s.name.trim(), category: s.category, departmentId: s.departmentId, durationMins: s.durationMins ?? 20, fee: s.fee, bookable: s.bookable ?? true, active: true })
    }
    const h = d.hospitals.find((y) => y.id === hospitalId)!
    h.specialties = [...new Set(d.hospital_services.filter((y) => y.hospitalId === hospitalId && y.active).map((y) => y.category))]
    ensureSlots(d)
  })
}

export async function removeService(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency()
  const hasBookings = db.select('bookings').some((b) => b.serviceId === id && b.date >= today() && ['pending', 'confirmed'].includes(b.status))
  if (hasBookings) throw new AppError('conflict', 'This service has upcoming bookings. Turn off new bookings instead, or reschedule them first.')
  db.write(['hospital_services', 'hospital_slots', 'hospitals'], (d) => {
    d.hospital_services = d.hospital_services.filter((s) => !(s.id === id && s.hospitalId === hospitalId))
    d.hospital_slots = d.hospital_slots.filter((s) => s.serviceId !== id || s.booked > 0)
    const h = d.hospitals.find((y) => y.id === hospitalId)!
    h.specialties = [...new Set(d.hospital_services.filter((y) => y.hospitalId === hospitalId && y.active).map((y) => y.category))]
  })
}

export async function saveDepartment(hospitalId: string, dep: Partial<Department> & { name: string }) {
  requireHospitalStaff(hospitalId)
  await latency()
  if (!dep.name.trim()) throw new AppError('validation', 'Give the department a name.')
  db.write(['hospital_departments'], (d) => {
    if (dep.id) Object.assign(d.hospital_departments.find((x) => x.id === dep.id && x.hospitalId === hospitalId)!, dep)
    else d.hospital_departments.push({ id: uid('dp_'), hospitalId, name: dep.name.trim(), head: dep.head, phone: dep.phone, status: dep.status ?? 'open' })
  })
}
export async function removeDepartment(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency()
  db.write(['hospital_departments', 'hospital_services', 'hospital_doctors'], (d) => {
    d.hospital_departments = d.hospital_departments.filter((x) => !(x.id === id && x.hospitalId === hospitalId))
    d.hospital_services.forEach((s) => { if (s.departmentId === id) s.departmentId = undefined })
    d.hospital_doctors.forEach((s) => { if (s.departmentId === id) s.departmentId = undefined })
  })
}

export async function saveDoctor(hospitalId: string, doc: Partial<Doctor> & { name: string; specialty: string }) {
  requireHospitalStaff(hospitalId)
  await latency()
  if (!doc.name.trim()) throw new AppError('validation', 'Enter the provider\'s name.')
  db.write(['hospital_doctors'], (d) => {
    if (doc.id) Object.assign(d.hospital_doctors.find((x) => x.id === doc.id && x.hospitalId === hospitalId)!, doc)
    else d.hospital_doctors.push({ id: uid('dr_'), hospitalId, name: doc.name.trim(), specialty: doc.specialty, departmentId: doc.departmentId, available: doc.available ?? true })
  })
}
export async function removeDoctor(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency()
  db.write(['hospital_doctors'], (d) => { d.hospital_doctors = d.hospital_doctors.filter((x) => !(x.id === id && x.hospitalId === hospitalId)) })
}

export async function updateHospitalProfile(hospitalId: string, patch: Partial<Hospital>) {
  requireHospitalStaff(hospitalId)
  await latency(300)
  // Staff cannot change verification or ownership from the profile editor
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { verification, ownerUserId, id, ...safe } = patch
  if (safe.name !== undefined && !safe.name.trim()) throw new AppError('validation', 'Hospital name is required.')
  db.write(['hospitals'], (d) => {
    const h = d.hospitals.find((x) => x.id === hospitalId)!
    Object.assign(h, safe, { updatedAt: new Date().toISOString() })
  })
}

export async function publishAnnouncement(hospitalId: string, a: { title: string; body: string; severity: AnnouncementSeverity }) {
  requireHospitalStaff(hospitalId)
  await latency()
  if (!a.title.trim()) throw new AppError('validation', 'Add a headline for the announcement.')
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  db.write(['hospital_announcements'], (d) => d.hospital_announcements.push({ id: uid('an_'), hospitalId, title: a.title.trim(), body: a.body.trim(), severity: a.severity, active: true, createdAt: new Date().toISOString() }))
  patientsWithUpcoming(hospitalId).forEach((p) => notify(p, 'announcement', `Update from ${h.name}`, a.title.trim(), `/hospitals/${hospitalId}`))
}
export async function setAnnouncementActive(hospitalId: string, id: string, active: boolean) {
  requireHospitalStaff(hospitalId)
  await latency(120)
  db.write(['hospital_announcements'], (d) => { const a = d.hospital_announcements.find((x) => x.id === id && x.hospitalId === hospitalId); if (a) a.active = active })
}
export async function deleteAnnouncement(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency(120)
  db.write(['hospital_announcements'], (d) => { d.hospital_announcements = d.hospital_announcements.filter((x) => !(x.id === id && x.hospitalId === hospitalId)) })
}

// ---------------- Onboarding & verification ----------------
export interface OnboardingInput {
  name: string; type: Hospital['type']; tagline: string; description: string; phone: string; emergencyPhone: string; email: string; website?: string
  address: string; area: string; city: string; state: string; lat: number; lng: number
  specialties: string[]; facilities: string[]; is24h: boolean
  registration: Hospital['registration']
  documents: { name: string; kind: string; size: number }[]
  admin: Hospital['admin']
}

export async function submitOnboarding(input: OnboardingInput): Promise<string> {
  const u = requireRole('hospital')
  await latency(700)
  if (db.select('hospital_staff').some((s) => s.userId === u.id)) throw new AppError('exists', 'Your account is already linked to a facility.')
  const id = uid('h_')
  const now = new Date().toISOString()
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-4)
  db.write(['hospitals', 'hospital_staff', 'hospital_services', 'hospital_departments', 'hospital_status', 'hospital_capacity', 'hospital_documents', 'hospital_slots'], (d) => {
    d.hospitals.push({
      id, slug, name: input.name.trim(), type: input.type, tagline: input.tagline, description: input.description, address: input.address, area: input.area, city: input.city, state: input.state,
      lat: input.lat, lng: input.lng, phone: input.phone, emergencyPhone: input.emergencyPhone || input.phone, email: input.email, website: input.website, socials: [], hue: 160,
      is24h: input.is24h, hours: [0, 1, 2, 3, 4, 5, 6].map((day) => input.is24h ? { day, open: '00:00', close: '23:59', closed: false } : { day, open: day === 6 ? '09:00' : '08:00', close: day === 6 ? '15:00' : '18:00', closed: day === 0 }),
      facilities: input.facilities, specialties: input.specialties, verification: 'pending', registration: input.registration, admin: input.admin, autoConfirm: true, ownerUserId: u.id,
      submittedAt: now, createdAt: now, updatedAt: now,
    })
    d.hospital_staff.push({ id: uid('st_'), hospitalId: id, userId: u.id, role: 'owner' })
    const depIds = new Map<string, string>()
    input.specialties.forEach((sp) => {
      const m = SPECIALTY_SERVICE[sp]
      if (!m) return
      if (!depIds.has(m.dept)) { const did = uid('dp_'); depIds.set(m.dept, did); d.hospital_departments.push({ id: did, hospitalId: id, name: m.dept, status: 'open' }) }
      d.hospital_services.push({ id: uid('sv_'), hospitalId: id, name: m.name, category: sp, departmentId: depIds.get(m.dept), durationMins: m.mins || 20, fee: m.fee, bookable: m.bookable, active: true })
    })
    const has = (sp: string) => input.specialties.includes(sp)
    d.hospital_status.push({ hospitalId: id, emergency: has('Emergency medicine') ? 'open' : 'closed', oxygen: input.facilities.includes('Oxygen plant') ? 'available' : 'limited', pharmacy: has('Pharmacy') ? 'available' : 'unavailable', laboratory: has('Laboratory') ? 'available' : 'unavailable', ambulance: input.facilities.includes('Ambulance') ? 'available' : 'unavailable', maternity: has('Obstetrics & Gynecology') ? 'available' : 'unavailable', theatre: input.facilities.includes('Theatre') ? 'available' : 'unavailable', bloodBank: input.facilities.includes('Blood bank') ? 'available' : 'unavailable', updatedAt: now })
    d.hospital_capacity.push({ hospitalId: id, overall: 'available', emergency: has('Emergency medicine') ? 'available' : 'full', bedsTotal: input.registration.bedCount, bedsAvailable: Math.round(input.registration.bedCount * 0.4), icuAvailable: 0, updatedAt: now })
    input.documents.forEach((doc) => d.hospital_documents.push({ id: uid('doc_'), hospitalId: id, name: doc.name, kind: doc.kind, size: doc.size, uploadedAt: now, status: 'submitted' }))
    ensureSlots(d)
  })
  notify(u.id, 'verification', 'Your verification documents were submitted', 'Our team reviews new facilities within 2 working days. You can set up your services and slots in the meantime.', '/hospital/verification')
  db.select('users').filter((x) => x.role === 'admin').forEach((a) => notify(a.id, 'verification', 'New verification request', `${input.name} submitted documents for review.`, '/admin'))
  return id
}

export async function resubmitVerification(hospitalId: string, docs: { name: string; kind: string; size: number }[]) {
  const u = requireHospitalStaff(hospitalId)
  await latency(400)
  const now = new Date().toISOString()
  db.write(['hospitals', 'hospital_documents'], (d) => {
    const h = d.hospitals.find((x) => x.id === hospitalId)!
    h.verification = 'pending'; h.submittedAt = now; h.verificationNote = undefined
    docs.forEach((doc) => d.hospital_documents.push({ id: uid('doc_'), hospitalId, name: doc.name, kind: doc.kind, size: doc.size, uploadedAt: now, status: 'submitted' }))
  })
  notify(u.id, 'verification', 'Your verification documents were submitted', 'We will review your updated documents shortly.', '/hospital/verification')
}

export function verificationQueue() {
  requireRole('admin')
  return db.select('hospitals').filter((h) => !h.publicRecord).map((h) => ({ ...h, documents: db.select('hospital_documents').filter((x) => x.hospitalId === h.id) }))
}

export async function reviewHospital(hospitalId: string, decision: Verification, note?: string) {
  requireRole('admin')
  await latency(300)
  const h = db.select('hospitals').find((x) => x.id === hospitalId)
  if (!h) throw new AppError('not_found', 'Facility not found.')
  if ((decision === 'needs_attention' || decision === 'rejected') && !note?.trim()) throw new AppError('validation', 'Add a note so the facility knows what to fix.')
  db.write(['hospitals', 'hospital_documents'], (d) => {
    const x = d.hospitals.find((y) => y.id === hospitalId)!
    x.verification = decision; x.verificationNote = note?.trim() || undefined; x.updatedAt = new Date().toISOString()
    d.hospital_documents.forEach((doc) => { if (doc.hospitalId === hospitalId) doc.status = decision === 'verified' ? 'accepted' : decision === 'needs_attention' ? 'needs_attention' : doc.status })
  })
  const staff = db.select('hospital_staff').filter((s) => s.hospitalId === hospitalId)
  const msg: Record<string, [string, string]> = {
    verified: ['Hospital verification approved', `${h.name} is now verified and listed on Medic Hub.`],
    under_review: ['Verification under review', 'A reviewer is checking your documents.'],
    needs_attention: ['Verification needs attention', note ?? 'Please update your documents.'],
    rejected: ['Verification was not approved', note ?? 'Contact support for details.'],
    pending: ['Verification pending', 'Your submission is in the queue.'],
    draft: ['Verification reset', ''],
  }
  staff.forEach((s) => notify(s.userId, 'verification', msg[decision][0], msg[decision][1], '/hospital/verification'))
}
