import { db } from '../lib/store'
import { rpcHooks, setToken, api, syncTables } from '../lib/rpc'
import { BACKEND, IS_BROWSER } from '../config'
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
function browserGet(): Session | null {
  if (memSession) return memSession
  const raw = read('session', SESSION_KEY) ?? read('local', LAST_KEY)
  if (!raw) return null
  try { memSession = JSON.parse(raw); return memSession } catch { return null }
}
function browserSet(s: Session | null) {
  memSession = s
  const v = s ? JSON.stringify(s) : null
  write('session', SESSION_KEY, v)
  write('local', LAST_KEY, v)
}

export interface OutgoingMail { to: string; subject: string; text: string; html?: string; replyTo?: string; fromName?: string }
/** Outgoing email. Off in the browser; the server switches it on when an email provider is configured. */
export const mailer = {
  enabled: false,
  appUrl: '',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  send: async (_m: OutgoingMail): Promise<void> => {},
}

/** Outgoing SMS. Off in the browser; the server switches it on when an SMS provider (Africa's Talking) is configured. */
export const smsGateway = {
  enabled: false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  send: async (_to: string, _message: string): Promise<void> => {},
}

/** Payment gateway. Off by default; the browser demo installs a test gateway and the server installs Paystack. */
export interface PayGateway {
  mode: 'off' | 'test' | 'live'
  provider: 'paystack' | 'test'
  listBanks(): Promise<{ code: string; name: string }[]>
  resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string }>
  createSubaccount(i: { businessName: string; bankCode: string; accountNumber: string }): Promise<{ subaccountCode: string }>
  initialize(i: { email: string; amountKobo: number; reference: string; subaccount: string; callbackUrl: string; metadata: Record<string, string> }): Promise<{ authorizationUrl: string }>
  verify(reference: string): Promise<{ status: 'success' | 'failed' | 'abandoned' | 'pending'; amountKobo: number; currency: string; paidAt?: string; channel?: string; gatewayResponse?: string }>
  refund(reference: string): Promise<void>
}
const offGateway = (): never => { throw new AppError('unavailable', 'Online payment is not set up on this server yet.') }
export const payments: { gateway: PayGateway; callbackUrl: string } = {
  gateway: { mode: 'off', provider: 'paystack', listBanks: offGateway, resolveAccount: offGateway, createSubaccount: offGateway, initialize: offGateway, verify: offGateway, refund: offGateway },
  callbackUrl: '',
}

/** The server swaps these for per-request sessions (see server/index.ts). */
export const sessionRuntime = { get: browserGet, set: browserSet }
export function getSession(): Session | null { return sessionRuntime.get() }
export function setSession(s: Session | null) { sessionRuntime.set(s) }

rpcHooks.onSession = (s) => {
  if (!s) { setToken(null); browserSet(null) } else { setToken(s.token); browserSet({ userId: s.userId, createdAt: s.createdAt }) }
}
/** Sign out everywhere this token is used. */
export function endSession() {
  if (IS_BROWSER && BACKEND) {
    const done = api('/logout', {}).catch(() => {})
    setToken(null)
    setSession(null)
    db.hydrate({ users: [], patient_profiles: [], bookings: [], booking_events: [], health_profiles: [], health_events: [], emergency_contacts: [], notifications: [], hospital_documents: [], hospital_staff: [] })
    done.finally(() => syncTables().catch(() => {}))
    return
  }
  setSession(null)
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

// ---------- Access policies (enforced on the server for every operation; reads are filtered in server/policy.ts) ----------
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

// ---------- Input validation (every API input is untrusted) ----------
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], label: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new AppError('validation', `Invalid ${label}.`)
  return v as T
}
export function num(v: unknown, min: number, max: number, label: string): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < min || n > max) throw new AppError('validation', `Invalid ${label}.`)
  return n
}
export function text(v: unknown, max: number, label: string, required = false): string {
  if (v === undefined || v === null) { if (required) throw new AppError('validation', `Enter ${label}.`); return '' }
  if (typeof v !== 'string') throw new AppError('validation', `Invalid ${label}.`)
  if (required && !v.trim()) throw new AppError('validation', `Enter ${label}.`)
  if (v.length > max) throw new AppError('validation', `${label[0].toUpperCase() + label.slice(1)} is too long.`)
  return v
}
const EM = ['open', 'busy', 'closed'] as const
const AV = ['available', 'limited', 'unavailable'] as const
export const ENUMS = {
  emergency: EM, availability: AV,
  overall: ['available', 'moderate', 'high', 'full'] as const,
  ecap: ['available', 'limited', 'full'] as const,
  resource: ['oxygen', 'pharmacy', 'laboratory', 'ambulance', 'maternity', 'theatre', 'bloodBank'] as const,
  bookingStatus: ['awaiting_payment', 'pending', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show'] as const,
  verification: ['draft', 'pending', 'under_review', 'verified', 'needs_attention', 'rejected'] as const,
  severity: ['info', 'warning', 'critical'] as const,
  automation: ['patientReminders', 'lowBedAlert', 'weeklyReport'] as const,
  signupRole: ['patient', 'hospital'] as const,
  eventType: ['appointment', 'visit', 'vaccination', 'lab', 'medication', 'profile'] as const,
}

// ---------- Network simulation ----------
export async function latency(ms = 220) {
  if (!IS_BROWSER || BACKEND) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AppError('network', 'You appear to be offline. Check your connection and try again.')
  }
  await new Promise((r) => setTimeout(r, ms * (0.6 + Math.random() * 0.8)))
}
