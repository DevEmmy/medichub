import { rpc } from '../lib/rpc'
import { IS_BROWSER } from '../config'
import { db } from '../lib/store'
import { hashPasswordStrong, secureToken, uid, verifyPassword } from '../lib/ids'
import type { PublicUser, Role } from '../types'
import { AppError, ENUMS, currentUser, endSession, latency, mailer, oneOf, setSession, text, toPublic } from './core'
import { notify } from './notifications'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.'
  return null
}

const matches = (stored: string, password: string, email: string) => verifyPassword(stored, password, email)

export const signIn = rpc('auth.signIn', async function signIn(email: string, password: string): Promise<PublicUser> {
  text(email, 200, 'your email', true); text(password, 200, 'your password', true)
  await latency(380)
  const e = email.trim().toLowerCase()
  const u = db.select('users').find((x) => x.email === e)
  if (!u || !(await matches(u.passwordHash, password, e))) throw new AppError('invalid', 'That email and password do not match. Check them and try again.')
  if (!u.passwordHash.startsWith('pbkdf2$')) {
    const h = await hashPasswordStrong(password)
    db.write(['users'], (d) => { const x = d.users.find((y) => y.id === u.id); if (x) x.passwordHash = h })
  }
  setSession({ userId: u.id, createdAt: new Date().toISOString() })
  return toPublic(u)
})

export const signUp = rpc('auth.signUp', async function signUp(input: { name: string; email: string; password: string; role: Exclude<Role, 'admin'>; phone?: string }): Promise<PublicUser> {
  await latency(450)
  oneOf(input?.role, ENUMS.signupRole, 'account type'); text(input.name, 120, 'your name', true); text(input.email, 200, 'an email', true); text(input.phone, 40, 'a phone number')
  const email = input.email.trim().toLowerCase()
  if (!input.name.trim()) throw new AppError('validation', 'Enter your name.')
  if (!emailRe.test(email)) throw new AppError('validation', 'Enter a valid email address.')
  const pwErr = validatePassword(input.password)
  if (pwErr) throw new AppError('validation', pwErr)
  if (db.select('users').some((u) => u.email === email)) throw new AppError('exists', 'An account with this email already exists. Sign in instead.')
  const id = uid('u_')
  const passwordHash = await hashPasswordStrong(input.password)
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
})

export function signOut() { endSession() }

/** Creates a single-use reset token (valid 30 minutes). In production Supabase Auth emails this link. */
export const requestPasswordReset = rpc('auth.requestPasswordReset', async function requestPasswordReset(email: string): Promise<{ token: string | null }> {
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
  if (mailer.enabled) {
    await mailer.send({ to: u.email, subject: 'Reset your Medic Hub password', text: `Hello ${u.name},\n\nUse this link to set a new password. It works once and expires in 30 minutes:\n${mailer.appUrl}#/reset-password/${token}\n\nIf you didn't ask for this, ignore this email.\n\nMedic Hub` })
    return { token: null }
  }
  // Never hand the reset link to the browser when running as a real server
  if (!IS_BROWSER) { console.warn('[auth] password reset requested but email is not configured (set RESEND_API_KEY and MAIL_FROM)'); return { token: null } }
  return { token }
})

export const resetPassword = rpc('auth.resetPassword', async function resetPassword(token: string, password: string) {
  await latency(400)
  const r = db.select('password_resets').find((x) => x.token === token)
  if (!r || r.used || new Date(r.expiresAt) < new Date()) throw new AppError('expired', 'This reset link has expired or was already used. Request a new one.')
  const pwErr = validatePassword(password)
  if (pwErr) throw new AppError('validation', pwErr)
  const u = db.select('users').find((x) => x.id === r.userId)!
  const h = await hashPasswordStrong(password)
  db.write(['users', 'password_resets'], (d) => {
    d.users.find((x) => x.id === u.id)!.passwordHash = h
    d.password_resets.find((x) => x.token === token)!.used = true
  })
  notify(u.id, 'profile', 'Password changed', 'Your Medic Hub password was reset. If this was not you, contact support.')
})

export const updateAccount = rpc('auth.updateAccount', async function updateAccount(patch: { name?: string; phone?: string }) {
  text(patch?.name, 120, 'your name'); text(patch.phone, 40, 'a phone number')
  await latency()
  const u = currentUser()
  if (!u) throw new AppError('auth', 'Please sign in.')
  db.write(['users'], (d) => { const x = d.users.find((y) => y.id === u.id)!; if (patch.name) x.name = patch.name.trim(); x.phone = patch.phone })
  notify(u.id, 'profile', 'Your profile was updated', 'Your account details were saved.')
})
