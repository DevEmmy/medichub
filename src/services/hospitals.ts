import { rpc } from '../lib/rpc'
import { db } from '../lib/store'
import { uid } from '../lib/ids'
import { ALL_SPECIALTIES, ensureSlots, SPECIALTY_SERVICE } from '../data/seed'
import type {
  Announcement, AnnouncementSeverity, Availability, Department, Doctor, EmergencyCapacity, EmergencyLevel, Hospital, HospitalCapacity,
  HospitalStatus, OverallCapacity, ResourceKey, Service, Slot, Verification,
} from '../types'
import { AppError, ENUMS, latency, myHospitalId, num, oneOf, requireHospitalStaff, requireRole, requireUser, text } from './core'
import { notify } from './notifications'
import { runAutomations } from './plans'
import { ratingSummary, type RatingSummary } from './reviews'
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
  rating: RatingSummary
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
    rating: ratingSummary(h.id),
  }
}

/** Public directory: only verified facilities are listed. */
export function listPublicHospitals(): HospitalView[] {
  const st = new Set(db.select('hospital_status').map((x) => x.hospitalId))
  const cap = new Set(db.select('hospital_capacity').map((x) => x.hospitalId))
  // A listing needs its live status; skip any row whose status hasn't arrived yet
  return db.select('hospitals').filter((h) => (PUBLIC_VERIFICATIONS.includes(h.verification) || h.publicRecord) && st.has(h.id) && cap.has(h.id)).map(view)
}

/** Public profile. Staff of the hospital (and reviewers) can preview unlisted profiles. */
export function getHospitalView(id: string): HospitalView | null {
  const h = db.select('hospitals').find((x) => x.id === id || x.slug === id)
  if (!h || !db.select('hospital_status').some((s) => s.hospitalId === h.id) || !db.select('hospital_capacity').some((c) => c.hospitalId === h.id)) return null
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

export const setEmergency = rpc('hospitals.setEmergency', async function setEmergency(hospitalId: string, level: EmergencyLevel) {
  oneOf(level, ENUMS.emergency, 'emergency status')
  requireHospitalStaff(hospitalId)
  await latency(160)
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  db.write(['hospital_status', 'hospital_departments'], (d) => {
    const s = d.hospital_status.find((x) => x.hospitalId === hospitalId)!
    s.emergency = level; s.updatedAt = new Date().toISOString(); s.lastReminderAt = undefined
    const ed = d.hospital_departments.find((x) => x.hospitalId === hospitalId && x.name === 'Emergency Department')
    if (ed) ed.status = level
  })
  patientsWithUpcoming(hospitalId).forEach((p) => notify(p, 'status', 'Hospital status changed', `${h.name}: emergency department is now ${LEVEL_LABEL[level].toLowerCase()}.`, `/hospitals/${hospitalId}`))
})

export const setResource = rpc('hospitals.setResource', async function setResource(hospitalId: string, key: ResourceKey, value: Availability) {
  oneOf(key, ENUMS.resource, 'resource'); oneOf(value, ENUMS.availability, 'availability')
  requireHospitalStaff(hospitalId)
  await latency(160)
  db.write(['hospital_status'], (d) => {
    const s = d.hospital_status.find((x) => x.hospitalId === hospitalId)!
    s[key] = value; s.updatedAt = new Date().toISOString(); s.lastReminderAt = undefined
  })
})

export const setCapacity = rpc('hospitals.setCapacity', async function setCapacity(hospitalId: string, patch: Partial<Pick<HospitalCapacity, 'overall' | 'emergency' | 'bedsAvailable' | 'bedsTotal' | 'icuAvailable'>>) {
  if (!patch || typeof patch !== 'object') throw new AppError('validation', 'Invalid capacity.')
  if (patch.overall !== undefined) oneOf(patch.overall, ENUMS.overall, 'capacity')
  if (patch.emergency !== undefined) oneOf(patch.emergency, ENUMS.ecap, 'emergency capacity')
  for (const k of ['bedsAvailable', 'bedsTotal', 'icuAvailable'] as const) if (patch[k] !== undefined) patch[k] = Math.round(num(patch[k], 0, 100000, 'bed count'))
  patch = { overall: patch.overall, emergency: patch.emergency, bedsAvailable: patch.bedsAvailable, bedsTotal: patch.bedsTotal, icuAvailable: patch.icuAvailable }
  Object.keys(patch).forEach((k) => patch[k as keyof typeof patch] === undefined && delete patch[k as keyof typeof patch])
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
  runAutomations()
  if (patch.overall && patch.overall !== prev.overall) {
    patientsWithUpcoming(hospitalId).forEach((p) => notify(p, 'status', 'Hospital status changed', `${h.name}: capacity is now ${LEVEL_LABEL[patch.overall as OverallCapacity].toLowerCase()}.`, `/hospitals/${hospitalId}`))
  }
})
export type { EmergencyCapacity }

export const updateSlot = rpc('hospitals.updateSlot', async function updateSlot(hospitalId: string, slotId: string, capacity: number) {
  requireHospitalStaff(hospitalId)
  capacity = Math.round(num(capacity, 0, 50, 'capacity'))
  await latency(120)
  const slot = db.select('hospital_slots').find((s) => s.id === slotId && s.hospitalId === hospitalId)
  if (!slot) throw new AppError('not_found', 'Slot not found.')
  if (capacity < slot.booked) throw new AppError('validation', `${slot.booked} patient(s) already booked this time. Capacity cannot go below that.`)
  db.write(['hospital_slots'], (d) => { d.hospital_slots.find((s) => s.id === slotId)!.capacity = Math.min(50, Math.max(0, capacity)) })
})

export const closeDay = rpc('hospitals.closeDay', async function closeDay(hospitalId: string, serviceId: string, date: string) {
  requireHospitalStaff(hospitalId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new AppError('validation', 'Choose a valid date.')
  await latency(160)
  db.write(['hospital_slots'], (d) => d.hospital_slots.forEach((s) => { if (s.hospitalId === hospitalId && s.serviceId === serviceId && s.date === date) s.capacity = s.booked }))
})

export const addSlotTime = rpc('hospitals.addSlotTime', async function addSlotTime(hospitalId: string, serviceId: string, date: string, time: string, capacity: number) {
  requireHospitalStaff(hospitalId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) throw new AppError('validation', 'Choose a valid date and time.')
  capacity = Math.round(num(capacity, 1, 50, 'capacity'))
  if (!db.select('hospital_services').some((s) => s.id === serviceId && s.hospitalId === hospitalId)) throw new AppError('not_found', 'Service not found.')
  await latency(160)
  const id = `sl_${serviceId}_${date}_${time.replace(':', '')}`
  if (db.select('hospital_slots').some((s) => s.id === id)) throw new AppError('exists', 'That time already exists. Edit its capacity instead.')
  db.write(['hospital_slots'], (d) => d.hospital_slots.push({ id, hospitalId, serviceId, date, time, capacity, booked: 0 }))
})

export const saveService = rpc('hospitals.saveService', async function saveService(hospitalId: string, s: Partial<Service> & { name: string; category: string }) {
  text(s?.name, 120, 'a service name', true); text(s.category, 80, 'a category', true)
  if (s.durationMins !== undefined) s.durationMins = Math.round(num(s.durationMins, 5, 600, 'duration'))
  if (s.fee !== undefined && s.fee !== null) s.fee = Math.round(num(s.fee, 0, 100_000_000, 'fee'))
  requireHospitalStaff(hospitalId)
  await latency()
  if (!s.name.trim()) throw new AppError('validation', 'Give the service a name.')
  db.write(['hospital_services', 'hospital_slots', 'hospitals'], (d) => {
    if (s.id) {
      const x = d.hospital_services.find((y) => y.id === s.id && y.hospitalId === hospitalId)
      if (!x) throw new AppError('not_found', 'Service not found.')
      const { name, category, departmentId, durationMins, fee, bookable, active } = s
      Object.assign(x, Object.fromEntries(Object.entries({ name, category, departmentId, durationMins, bookable, active }).filter(([, v]) => v !== undefined)))
      // A price of 0 clears it ("price on request": patients are asked to call)
      if (fee !== undefined && fee !== null) x.fee = fee > 0 ? fee : undefined
    } else {
      d.hospital_services.push({ id: uid('sv_'), hospitalId, name: s.name.trim(), category: s.category, departmentId: s.departmentId, durationMins: s.durationMins ?? 20, fee: s.fee && s.fee > 0 ? s.fee : undefined, bookable: s.bookable ?? true, active: true })
    }
    const h = d.hospitals.find((y) => y.id === hospitalId)!
    h.specialties = [...new Set(d.hospital_services.filter((y) => y.hospitalId === hospitalId && y.active).map((y) => y.category))]
    ensureSlots(d)
  })
})

export const removeService = rpc('hospitals.removeService', async function removeService(hospitalId: string, id: string) {
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
})

export const saveDepartment = rpc('hospitals.saveDepartment', async function saveDepartment(hospitalId: string, dep: Partial<Department> & { name: string }) {
  text(dep?.name, 120, 'a department name', true); if (dep.status !== undefined) oneOf(dep.status, ENUMS.emergency, 'department status')
  requireHospitalStaff(hospitalId)
  await latency()
  if (!dep.name.trim()) throw new AppError('validation', 'Give the department a name.')
  db.write(['hospital_departments'], (d) => {
    if (dep.id) Object.assign(d.hospital_departments.find((x) => x.id === dep.id && x.hospitalId === hospitalId)!, dep)
    else d.hospital_departments.push({ id: uid('dp_'), hospitalId, name: dep.name.trim(), head: dep.head, phone: dep.phone, status: dep.status ?? 'open' })
  })
})
export const removeDepartment = rpc('hospitals.removeDepartment', async function removeDepartment(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency()
  db.write(['hospital_departments', 'hospital_services', 'hospital_doctors'], (d) => {
    d.hospital_departments = d.hospital_departments.filter((x) => !(x.id === id && x.hospitalId === hospitalId))
    d.hospital_services.forEach((s) => { if (s.departmentId === id) s.departmentId = undefined })
    d.hospital_doctors.forEach((s) => { if (s.departmentId === id) s.departmentId = undefined })
  })
})

export const saveDoctor = rpc('hospitals.saveDoctor', async function saveDoctor(hospitalId: string, doc: Partial<Doctor> & { name: string; specialty: string }) {
  text(doc?.name, 120, 'a name', true); text(doc.specialty, 120, 'a specialty', true); text(doc.email, 200, 'an email'); text(doc.phone, 40, 'a phone number'); text(doc.departmentId, 100, 'a department')
  requireHospitalStaff(hospitalId)
  await latency()
  if (!doc.name.trim()) throw new AppError('validation', 'Enter the provider\'s name.')
  const email = doc.email?.trim().toLowerCase() || undefined
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AppError('validation', 'Enter a valid email address, like name@gmail.com.')
  if (email && db.select('hospital_doctors').some((x) => x.email === email && x.id !== doc.id)) throw new AppError('duplicate', `${email} is already used by another doctor.`)
  if (doc.departmentId && !db.select('hospital_departments').some((x) => x.id === doc.departmentId && x.hospitalId === hospitalId)) throw new AppError('validation', 'Choose one of your departments.')
  // A doctor who already has a Medic Hub doctor account with this email is linked straight away
  const account = email ? db.select('users').find((u) => u.email === email && u.role === 'doctor') : undefined
  const fields = { name: doc.name.trim(), specialty: doc.specialty, departmentId: doc.departmentId || undefined, available: doc.available ?? true, email, phone: doc.phone?.trim() || undefined, userId: account?.id }
  db.write(['hospital_doctors'], (d) => {
    if (doc.id) {
      const x = d.hospital_doctors.find((y) => y.id === doc.id && y.hospitalId === hospitalId)
      if (!x) throw new AppError('not_found', 'Doctor not found.')
      Object.assign(x, fields, { userId: email === x.email ? (x.userId ?? account?.id) : account?.id })
    } else d.hospital_doctors.push({ id: uid('dr_'), hospitalId, ...fields })
  })
})
export const removeDoctor = rpc('hospitals.removeDoctor', async function removeDoctor(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency()
  db.write(['hospital_doctors'], (d) => { d.hospital_doctors = d.hospital_doctors.filter((x) => !(x.id === id && x.hospitalId === hospitalId)) })
})

export const updateHospitalProfile = rpc('hospitals.updateHospitalProfile', async function updateHospitalProfile(hospitalId: string, patch: Partial<Hospital>) {
  requireHospitalStaff(hospitalId)
  await latency(300)
  // Staff cannot change verification or ownership from the profile editor
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ALLOWED: (keyof Hospital)[] = ['name', 'type', 'tagline', 'description', 'address', 'area', 'city', 'state', 'lat', 'lng', 'phone', 'emergencyPhone', 'email', 'website', 'socials', 'hue', 'logo', 'cover', 'photos', 'is24h', 'hours', 'facilities', 'specialties', 'admin', 'autoConfirm']
  const safe = Object.fromEntries(Object.entries(patch ?? {}).filter(([k]) => ALLOWED.includes(k as keyof Hospital))) as Partial<Hospital>
  if (safe.lat !== undefined) safe.lat = num(safe.lat, 4, 14, 'latitude')
  if (safe.lng !== undefined) safe.lng = num(safe.lng, 2.5, 15, 'longitude')
  if (safe.hue !== undefined) safe.hue = Math.round(num(safe.hue, 0, 360, 'colour'))
  for (const k of ['name', 'tagline', 'address', 'area', 'city', 'state', 'phone', 'emergencyPhone', 'email', 'website'] as const) if (safe[k] !== undefined) text(safe[k], 300, k)
  if (safe.description !== undefined) text(safe.description, 4000, 'description')
  for (const k of ['logo', 'cover'] as const) if (safe[k] && (typeof safe[k] !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(safe[k]!) || safe[k]!.length > 2_500_000)) throw new AppError('validation', 'Upload a JPG, PNG or WebP image under 2 MB.')
  if (safe.photos !== undefined && (!Array.isArray(safe.photos) || safe.photos.some((p) => !p || typeof p.src !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(p.src) || p.src.length > 2_500_000 || typeof p.label !== 'string'))) throw new AppError('validation', 'Upload JPG, PNG or WebP photos under 2 MB each.')
  if (safe.name !== undefined && !safe.name.trim()) throw new AppError('validation', 'Hospital name is required.')
  db.write(['hospitals'], (d) => {
    const h = d.hospitals.find((x) => x.id === hospitalId)!
    Object.assign(h, safe, { updatedAt: new Date().toISOString() })
    if (h.cover === '') delete h.cover
    if (h.logo === '') delete h.logo
    if (h.photos) h.photos = h.photos.slice(0, 8)
  })
})

export const publishAnnouncement = rpc('hospitals.publishAnnouncement', async function publishAnnouncement(hospitalId: string, a: { title: string; body: string; severity: AnnouncementSeverity }) {
  text(a?.title, 140, 'a title', true); text(a.body, 2000, 'a message'); oneOf(a.severity, ENUMS.severity, 'severity')
  requireHospitalStaff(hospitalId)
  await latency()
  if (!a.title.trim()) throw new AppError('validation', 'Add a headline for the announcement.')
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  db.write(['hospital_announcements'], (d) => d.hospital_announcements.push({ id: uid('an_'), hospitalId, title: a.title.trim(), body: a.body.trim(), severity: a.severity, active: true, createdAt: new Date().toISOString() }))
  patientsWithUpcoming(hospitalId).forEach((p) => notify(p, 'announcement', `Update from ${h.name}`, a.title.trim(), `/hospitals/${hospitalId}`))
})
export const setAnnouncementActive = rpc('hospitals.setAnnouncementActive', async function setAnnouncementActive(hospitalId: string, id: string, active: boolean) {
  requireHospitalStaff(hospitalId)
  await latency(120)
  db.write(['hospital_announcements'], (d) => { const a = d.hospital_announcements.find((x) => x.id === id && x.hospitalId === hospitalId); if (a) a.active = active })
})
export const deleteAnnouncement = rpc('hospitals.deleteAnnouncement', async function deleteAnnouncement(hospitalId: string, id: string) {
  requireHospitalStaff(hospitalId)
  await latency(120)
  db.write(['hospital_announcements'], (d) => { d.hospital_announcements = d.hospital_announcements.filter((x) => !(x.id === id && x.hospitalId === hospitalId)) })
})

// ---------------- Onboarding & verification ----------------
export interface OnboardingInput {
  name: string; type: Hospital['type']; tagline: string; description: string; phone: string; emergencyPhone: string; email: string; website?: string
  address: string; area: string; city: string; state: string; lat: number; lng: number
  specialties: string[]; facilities: string[]; is24h: boolean
  registration: Hospital['registration']
  documents: { name: string; kind: string; size: number; fileId?: string }[]
  admin: Hospital['admin']
}

export const submitOnboarding = rpc('hospitals.submitOnboarding', async function submitOnboarding(input: OnboardingInput): Promise<string> {
  const u = requireRole('hospital')
  if (!input || typeof input !== 'object') throw new AppError('validation', 'Invalid submission.')
  text(input.name, 160, 'your facility name', true); text(input.description, 4000, 'a description', true); text(input.phone, 40, 'a phone number', true)
  for (const k of ['tagline', 'emergencyPhone', 'email', 'website', 'address', 'area', 'city', 'state'] as const) text(input[k], 300, k)
  oneOf(input.type, ['Teaching', 'Federal Medical Centre', 'General', 'Specialist', 'Private', 'Mission', 'Primary Care'] as const, 'facility type')
  input.lat = num(input.lat, 4, 14, 'latitude'); input.lng = num(input.lng, 2.5, 15, 'longitude')
  if (!Array.isArray(input.specialties) || !input.specialties.length || input.specialties.some((x) => !ALL_SPECIALTIES.includes(x))) throw new AppError('validation', 'Choose your services.')
  if (!Array.isArray(input.facilities) || input.facilities.some((x) => typeof x !== 'string' || x.length > 60)) throw new AppError('validation', 'Invalid facilities.')
  if (!input.registration || typeof input.registration !== 'object') throw new AppError('validation', 'Enter your registration details.')
  text(input.registration.cacNumber, 60, 'your CAC number', true); text(input.registration.licenseNumber, 80, 'your licence number', true); text(input.registration.licensingBody, 120, 'the licensing body', true)
  input.registration.bedCount = Math.round(num(input.registration.bedCount ?? 0, 0, 10000, 'bed count'))
  if (!input.admin || typeof input.admin !== 'object') throw new AppError('validation', 'Enter the administrator.')
  text(input.admin.name, 120, "the administrator's name", true); text(input.admin.email, 200, "the administrator's email", true)
  if (!Array.isArray(input.documents) || input.documents.length > 10) throw new AppError('validation', 'Invalid documents.')
  input.documents = input.documents.map((d) => ({ name: text(d?.name, 200, 'a file name', true), kind: text(d.kind, 100, 'a document type'), size: Math.round(num(d.size, 0, 20_000_000, 'file size')), fileId: d.fileId ? text(d.fileId, 60, 'a file') : undefined }))
  input.is24h = input.is24h === true
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
      d.hospital_services.push({ id: uid('sv_'), hospitalId: id, name: m.name, category: sp, departmentId: depIds.get(m.dept), durationMins: m.mins || 20, fee: undefined, bookable: m.bookable, active: true })
    })
    const has = (sp: string) => input.specialties.includes(sp)
    d.hospital_status.push({ hospitalId: id, emergency: has('Emergency medicine') ? 'open' : 'closed', oxygen: input.facilities.includes('Oxygen plant') ? 'available' : 'limited', pharmacy: has('Pharmacy') ? 'available' : 'unavailable', laboratory: has('Laboratory') ? 'available' : 'unavailable', ambulance: input.facilities.includes('Ambulance') ? 'available' : 'unavailable', maternity: has('Obstetrics & Gynecology') ? 'available' : 'unavailable', theatre: input.facilities.includes('Theatre') ? 'available' : 'unavailable', bloodBank: input.facilities.includes('Blood bank') ? 'available' : 'unavailable', updatedAt: now })
    d.hospital_capacity.push({ hospitalId: id, overall: 'available', emergency: has('Emergency medicine') ? 'available' : 'full', bedsTotal: input.registration.bedCount, bedsAvailable: 0, icuAvailable: 0, updatedAt: now })
    input.documents.forEach((doc) => d.hospital_documents.push({ id: uid('doc_'), hospitalId: id, name: doc.name, kind: doc.kind, size: doc.size, fileId: doc.fileId, uploadedAt: now, status: 'submitted' }))
    ensureSlots(d)
  })
  notify(u.id, 'verification', 'Your verification documents were submitted', 'Our team reviews new facilities within 2 working days. You can set up your services and slots in the meantime.', '/hospital/verification')
  db.select('users').filter((x) => x.role === 'admin').forEach((a) => notify(a.id, 'verification', 'New verification request', `${input.name} submitted documents for review.`, '/admin'))
  return id
})

export const resubmitVerification = rpc('hospitals.resubmitVerification', async function resubmitVerification(hospitalId: string, docs: { name: string; kind: string; size: number; fileId?: string }[]) {
  const u = requireHospitalStaff(hospitalId)
  await latency(400)
  const now = new Date().toISOString()
  db.write(['hospitals', 'hospital_documents'], (d) => {
    const h = d.hospitals.find((x) => x.id === hospitalId)!
    h.verification = 'pending'; h.submittedAt = now; h.verificationNote = undefined
    docs.forEach((doc) => d.hospital_documents.push({ id: uid('doc_'), hospitalId, name: doc.name, kind: doc.kind, size: doc.size, fileId: doc.fileId, uploadedAt: now, status: 'submitted' }))
  })
  notify(u.id, 'verification', 'Your verification documents were submitted', 'We will review your updated documents shortly.', '/hospital/verification')
})

export function verificationQueue() {
  requireRole('admin')
  return db.select('hospitals').filter((h) => !h.publicRecord).map((h) => ({ ...h, documents: db.select('hospital_documents').filter((x) => x.hospitalId === h.id) }))
}

export const reviewHospital = rpc('hospitals.reviewHospital', async function reviewHospital(hospitalId: string, decision: Verification, note?: string) {
  oneOf(decision, ENUMS.verification, 'decision'); text(note, 2000, 'a note')
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
})
