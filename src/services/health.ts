import { db } from '../lib/store'
import { uid } from '../lib/ids'
import type { EmergencyContact, HealthEvent, HealthProfile, PatientProfile } from '../types'
import { AppError, latency, requireRole } from './core'
import { notify } from './notifications'
import { today } from '../utils/date'

/** Health data is private to the patient. Hospitals never read it through these functions. */
export function myHealthProfile(): HealthProfile {
  const u = requireRole('patient')
  return db.select('health_profiles').find((p) => p.userId === u.id) ?? { userId: u.id, bloodGroup: '', genotype: '', allergies: [], conditions: [], medications: [], notes: '', updatedAt: new Date().toISOString() }
}

export async function saveHealthProfile(patch: Partial<HealthProfile>) {
  const u = requireRole('patient')
  await latency(300)
  const now = new Date().toISOString()
  db.write(['health_profiles', 'health_events'], (d) => {
    let p = d.health_profiles.find((x) => x.userId === u.id)
    if (!p) { p = { userId: u.id, bloodGroup: '', genotype: '', allergies: [], conditions: [], medications: [], notes: '', updatedAt: now }; d.health_profiles.push(p) }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId, ...safe } = patch
    Object.assign(p, safe, { updatedAt: now })
    d.health_events.push({ id: uid('he_'), userId: u.id, type: 'profile', title: 'Health profile updated', date: today() })
  })
  notify(u.id, 'profile', 'Your profile was updated', 'Your Health Vault changes were saved.', '/app/health')
}

export function myPatientProfile(): PatientProfile | null {
  const u = requireRole('patient')
  return db.select('patient_profiles').find((p) => p.userId === u.id) ?? null
}
export async function savePatientProfile(patch: Partial<PatientProfile>) {
  const u = requireRole('patient')
  await latency()
  db.write(['patient_profiles'], (d) => {
    let p = d.patient_profiles.find((x) => x.userId === u.id)
    if (!p) { p = { userId: u.id, onboarded: false }; d.patient_profiles.push(p) }
    Object.assign(p, patch, { userId: u.id })
  })
}

export function myContacts(): EmergencyContact[] {
  const u = requireRole('patient')
  return db.select('emergency_contacts').filter((c) => c.userId === u.id).sort((a, b) => Number(b.primary) - Number(a.primary))
}
export async function saveContact(c: Partial<EmergencyContact> & { name: string; phone: string; relationship: string }) {
  const u = requireRole('patient')
  await latency()
  if (!c.name.trim()) throw new AppError('validation', 'Enter the contact\'s name.')
  if (!/^\+?[\d\s()-]{7,}$/.test(c.phone.trim())) throw new AppError('validation', 'Enter a valid phone number, for example +234 803 000 0000.')
  db.write(['emergency_contacts'], (d) => {
    const mine = d.emergency_contacts.filter((x) => x.userId === u.id)
    const makePrimary = c.primary || mine.length === 0
    if (makePrimary) mine.forEach((x) => { x.primary = false })
    if (c.id) {
      const x = d.emergency_contacts.find((y) => y.id === c.id && y.userId === u.id)
      if (x) Object.assign(x, { name: c.name.trim(), phone: c.phone.trim(), relationship: c.relationship, primary: makePrimary ? true : x.primary })
    } else d.emergency_contacts.push({ id: uid('ec_'), userId: u.id, name: c.name.trim(), phone: c.phone.trim(), relationship: c.relationship, primary: makePrimary })
  })
}
export async function deleteContact(id: string) {
  const u = requireRole('patient')
  await latency()
  db.write(['emergency_contacts'], (d) => {
    const wasPrimary = d.emergency_contacts.find((x) => x.id === id && x.userId === u.id)?.primary
    d.emergency_contacts = d.emergency_contacts.filter((x) => !(x.id === id && x.userId === u.id))
    if (wasPrimary) { const first = d.emergency_contacts.find((x) => x.userId === u.id); if (first) first.primary = true }
  })
}

export function myEvents(): HealthEvent[] {
  const u = requireRole('patient')
  return db.select('health_events').filter((e) => e.userId === u.id)
}
export async function addEvent(e: Omit<HealthEvent, 'id' | 'userId'>) {
  const u = requireRole('patient')
  await latency()
  if (!e.title.trim()) throw new AppError('validation', 'Give the entry a title.')
  db.write(['health_events'], (d) => d.health_events.push({ ...e, title: e.title.trim(), id: uid('he_'), userId: u.id }))
}
export async function deleteEvent(id: string) {
  const u = requireRole('patient')
  await latency(150)
  db.write(['health_events'], (d) => { d.health_events = d.health_events.filter((x) => !(x.id === id && x.userId === u.id)) })
}
