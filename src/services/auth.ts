import { rpc } from '../lib/rpc'
import { IS_BROWSER } from '../config'
import { db } from '../lib/store'
import { hashPasswordStrong, secureToken, uid, verifyPassword } from '../lib/ids'
import type { PublicUser, Role } from '../types'
import { AppError, ENUMS, currentUser, endSession, latency, mailer, oneOf, setSession, text, toPublic } from './core'
import { notify } from './notifications'
import { brandEmail } from '../lib/emailTemplate'
import type { User } from '../types'

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
  if (!u || !(await matches(u.passwordHash, password, e))) throw new AppError('invalid', 'We couldn\'t sign you in with that email and password. Check both, or create an account if you haven\'t yet.')
  if (!u.passwordHash.startsWith('pbkdf2$')) {
    const h = await hashPasswordStrong(password)
    db.write(['users'], (d) => { const x = d.users.find((y) => y.id === u.id); if (x) x.passwordHash = h })
  }
  setSession({ userId: u.id, createdAt: new Date().toISOString() })
  return toPublic(u)
})

export const signUp = rpc('auth.signUp', async function signUp(input: { name: string; email: string; password: string; role: Exclude<Role, 'admin'>; phone?: string }): Promise<PublicUser & { demoVerifyToken?: string }> {
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
  const created = db.select('users').find((u) => u.id === id)!
  const verifyToken = await sendWelcome(created)
  notify(id, 'system', 'Welcome to Medic Hub', input.role === 'hospital' ? 'Set up your facility to start receiving bookings.' : 'Add your health details so they are ready when you need them.', input.role === 'hospital' ? '/hospital/onboarding' : '/app/health')
  // The demo has no email provider, so it hands the confirmation link back to show on screen
  return { ...toPublic(created), ...(verifyToken ? { demoVerifyToken: verifyToken } : {}) }
})

// ---------------------------------------------------------------- email confirmation

const VERIFY_HOURS = 48
const link = (path: string) => `${mailer.appUrl || (IS_BROWSER ? location.origin + location.pathname : '')}#${path}`

function newVerification(userId: string): string {
  const token = secureToken()
  db.write(['email_verifications'], (d) => {
    d.email_verifications = d.email_verifications.filter((r) => r.userId !== userId)
    d.email_verifications.push({ token, userId, expiresAt: new Date(Date.now() + VERIFY_HOURS * 3600000).toISOString(), used: false })
  })
  return token
}

/** Welcome email with a confirm-your-email button. Returns the token only when there is no email provider (demo). */
async function sendWelcome(u: User, strict = false): Promise<string | null> {
  const token = newVerification(u.id)
  const hospital = u.role === 'hospital'
  if (!mailer.enabled) return IS_BROWSER ? token : null
  const { text: body, html } = brandEmail({
    heading: `Welcome to Medic Hub, ${u.name.split(' ')[0]}`,
    lines: [
      'Your account was created successfully.',
      hospital ? 'Next, finish setting up your facility so our team can verify it and patients can find you.' : 'You can now find hospitals near you, see who has space right now, book appointments and keep your health details ready for emergencies.',
      `Please confirm this is your email address. The link works for ${VERIFY_HOURS} hours.`,
    ],
    cta: { label: 'Confirm my email', url: link(`/verify-email/${token}`) },
    after: [`You'll sign in with ${u.email} and the password you chose.`],
    footer: "If you didn't create a Medic Hub account, ignore this email and nothing will happen.",
  })
  try { await mailer.send({ to: u.email, subject: 'Welcome to Medic Hub: confirm your email', text: body, html }) }
  catch (e) {
    console.error('[auth] welcome email failed', e)
    if (strict) throw new AppError('unavailable', 'We could not send the email right now. Try again in a few minutes.')
  }
  return null
}

export const verifyEmail = rpc('auth.verifyEmail', async function verifyEmail(token: string): Promise<{ email: string; name: string }> {
  text(token, 200, 'a link', true)
  await latency(300)
  const r = db.select('email_verifications').find((x) => x.token === token)
  if (!r || r.used) throw new AppError('expired', 'This confirmation link was already used or is not valid. Sign in and ask for a new one.')
  if (new Date(r.expiresAt) < new Date()) throw new AppError('expired', 'This confirmation link has expired. Sign in and ask for a new one.')
  const u = db.select('users').find((x) => x.id === r.userId)
  if (!u) throw new AppError('not_found', 'This account no longer exists.')
  db.write(['users', 'email_verifications'], (d) => {
    d.users.find((x) => x.id === u.id)!.emailVerifiedAt = new Date().toISOString()
    d.email_verifications.find((x) => x.token === token)!.used = true
  })
  notify(u.id, 'profile', 'Email confirmed', `Thanks, ${u.email} is confirmed.`)
  return { email: u.email, name: u.name }
})

const resendAt = new Map<string, number>()
export const resendVerification = rpc('auth.resendVerification', async function resendVerification(): Promise<{ demoVerifyToken?: string }> {
  const u = currentUser()
  if (!u) throw new AppError('auth', 'Please sign in.')
  if (u.emailVerifiedAt) return {}
  const last = resendAt.get(u.id) ?? 0
  if (Date.now() - last < 60_000) throw new AppError('rate_limited', 'We just sent one. Wait a minute, and check your spam folder.')
  // Be honest when a real server has no email provider: never say "sent" if nothing was sent
  if (!IS_BROWSER && !mailer.enabled) { console.warn('[auth] confirmation email requested but email is not configured (set BREVO_API_KEY + MAIL_FROM)'); throw new AppError('unavailable', 'Confirmation emails are not switched on for this site yet. Please try again later.') }
  resendAt.set(u.id, Date.now())
  const t = await sendWelcome(u, true)
  return t ? { demoVerifyToken: t } : {}
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
    const { text: body, html } = brandEmail({
      heading: 'Reset your password',
      lines: [`Hello ${u.name.split(' ')[0]},`, 'Someone (hopefully you) asked to reset the password for your Medic Hub account. The button below works once and expires in 30 minutes.'],
      cta: { label: 'Choose a new password', url: link(`/reset-password/${token}`) },
      footer: "If you didn't ask for this, ignore this email. Your password stays the same.",
    })
    try { await mailer.send({ to: u.email, subject: 'Reset your Medic Hub password', text: body, html }) }
    catch (e) { console.error('[auth] reset email failed', e); throw new AppError('unavailable', 'We could not send the email right now. Try again in a few minutes.') }
    return { token: null }
  }
  // Never hand the reset link to the browser when running as a real server
  if (!IS_BROWSER) { console.warn('[auth] password reset requested but email is not configured (set BREVO_API_KEY + MAIL_FROM)'); throw new AppError('unavailable', 'Password reset emails are not switched on for this site yet. Please contact support.') }
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
