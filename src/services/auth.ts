import { db } from '../lib/store'
import { hashPassword, secureToken, uid } from '../lib/ids'
import type { PublicUser, Role } from '../types'
import { AppError, currentUser, latency, setSession, toPublic } from './core'
import { notify } from './notifications'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.'
  return null
}

async function matches(stored: string, password: string, email: string) {
  if (stored === 'locked') return false
  if (stored.startsWith('plain:')) return stored.slice(6) === password
  return stored === (await hashPassword(password, email))
}

export async function signIn(email: string, password: string): Promise<PublicUser> {
  await latency(380)
  const e = email.trim().toLowerCase()
  const u = db.select('users').find((x) => x.email === e)
  if (!u || !(await matches(u.passwordHash, password, e))) throw new AppError('invalid', 'That email and password do not match. Check them and try again.')
  if (u.passwordHash.startsWith('plain:')) {
    const h = await hashPassword(password, e)
    db.write(['users'], (d) => { const x = d.users.find((y) => y.id === u.id); if (x) x.passwordHash = h })
  }
  setSession({ userId: u.id, createdAt: new Date().toISOString() })
  return toPublic(u)
}

export async function signUp(input: { name: string; email: string; password: string; role: Exclude<Role, 'admin'>; phone?: string }): Promise<PublicUser> {
  await latency(450)
  const email = input.email.trim().toLowerCase()
  if (!input.name.trim()) throw new AppError('validation', 'Enter your name.')
  if (!emailRe.test(email)) throw new AppError('validation', 'Enter a valid email address.')
  const pwErr = validatePassword(input.password)
  if (pwErr) throw new AppError('validation', pwErr)
  if (db.select('users').some((u) => u.email === email)) throw new AppError('exists', 'An account with this email already exists. Sign in instead.')
  const id = uid('u_')
  const passwordHash = await hashPassword(input.password, email)
  const now = new Date().toISOString()
  db.write(['users', 'patient_profiles', 'health_profiles'], (d) => {
    d.users.push({ id, email, passwordHash, role: input.role, name: input.name.trim(), phone: input.phone, createdAt: now })
    if (input.role === 'patient') {
      d.patient_profiles.push({ userId: id, onboarded: false })
      d.health_profiles.push({ userId: id, bloodGroup: '', genotype: '', allergies: [], conditions: [], medications: [], notes: '', updatedAt: now })
    }
  })
  setSession({ userId: id, createdAt: now })
  notify(id, 'system', 'Welcome to Medic Hub', input.role === 'hospital' ? 'Set up your facility to start receiving bookings.' : 'Add your health details so they are ready when you need them.', input.role === 'hospital' ? '/hospital/onboarding' : '/app/health')
  return toPublic(db.select('users').find((u) => u.id === id)!)
}

export function signOut() { setSession(null) }

/** Creates a single-use reset token (valid 30 minutes). In production Supabase Auth emails this link. */
export async function requestPasswordReset(email: string): Promise<{ token: string | null }> {
  await latency(400)
  const e = email.trim().toLowerCase()
  if (!emailRe.test(e)) throw new AppError('validation', 'Enter a valid email address.')
  const u = db.select('users').find((x) => x.email === e && x.passwordHash !== 'locked')
  if (!u) return { token: null } // Do not reveal whether an account exists
  const token = secureToken()
  db.write(['password_resets'], (d) => {
    d.password_resets = d.password_resets.filter((r) => r.userId !== u.id)
    d.password_resets.push({ token, userId: u.id, expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), used: false })
  })
  return { token }
}

export async function resetPassword(token: string, password: string) {
  await latency(400)
  const r = db.select('password_resets').find((x) => x.token === token)
  if (!r || r.used || new Date(r.expiresAt) < new Date()) throw new AppError('expired', 'This reset link has expired or was already used. Request a new one.')
  const pwErr = validatePassword(password)
  if (pwErr) throw new AppError('validation', pwErr)
  const u = db.select('users').find((x) => x.id === r.userId)!
  const h = await hashPassword(password, u.email)
  db.write(['users', 'password_resets'], (d) => {
    d.users.find((x) => x.id === u.id)!.passwordHash = h
    d.password_resets.find((x) => x.token === token)!.used = true
  })
  notify(u.id, 'profile', 'Password changed', 'Your Medic Hub password was reset. If this was not you, contact support.')
}

export async function updateAccount(patch: { name?: string; phone?: string }) {
  await latency()
  const u = currentUser()
  if (!u) throw new AppError('auth', 'Please sign in.')
  db.write(['users'], (d) => { const x = d.users.find((y) => y.id === u.id)!; if (patch.name) x.name = patch.name.trim(); x.phone = patch.phone })
  notify(u.id, 'profile', 'Your profile was updated', 'Your account details were saved.')
}
