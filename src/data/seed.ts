import type { Tables } from '../lib/store'
import type {
  Availability, Booking, BookingStatus, DayHours, Department, Doctor, EmergencyLevel, Hospital, HospitalCapacity, HospitalStatus,
  HospitalType, OverallCapacity, Service, Slot, User, Verification, EmergencyCapacity,
} from '../types'
import { mulberry32 } from '../lib/ids'
import { addDays, today } from '../utils/date'

export const DEMO_PASSWORD = 'demo1234'
export const DEMO_ACCOUNTS = {
  patient: { email: 'amaka@medichub.demo', label: 'Patient', name: 'Amaka Okafor' },
  hospital: { email: 'ops@lagooncrest.demo', label: 'Hospital staff', name: 'Lagoon Crest Specialist Hospital' },
  admin: { email: 'review@medichub.demo', label: 'Platform reviewer', name: 'Medic Hub Trust & Safety' },
}

export const SPECIALTY_SERVICE: Record<string, { name: string; dept: string; bookable: boolean; mins: number; fee?: number }> = {
  'Emergency medicine': { name: 'Emergency care (walk-in)', dept: 'Emergency Department', bookable: false, mins: 0 },
  'General practice': { name: 'General consultation', dept: 'Outpatients', bookable: true, mins: 20, fee: 10000 },
  Pediatrics: { name: 'Paediatric clinic', dept: 'Paediatrics', bookable: true, mins: 20, fee: 12000 },
  'Obstetrics & Gynecology': { name: 'Antenatal clinic', dept: 'Maternity', bookable: true, mins: 30, fee: 15000 },
  Cardiology: { name: 'Cardiology consultation', dept: 'Cardiology', bookable: true, mins: 30, fee: 25000 },
  Surgery: { name: 'Surgical outpatient clinic', dept: 'Surgery', bookable: true, mins: 20, fee: 20000 },
  Orthopedics: { name: 'Orthopaedic clinic', dept: 'Orthopaedics', bookable: true, mins: 20, fee: 20000 },
  Dialysis: { name: 'Dialysis session', dept: 'Renal Unit', bookable: true, mins: 240, fee: 45000 },
  Radiology: { name: 'Ultrasound scan', dept: 'Radiology', bookable: true, mins: 20, fee: 15000 },
  Laboratory: { name: 'Laboratory tests', dept: 'Laboratory', bookable: true, mins: 15, fee: 5000 },
  Pharmacy: { name: 'Pharmacy', dept: 'Pharmacy', bookable: false, mins: 0 },
  Dental: { name: 'Dental check-up', dept: 'Dental', bookable: true, mins: 30, fee: 12000 },
  'Mental health': { name: 'Mental health consultation', dept: 'Mental Health', bookable: true, mins: 45, fee: 18000 },
  Physiotherapy: { name: 'Physiotherapy session', dept: 'Physiotherapy', bookable: true, mins: 45, fee: 12000 },
}
export const ALL_SPECIALTIES = Object.keys(SPECIALTY_SERVICE)
export const FACILITY_OPTIONS = ['24/7 emergency', 'ICU', 'NICU', 'Theatre', 'Blood bank', 'Oxygen plant', 'Ambulance', 'Pharmacy', 'Laboratory', 'CT scan', 'MRI', 'X-ray', 'Ultrasound', 'Dialysis', 'Maternity ward', 'Parking', 'NHIA accepted', 'HMO accepted']

interface Def {
  id: string; publicRecord?: boolean; name: string; type: HospitalType; tagline: string; area: string; city: string; state: string; lat: number; lng: number
  specialties: string[]; is24h: boolean; hue: number; verification: Verification; beds: number; facilities: string[]; street: string
  emergency: EmergencyLevel; overall: OverallCapacity; ecap: EmergencyCapacity; oxygen: Availability; phone: string; year: string
}

const D = (d: Partial<Def> & Pick<Def, 'id' | 'name' | 'area' | 'city' | 'state' | 'lat' | 'lng' | 'specialties' | 'street'>): Def => ({
  type: 'Private', tagline: '', is24h: false, hue: 160, verification: 'verified', beds: 60, facilities: ['Pharmacy', 'Laboratory', 'HMO accepted'],
  emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', phone: '+234 800 000 0000', year: '2008', ...d,
})

const DEFS: Def[] = [
  D({ id: 'h_lagooncrest', name: 'Lagoon Crest Specialist Hospital', type: 'Specialist', tagline: 'Specialist care on the Lekki corridor', area: 'Lekki Phase 1', city: 'Lagos', state: 'Lagos', lat: 6.4474, lng: 3.4723, street: '14 Admiralty Way', specialties: ['Emergency medicine', 'General practice', 'Pediatrics', 'Cardiology', 'Radiology', 'Laboratory', 'Pharmacy', 'Obstetrics & Gynecology'], is24h: true, hue: 162, beds: 120, facilities: ['24/7 emergency', 'ICU', 'Theatre', 'Blood bank', 'Oxygen plant', 'Ambulance', 'CT scan', 'Ultrasound', 'Pharmacy', 'Laboratory', 'HMO accepted', 'Parking'], phone: '+234 201 330 4410', year: '2011' }),
  D({ id: 'h_luth', publicRecord: true, name: "Lagos University Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Lagos', area: "Idi-Araba", city: 'Lagos', state: 'Lagos', lat: 6.5176, lng: 3.3547, street: "Ishaga Road, Idi-Araba, Surulere", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology', 'Cardiology', 'Radiology', 'Laboratory', 'Pharmacy', 'Dental'], is24h: true, hue: 152, beds: 761, emergency: 'busy', overall: 'high', ecap: 'limited', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1962' }),
  D({ id: 'h_fmcebutemetta', publicRecord: true, name: "Federal Medical Centre, Ebute Metta", type: 'Federal Medical Centre', tagline: 'Federal tertiary hospital in Lagos', area: "Ebute Metta", city: 'Lagos', state: 'Lagos', lat: 6.4878, lng: 3.3775, street: "Ebute Metta", specialties: ['Emergency medicine', 'General practice', 'Obstetrics & Gynecology', 'Pediatrics', 'Laboratory', 'Pharmacy'], is24h: true, hue: 140, beds: 300, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1896' }),
  D({ id: 'h_noh_igbobi', publicRecord: true, name: "National Orthopaedic Hospital, Igbobi", type: 'Specialist', tagline: 'Federal tertiary hospital in Lagos', area: "Igbobi, Yaba", city: 'Lagos', state: 'Lagos', lat: 6.5255, lng: 3.3703, street: "Igbobi, Yaba", specialties: ['Orthopedics', 'Emergency medicine', 'Physiotherapy', 'Radiology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 175, beds: 440, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1943' }),
  D({ id: 'h_nationalabuja', publicRecord: true, name: "National Hospital, Abuja", type: 'Specialist', tagline: 'Federal tertiary hospital in Abuja', area: "Central Business District", city: 'Abuja', state: 'FCT', lat: 9.0409, lng: 7.473, street: "Central Business District", specialties: ['Emergency medicine', 'General practice', 'Cardiology', 'Surgery', 'Dialysis', 'Obstetrics & Gynecology', 'Pediatrics', 'Radiology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 160, beds: 400, emergency: 'busy', overall: 'high', ecap: 'limited', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1999' }),
  D({ id: 'h_fmcjabi', publicRecord: true, name: "Federal Medical Centre, Jabi", type: 'Federal Medical Centre', tagline: 'Federal tertiary hospital in Abuja', area: "Jabi", city: 'Abuja', state: 'FCT', lat: 9.0667, lng: 7.425, street: "Jabi", specialties: ['Emergency medicine', 'General practice', 'Pediatrics', 'Obstetrics & Gynecology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 145, beds: 200, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '2016' }),
  D({ id: 'h_uath', publicRecord: true, name: "University of Abuja Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Abuja', area: "Gwagwalada", city: 'Abuja', state: 'FCT', lat: 8.942, lng: 7.083, street: "Gwagwalada", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 135, beds: 350, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'limited', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1993' }),
  D({ id: 'h_uch', publicRecord: true, name: "University College Hospital, Ibadan", type: 'Teaching', tagline: 'Federal tertiary hospital in Ibadan', area: "Agodi", city: 'Ibadan', state: 'Oyo', lat: 7.404, lng: 3.903, street: "Queen Elizabeth Road, Agodi", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Cardiology', 'Pediatrics', 'Obstetrics & Gynecology', 'Radiology', 'Laboratory', 'Pharmacy', 'Mental health'], is24h: true, hue: 150, beds: 850, emergency: 'busy', overall: 'high', ecap: 'limited', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1957' }),
  D({ id: 'h_upth', publicRecord: true, name: "University of Port Harcourt Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Port Harcourt', area: "Alakahia", city: 'Port Harcourt', state: 'Rivers', lat: 4.896, lng: 6.928, street: "East-West Road, Alakahia", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Dialysis', 'Radiology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 170, beds: 600, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'limited', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1980' }),
  D({ id: 'h_ubth', publicRecord: true, name: "University of Benin Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Benin City', area: "Ugbowo", city: 'Benin City', state: 'Edo', lat: 6.399, lng: 5.613, street: "Ugbowo", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Obstetrics & Gynecology', 'Pediatrics', 'Laboratory', 'Pharmacy'], is24h: true, hue: 140, beds: 650, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1973' }),
  D({ id: 'h_unth', publicRecord: true, name: "University of Nigeria Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Enugu', area: "Ituku-Ozalla", city: 'Enugu', state: 'Enugu', lat: 6.322, lng: 7.458, street: "Ituku-Ozalla", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology', 'Radiology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 185, beds: 500, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1970' }),
  D({ id: 'h_akth', publicRecord: true, name: "Aminu Kano Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Kano', area: "Zaria Road", city: 'Kano', state: 'Kano', lat: 11.989, lng: 8.514, street: "Zaria Road", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Pediatrics', 'Laboratory', 'Pharmacy'], is24h: true, hue: 150, beds: 500, emergency: 'busy', overall: 'high', ecap: 'limited', oxygen: 'limited', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1988' }),
  D({ id: 'h_abuth', publicRecord: true, name: "Ahmadu Bello University Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Zaria', area: "Shika", city: 'Zaria', state: 'Kaduna', lat: 11.197, lng: 7.615, street: "Shika, Zaria", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 125, beds: 800, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1967' }),
  D({ id: 'h_uith', publicRecord: true, name: "University of Ilorin Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Ilorin', area: "Oke-Ose", city: 'Ilorin', state: 'Kwara', lat: 8.464, lng: 4.581, street: "Old Jebba Road, Oke-Ose", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Pediatrics', 'Laboratory', 'Pharmacy'], is24h: true, hue: 160, beds: 600, emergency: 'open', overall: 'available', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1980' }),
  D({ id: 'h_fmcabeokuta', publicRecord: true, name: "Federal Medical Centre, Abeokuta", type: 'Federal Medical Centre', tagline: 'Federal tertiary hospital in Abeokuta', area: "Idi-Aba", city: 'Abeokuta', state: 'Ogun', lat: 7.167, lng: 3.35, street: "Idi-Aba", specialties: ['Emergency medicine', 'General practice', 'Pediatrics', 'Obstetrics & Gynecology', 'Laboratory', 'Pharmacy'], is24h: true, hue: 155, beds: 300, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1993' }),
  D({ id: 'h_juth', publicRecord: true, name: "Jos University Teaching Hospital", type: 'Teaching', tagline: 'Federal tertiary hospital in Jos', area: "Lamingo", city: 'Jos', state: 'Plateau', lat: 9.957, lng: 8.891, street: "Lamingo", specialties: ['Emergency medicine', 'General practice', 'Surgery', 'Pediatrics', 'Laboratory', 'Pharmacy'], is24h: true, hue: 145, beds: 600, emergency: 'open', overall: 'moderate', ecap: 'available', oxygen: 'available', facilities: ['24/7 emergency', 'Laboratory', 'Pharmacy', 'NHIA accepted'], phone: '', year: '1981' }),
  // In the verification queue (not publicly listed until approved)
  D({ id: 'h_tankehills', name: 'Tanke Hills Medical Centre', type: 'Private', tagline: 'New care for Ilorin', area: 'Tanke', city: 'Ilorin', state: 'Kwara', lat: 8.4799, lng: 4.6106, street: '6 Tanke Oke-Odo Road', specialties: ['General practice', 'Emergency medicine', 'Laboratory', 'Pharmacy', 'Dental'], hue: 165, beds: 45, verification: 'under_review', phone: '+234 31 222 045', year: '2025' }),
  D({ id: 'h_ughellivale', name: 'Wuse Vale Diagnostics', type: 'Private', tagline: 'Imaging and lab diagnostics', area: 'Wuse', city: 'Abuja', state: 'FCT', lat: 9.0643, lng: 7.4731, street: '17 Adetokunbo Ademola Crescent', specialties: ['Radiology', 'Laboratory'], hue: 210, beds: 0, verification: 'pending', emergency: 'closed', ecap: 'full', phone: '+234 9 290 8800', year: '2024' }),
]

// Lagoon Crest starts 13 hours stale so the reminder + "Still correct" flow is visible in the demo;
// Tanke Hills (in review) shows the over-a-day warning once approved.
const STATUS_AGE_MIN: Record<string, number> = { h_lagooncrest: 13 * 60 + 10, h_tankehills: 31 * 60 }

const DOCTOR_NAMES = ['Dr. Adaeze Nwosu', 'Dr. Tunde Bakare', 'Dr. Halima Sani', 'Dr. Chinedu Eze', 'Dr. Funmilayo Adeyemi', 'Dr. Ibrahim Musa', 'Dr. Ngozi Okonkwo', 'Dr. Segun Afolabi', 'Dr. Zainab Bello', 'Dr. Emeka Obi', 'Dr. Yetunde Ogunleye', 'Dr. Aisha Lawal', 'Dr. Kelechi Umeh', 'Dr. Bola Johnson', 'Dr. Musa Danjuma', 'Dr. Ifeoma Chukwu']

const DESCRIPTIONS: Record<string, string> = {
  Specialist: 'consultant-led specialist services with modern diagnostics and a dedicated emergency team.',
  General: 'a full-service general hospital with emergency care, surgery and outpatient clinics.',
  Private: 'a private hospital offering family medicine, diagnostics and same-week appointments.',
  Mission: 'a mission hospital known for maternity care and affordable outpatient services.',
  'Primary Care': 'a primary care clinic for check-ups, vaccinations and everyday illness.',
  Teaching: 'a teaching hospital with a wide range of specialist services.',
}

function hours(is24h: boolean): DayHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) =>
    is24h ? { day, open: '00:00', close: '23:59', closed: false }
      : day === 0 ? { day, open: '09:00', close: '14:00', closed: true }
        : day === 6 ? { day, open: '09:00', close: '15:00', closed: false }
          : { day, open: '08:00', close: '18:00', closed: false })
}

export const SLOT_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00']

function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

export function slotId(serviceId: string, date: string, time: string) { return `sl_${serviceId}_${date}_${time.replace(':', '')}` }

/** Keeps a rolling 14-day window of appointment slots for every bookable service. Returns true if anything changed. */
export function ensureSlots(t: Tables): boolean {
  let changed = false
  const start = today()
  const existing = new Set(t.hospital_slots.map((s) => s.id))
  const hospitals = new Map(t.hospitals.map((h) => [h.id, h]))
  const bookedSlotIds = new Set(t.bookings.map((b) => b.slotId))
  const cutoff = addDays(start, -2)
  const before = t.hospital_slots.length
  t.hospital_slots = t.hospital_slots.filter((s) => s.date >= cutoff || bookedSlotIds.has(s.id))
  if (t.hospital_slots.length !== before) changed = true
  for (const svc of t.hospital_services) {
    if (!svc.bookable || !svc.active) continue
    const h = hospitals.get(svc.hospitalId)
    if (!h) continue
    for (let i = 0; i < 14; i++) {
      const date = addDays(start, i)
      const dow = new Date(date + 'T12:00:00').getDay()
      const dh = h.hours[dow]
      if (dh?.closed) continue
      for (const time of SLOT_TIMES) {
        if (!h.is24h && dh && (time < dh.open || time >= dh.close)) continue
        const id = slotId(svc.id, date, time)
        if (existing.has(id)) continue
        const r = mulberry32(hashStr(id))
        const capacity = 2 + Math.floor(r() * 4)
        const pressure = i === 0 ? 0.75 : i === 1 ? 0.5 : i < 4 ? 0.3 : 0.12
        let booked = Math.min(capacity, Math.floor(r() * (capacity + 1) * pressure * 1.6))
        if (i === 0 && time === '12:00') booked = capacity // show a full slot
        t.hospital_slots.push({ id, hospitalId: h.id, serviceId: svc.id, date, time, capacity, booked })
        existing.add(id)
        changed = true
      }
    }
  }
  return changed
}

export function buildSeed(): Tables {
  const now = new Date().toISOString()
  const t: Tables = {
    users: [], patient_profiles: [], hospitals: [], hospital_staff: [], hospital_departments: [], hospital_services: [],
    hospital_doctors: [], hospital_status: [], hospital_capacity: [], hospital_slots: [], bookings: [], booking_events: [],
    health_profiles: [], health_events: [], emergency_contacts: [], notifications: [], hospital_announcements: [],
    hospital_documents: [], password_resets: [],
  }
  const plain = 'plain:' + DEMO_PASSWORD
  const mkUser = (id: string, email: string, role: User['role'], name: string, phone?: string): User => ({ id, email, passwordHash: plain, role, name, phone, createdAt: now })

  t.users.push(mkUser('u_amaka', DEMO_ACCOUNTS.patient.email, 'patient', 'Amaka Okafor', '+234 803 555 0142'))
  t.users.push(mkUser('u_admin', DEMO_ACCOUNTS.admin.email, 'admin', 'Kemi Balogun'))
  t.patient_profiles.push({ userId: 'u_amaka', city: 'Lagos', dateOfBirth: '1994-03-18', gender: 'Female', onboarded: true })

  let docIdx = 0
  DEFS.forEach((d, idx) => {
    const ownerId = d.id === 'h_lagooncrest' ? 'u_lagooncrest' : 'u_owner_' + d.id.slice(2)
    const email = d.id === 'h_lagooncrest' ? DEMO_ACCOUNTS.hospital.email : `admin@${d.id.slice(2)}.demo`
    t.users.push({ ...mkUser(ownerId, email, 'hospital', d.id === 'h_lagooncrest' ? 'Folake Adebayo' : `${d.name} Admin`), passwordHash: d.id === 'h_lagooncrest' ? plain : 'locked' })
    t.hospital_staff.push({ id: 'st_' + d.id, hospitalId: d.id, userId: ownerId, role: 'owner' })
    const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const h: Hospital = {
      id: d.id, slug, name: d.name, type: d.type, tagline: d.tagline,
      description: d.publicRecord ? `${d.name} is a federal tertiary hospital in ${d.area}, ${d.city}, ${d.state} State, listed from public records of federal health institutions. It has not joined Medic Hub yet, so the live status, capacity and appointment slots shown here are demo data, not reported by the hospital.` : `${d.name} is ${DESCRIPTIONS[d.type]} Located in ${d.area}, ${d.city}, the team serves patients across ${d.state} State. This is a fictional facility created for the Medic Hub demo.`,
      address: `${d.street}, ${d.area}`, area: d.area, city: d.city, state: d.state, lat: d.lat, lng: d.lng,
      phone: d.phone, emergencyPhone: d.phone ? d.phone.replace(/\d{2}$/, '99') : '', email: d.publicRecord ? '' : `care@${slug.split('-').slice(0, 2).join('')}.demo`, publicRecord: d.publicRecord,
      website: undefined, socials: [], hue: d.hue, is24h: d.is24h, hours: hours(d.is24h), facilities: d.facilities, specialties: d.specialties,
      verification: d.publicRecord ? 'draft' : d.verification, registration: { cacNumber: `RC ${1200000 + idx * 7391}`, licenseNumber: `HEFAMAA/${d.state.slice(0, 2).toUpperCase()}/${2000 + idx}/${1000 + idx * 13}`, licensingBody: d.state === 'Lagos' ? 'HEFAMAA (Lagos State)' : `${d.state} State Ministry of Health`, yearEstablished: d.year, bedCount: d.beds },
      admin: { name: d.id === 'h_lagooncrest' ? 'Dr. Folake Adebayo' : 'Facility Administrator', title: 'Medical Director', email, phone: d.phone },
      autoConfirm: true, ownerUserId: ownerId, submittedAt: d.verification !== 'verified' ? addDays(today(), -2) + 'T10:00:00.000Z' : undefined, createdAt: now, updatedAt: now,
    }
    t.hospitals.push(h)

    const deptIds = new Map<string, string>()
    d.specialties.forEach((sp) => {
      const m = SPECIALTY_SERVICE[sp]
      if (!deptIds.has(m.dept)) {
        const dep: Department = { id: `dp_${d.id}_${deptIds.size}`, hospitalId: d.id, name: m.dept, head: DOCTOR_NAMES[(docIdx + deptIds.size) % DOCTOR_NAMES.length], phone: d.phone, status: m.dept === 'Emergency Department' ? d.emergency : 'open' }
        deptIds.set(m.dept, dep.id)
        t.hospital_departments.push(dep)
      }
    })
    let bookables = 0
    d.specialties.forEach((sp, i) => {
      const m = SPECIALTY_SERVICE[sp]
      const bookable = m.bookable && bookables < 4
      if (bookable) bookables++
      const s: Service = { id: `sv_${d.id.slice(2)}_${i}`, hospitalId: d.id, name: m.name, category: sp, departmentId: deptIds.get(m.dept), durationMins: m.mins, fee: m.fee, bookable, active: true }
      t.hospital_services.push(s)
    })
    const nDocs = d.publicRecord ? 0 : Math.min(6, 2 + Math.floor(d.specialties.length / 2))
    for (let i = 0; i < nDocs; i++) {
      const sp = d.specialties[i % d.specialties.length]
      const doc: Doctor = { id: `dr_${d.id}_${i}`, hospitalId: d.id, name: DOCTOR_NAMES[docIdx++ % DOCTOR_NAMES.length], specialty: sp, departmentId: deptIds.get(SPECIALTY_SERVICE[sp].dept), available: i % 4 !== 3 }
      t.hospital_doctors.push(doc)
    }
    const r = mulberry32(idx + 7)
    const pick = (): Availability => (r() < 0.75 ? 'available' : r() < 0.6 ? 'limited' : 'unavailable')
    const has = (f: string) => d.facilities.includes(f)
    const st: HospitalStatus = {
      hospitalId: d.id, emergency: d.emergency, oxygen: d.oxygen,
      pharmacy: d.specialties.includes('Pharmacy') ? 'available' : 'unavailable',
      laboratory: d.specialties.includes('Laboratory') ? pick() : 'unavailable',
      ambulance: has('Ambulance') ? pick() : 'unavailable',
      maternity: d.specialties.includes('Obstetrics & Gynecology') ? pick() : 'unavailable',
      theatre: has('Theatre') ? pick() : 'unavailable',
      bloodBank: has('Blood bank') ? pick() : 'unavailable',
      updatedAt: new Date(Date.now() - (STATUS_AGE_MIN[d.id] ?? (idx + 1) * 7) * 60000).toISOString(),
    }
    t.hospital_status.push(st)
    const avail = Math.max(0, Math.round(d.beds * (d.overall === 'available' ? 0.4 : d.overall === 'moderate' ? 0.22 : d.overall === 'high' ? 0.08 : 0)))
    const cap: HospitalCapacity = { hospitalId: d.id, overall: d.overall, emergency: d.ecap, bedsTotal: d.beds, bedsAvailable: avail, icuAvailable: has('ICU') ? Math.floor(r() * 4) : 0, updatedAt: st.updatedAt }
    t.hospital_capacity.push(cap)
  })

  // Documents for queued hospitals
  for (const hid of ['h_tankehills', 'h_ughellivale']) {
    ;['CAC certificate.pdf', 'Facility operating licence.pdf', 'Medical director MDCN licence.pdf'].forEach((name, i) =>
      t.hospital_documents.push({ id: `doc_${hid}_${i}`, hospitalId: hid, name, kind: name.split(' ')[0], size: 240000 + i * 51234, uploadedAt: addDays(today(), -2) + 'T10:00:00.000Z', status: 'submitted' }))
  }

  // Announcements
  const ann = (hospitalId: string, title: string, body: string, severity: 'info' | 'warning' | 'critical', hoursAgo: number) =>
    t.hospital_announcements.push({ id: `an_${t.hospital_announcements.length}`, hospitalId, title, body, severity, active: true, createdAt: new Date(Date.now() - hoursAgo * 3600000).toISOString() })
  ann('h_lagooncrest', 'Additional appointment slots opened', 'We have added extra general consultation slots this week. Book early to secure your preferred time.', 'info', 3)

  // Other patients (for hospital queue realism)
  const others = ['Chioma Eze', 'Babatunde Ogun', 'Fatima Abubakar', 'Oluwaseun Adeleke', 'Uche Nnaji', 'Grace Etim', 'Kunle Ajayi', 'Hauwa Garba', 'Emeka Nwachukwu', 'Temitope Oyelaran']
  others.forEach((n, i) => {
    t.users.push({ ...mkUser(`u_p${i}`, `patient${i}@example.demo`, 'patient', n, `+234 80${i} 555 01${10 + i}`), passwordHash: 'locked' })
    t.patient_profiles.push({ userId: `u_p${i}`, city: 'Lagos', onboarded: true })
  })

  ensureSlots(t)

  // Bookings
  const svcOf = (hid: string, name: string) => t.hospital_services.find((s) => s.hospitalId === hid && s.name === name)!
  let refN = 0
  const REFS = ['MED-7X82K9', 'MED-Q4LM2T', 'MED-H8VN3R', 'MED-2KP9WD', 'MED-ZX4T7B', 'MED-R6YH2M', 'MED-9CQ3LA', 'MED-T5NE8K', 'MED-M3JD6V', 'MED-W8PB4S', 'MED-C2GX9H', 'MED-K7RA5N', 'MED-F4UT2Q', 'MED-B9LZ6E', 'MED-P3WM8C', 'MED-V6HK2Y']
  const book = (patientId: string, hid: string, svcName: string, dayOffset: number, time: string, status: BookingStatus, reason?: string) => {
    const svc = svcOf(hid, svcName)
    const date = addDays(today(), dayOffset)
    const id = slotId(svc.id, date, time)
    let slot = t.hospital_slots.find((s) => s.id === id)
    if (!slot) { slot = { id, hospitalId: hid, serviceId: svc.id, date, time, capacity: 4, booked: 0 } as Slot; t.hospital_slots.push(slot) }
    if (slot.booked >= slot.capacity) slot.capacity = slot.booked + 1
    if (status !== 'cancelled') slot.booked++
    const u = t.users.find((x) => x.id === patientId)!
    const created = new Date(Date.now() - (Math.abs(dayOffset) + 2) * 86400000).toISOString()
    const b: Booking = { id: `bk_${refN}`, ref: REFS[refN++], token: `tok${refN}${Math.random().toString(36).slice(2, 10)}`, patientId, patientName: u.name, patientPhone: u.phone, hospitalId: hid, serviceId: svc.id, slotId: id, date, time, reason, status, createdAt: created, updatedAt: created }
    t.bookings.push(b)
    t.booking_events.push({ id: `be_${b.id}_0`, bookingId: b.id, status: 'confirmed', at: created, by: 'system' })
    if (status !== 'confirmed' && status !== 'pending') t.booking_events.push({ id: `be_${b.id}_1`, bookingId: b.id, status, at: created, by: 'hospital' })
    return b
  }
  // Amaka
  book('u_amaka', 'h_lagooncrest', 'General consultation', 1, '10:00', 'confirmed', 'Recurring headaches for two weeks')
  book('u_amaka', 'h_luth', 'Dental check-up', -12, '11:00', 'completed', 'Routine check-up')
  book('u_amaka', 'h_nationalabuja', 'Cardiology consultation', -30, '09:00', 'cancelled', 'Follow-up')
  // Lagoon Crest queue today
  const qStatuses: BookingStatus[] = ['completed', 'completed', 'in_consultation', 'checked_in', 'checked_in', 'confirmed', 'confirmed', 'pending', 'confirmed', 'no_show']
  const qTimes = ['08:00', '08:00', '09:00', '09:00', '10:00', '10:00', '11:00', '14:00', '15:00', '08:00']
  const qSvc = ['General consultation', 'Paediatric clinic', 'Cardiology consultation', 'General consultation', 'Ultrasound scan', 'General consultation', 'Paediatric clinic', 'Cardiology consultation', 'General consultation', 'Ultrasound scan']
  qStatuses.forEach((s, i) => book(`u_p${i}`, 'h_lagooncrest', qSvc[i], 0, qTimes[i], s))
  book('u_p3', 'h_lagooncrest', 'General consultation', 2, '09:00', 'pending', 'Blood pressure review')
  book('u_p6', 'h_lagooncrest', 'Cardiology consultation', 3, '11:00', 'confirmed')
  // Historical bookings for analytics
  for (let d = 1; d <= 6; d++) {
    const n = 3 + ((d * 7) % 5)
    for (let k = 0; k < n; k++) {
      const svc = ['General consultation', 'Paediatric clinic', 'Cardiology consultation', 'Ultrasound scan'][k % 4]
      const time = SLOT_TIMES[(k + d) % SLOT_TIMES.length]
      const st: BookingStatus = k % 7 === 6 ? 'no_show' : k % 9 === 8 ? 'cancelled' : 'completed'
      const b = book(`u_p${(k + d) % 10}`, 'h_lagooncrest', svc, -d, time, st)
      b.ref = 'MED-' + (b.id.toUpperCase().replace('BK_', 'H') + 'XXXXX').slice(0, 6)
    }
  }

  // Health profile and timeline
  t.health_profiles.push({ userId: 'u_amaka', bloodGroup: 'O+', genotype: 'AA', allergies: ['Penicillin'], conditions: ['Asthma'], medications: [{ name: 'Salbutamol inhaler', dose: '2 puffs as needed' }], heightCm: 168, weightKg: 64, notes: 'Carries a reliever inhaler in her bag.', updatedAt: now })
  t.emergency_contacts.push({ id: 'ec_1', userId: 'u_amaka', name: 'Chidi Okafor', relationship: 'Brother', phone: '+234 802 555 0199', primary: true })
  t.emergency_contacts.push({ id: 'ec_2', userId: 'u_amaka', name: 'Ngozi Okafor', relationship: 'Mother', phone: '+234 805 555 0120', primary: false })
  const ev = (type: any, title: string, dayOffset: number, detail?: string, place?: string) => t.health_events.push({ id: `he_${t.health_events.length}`, userId: 'u_amaka', type, title, detail, date: addDays(today(), dayOffset), place })
  ev('visit', 'Dental check-up', -12, 'Scale and polish. No cavities.', 'Lagos University Teaching Hospital')
  ev('lab', 'Full blood count', -40, 'All values within normal range.', 'Lagoon Crest Specialist Hospital')
  ev('vaccination', 'Hepatitis B, dose 3', -95, 'Course completed.', 'Surulere Unity Medical Centre')
  ev('medication', 'Started salbutamol inhaler', -200, '2 puffs as needed for wheeze.')
  ev('profile', 'Health profile created', -210)

  // Notifications
  const nt = (userId: string, type: any, title: string, body: string, minsAgo: number, link?: string, read = false) =>
    t.notifications.push({ id: `nt_${t.notifications.length}`, userId, type, title, body, link, read, createdAt: new Date(Date.now() - minsAgo * 60000).toISOString() })
  nt('u_amaka', 'booking', 'Booking confirmed', 'General consultation at Lagoon Crest Specialist Hospital, tomorrow at 10:00 AM.', 60 * 26, '/app/bookings')
  nt('u_amaka', 'announcement', 'Lagoon Crest opened more slots', 'Additional general consultation slots are available this week.', 180, '/hospitals/h_lagooncrest', true)
  nt('u_lagooncrest', 'booking', 'New booking', 'Temitope Oyelaran booked a cardiology consultation.', 45, '/hospital/bookings')
  nt('u_lagooncrest', 'verification', 'Hospital verification approved', 'Lagoon Crest Specialist Hospital is verified on Medic Hub.', 60 * 24 * 40, '/hospital/verification', true)
  nt('u_admin', 'verification', 'New verification request', 'Tanke Hills Medical Centre submitted documents for review.', 60 * 48, '/admin')
  return t
}
