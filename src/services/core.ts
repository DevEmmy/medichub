import { db } from '../lib/store'
import type { PublicUser, Role, Session, User } from '../types'

export class AppError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

const SESSION_KEY = 'medichub.session'
const LAST_KEY = 'medichub.lastSession'
let memSession: Session | null = null

function read(storage: 'session' | 'local', key: string) {
  try { return (storage === 'session' ? sessionStorage : localStorage).getItem(key) } catch { return null }
}
function write(storage: 'session' | 'local', key: string, v: string | null) {
  try {
    const s = storage === 'session' ? sessionStorage : localStorage
    if (v === null) s.removeItem(key); else s.setItem(key, v)
  } catch { /* storage blocked */ }
}

/** Sessions are per tab (so a judge can be a patient in one tab and hospital staff in another) and restored from the last login in new tabs. */
export function getSession(): Session | null {
  if (memSession) return memSession
  const raw = read('session', SESSION_KEY) ?? read('local', LAST_KEY)
  if (!raw) return null
  try { memSession = JSON.parse(raw); return memSession } catch { return null }
}
export function setSession(s: Session | null) {
  memSession = s
  const v = s ? JSON.stringify(s) : null
  write('session', SESSION_KEY, v)
  write('local', LAST_KEY, v)
}

export function toPublic(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = u
  return rest
}

export function currentUser(): User | null {
  const s = getSession()
  if (!s) return null
  return db.select('users').find((u) => u.id === s.userId) ?? null
}

// ---------- Access policies (mirror of the RLS policies in supabase/schema.sql) ----------
export function requireUser(): User {
  const u = currentUser()
  if (!u) throw new AppError('auth', 'Please sign in to continue.')
  return u
}
export function requireRole(...roles: Role[]): User {
  const u = requireUser()
  if (!roles.includes(u.role)) throw new AppError('forbidden', 'You do not have access to this area.')
  return u
}
/** Hospital staff may only act on hospitals they belong to. */
export function requireHospitalStaff(hospitalId: string): User {
  const u = requireRole('hospital')
  const ok = db.select('hospital_staff').some((s) => s.userId === u.id && s.hospitalId === hospitalId)
  if (!ok) throw new AppError('forbidden', 'You can only manage your own facility.')
  return u
}
export function myHospitalId(): string | null {
  const u = currentUser()
  if (!u || u.role !== 'hospital') return null
  return db.select('hospital_staff').find((s) => s.userId === u.id)?.hospitalId ?? null
}

// ---------- Network simulation ----------
export async function latency(ms = 220) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AppError('network', 'You appear to be offline. Check your connection and try again.')
  }
  await new Promise((r) => setTimeout(r, ms * (0.6 + Math.random() * 0.8)))
}
