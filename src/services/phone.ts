// Medic Hub for any phone: a USSD menu (dial a code, pick numbers) and SMS commands.
// Works on basic phones with no data. The same functions run behind Africa's Talking webhooks
// on the server (/api/ussd, /api/sms/incoming) and behind the in-app phone simulator.
import { rpc } from '../lib/rpc'
import { db } from '../lib/store'
import { uid } from '../lib/ids'
import { BACKEND, IS_BROWSER } from '../config'
import type { Booking, Hospital, Slot, User } from '../types'
import { AppError, currentUser, text as textArg } from './core'
import { cancelAsPatient, placeBooking } from './bookings'
import { EMERGENCY_GUIDES } from '../data/firstAid'
import { fmtTime, nowHHMM, today, addDays } from '../utils/date'
import { hoursSince, lastUpdate, STALE_HOURS } from '../utils/freshness'

const MAX = 182 // longest USSD screen networks accept
const BOOK_DAYS = 14

// ------------------------------------------------------------------ helpers

export function normPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '')
  if (d.startsWith('234')) return '+' + d
  if (d.length === 11 && d.startsWith('0')) return '+234' + d.slice(1)
  if (d.length === 10) return '+234' + d
  return d ? '+' + d : ''
}
export const localPhone = (p: string) => { const n = normPhone(p); return n.startsWith('+234') ? '0' + n.slice(4) : n }

const day = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
const when = (s: Pick<Slot, 'date' | 'time'>) => `${day(s.date)} ${fmtTime(s.time)}`
const short = (name: string, n = 26) => (name.length > n ? name.slice(0, n - 1).trimEnd() + '.' : name)

/** A screen that never exceeds what a phone can show: list items are dropped from the end until it fits. */
function screen(kind: 'CON' | 'END', head: string[], items: string[] = [], tail: string[] = []): string {
  const build = (n: number) => [kind + ' ' + head.join('\n'), ...items.slice(0, n), ...tail].join('\n')
  let n = items.length
  while (n > 0 && build(n).length > MAX) n--
  let out = build(n)
  if (out.length > MAX) out = out.slice(0, MAX - 1) + '.'
  return out
}

const listed = () => db.select('hospitals').filter((h) => h.verification === 'verified' || h.publicRecord)
const states = (hs: Hospital[]) => [...new Set(hs.map((h) => h.state))].sort()

/** Short codes for SMS, e.g. "University College Hospital" → UCH. Stable and unique. */
export function hospitalCodes(): Map<string, Hospital> {
  const skip = new Set(['of', 'the', 'and', 'for', '&'])
  const out = new Map<string, Hospital>()
  for (const h of [...listed()].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = h.name.split(/[\s,()-]+/).filter((w) => w && !skip.has(w.toLowerCase())).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'H'
    let code = base; let i = 2
    while (out.has(code)) code = base + i++
    out.set(code, h)
  }
  return out
}
const codeOf = (h: Hospital) => { for (const [c, x] of hospitalCodes()) if (x.id === h.id) return c; return '' }

function erStatus(h: Hospital): { label: string; rank: number } {
  const st = db.select('hospital_status').find((s) => s.hospitalId === h.id)
  const cap = db.select('hospital_capacity').find((c) => c.hospitalId === h.id)
  if (!st || !cap) return { label: 'NOT REPORTED', rank: 3 }
  const stale = hoursSince(lastUpdate({ status: st, capacity: cap })) >= STALE_HOURS
  const base = { open: 'OPEN', busy: 'BUSY', closed: 'CLOSED' }[st.emergency]
  if (h.publicRecord) return { label: 'not reported, call first', rank: 3 }
  return { label: stale ? `${base}? not updated` : base, rank: (st.emergency === 'open' ? 0 : st.emergency === 'busy' ? 1 : 4) + (stale ? 2 : 0) }
}
function emergencyUnits(state: string): Hospital[] {
  return listed().filter((h) => h.state === state && (h.specialties.includes('Emergency medicine') || h.facilities.some((f) => /emergency/i.test(f))))
    .sort((a, b) => erStatus(a).rank - erStatus(b).rank || a.name.localeCompare(b.name))
}
const erStates = () => states(listed().filter((h) => h.specialties.includes('Emergency medicine') || h.facilities.some((f) => /emergency/i.test(f))))

function freeSlots(hospitalId: string, serviceId?: string, limit = 5): Slot[] {
  const t = today(); const now = nowHHMM(); const end = addDays(t, BOOK_DAYS)
  return db.select('hospital_slots')
    .filter((s) => s.hospitalId === hospitalId && (!serviceId || s.serviceId === serviceId) && s.booked < s.capacity && (s.date > t || (s.date === t && s.time > now)) && s.date <= end)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, limit)
}
const bookableServices = (hospitalId: string) => db.select('hospital_services').filter((s) => s.hospitalId === hospitalId && s.bookable && s.active !== false && freeSlots(hospitalId, s.id, 1).length)
const bookable = (state: string) => listed().filter((h) => h.state === state && !h.publicRecord && h.verification === 'verified' && bookableServices(h.id).length)
const bookStates = () => states(listed().filter((h) => !h.publicRecord && h.verification === 'verified' && bookableServices(h.id).length))

export function phoneUser(phone: string): User | undefined {
  return db.select('users').find((u) => u.role === 'patient' && u.phone && normPhone(u.phone) === phone)
}
function createPhoneUser(phone: string, name: string): User {
  const id = uid('u_'); const now = new Date().toISOString()
  const u: User = { id, email: `${phone.replace(/\D/g, '')}@phone.medichub.ng`, passwordHash: 'locked', role: 'patient', name, phone, viaPhone: true, createdAt: now }
  db.write(['users', 'patient_profiles', 'health_profiles'], (d) => {
    d.users.push(u)
    d.patient_profiles.push({ userId: id, onboarded: false })
    d.health_profiles.push({ userId: id, bloodGroup: '', genotype: '', allergies: [], conditions: [], medications: [], notes: '', updatedAt: now })
  })
  return u
}
const validName = (n: string) => /^[\p{L}][\p{L} .'-]{1,58}$/u.test(n.trim())

function upcoming(u: User): Booking[] {
  const t = today()
  return db.select('bookings').filter((b) => b.patientId === u.id && b.date >= t && ['awaiting_payment', 'pending', 'confirmed'].includes(b.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
const hName = (id: string) => db.select('hospitals').find((h) => h.id === id)?.name ?? 'Hospital'
const sName = (id: string) => db.select('hospital_services').find((s) => s.id === id)?.name ?? 'Appointment'
const naira = (n: number) => '₦' + n.toLocaleString('en-NG')

function bookedSms(b: Booking): string {
  const h = db.select('hospitals').find((x) => x.id === b.hospitalId)!
  return `Medic Hub: Booked! Ref ${b.ref}. ${sName(b.serviceId)} at ${h.name}, ${h.address}. ${when(b)}.${b.amount ? ` Fee ${naira(b.amount)}, pay at the hospital.` : ''}${b.status === 'pending' ? ' The hospital will confirm by SMS.' : ''} Show this SMS at the front desk.${h.phone ? ` Hospital: ${localPhone(h.phone)}.` : ''} To cancel, text CANCEL ${b.ref}`
}
function erSms(state: string): string {
  const list = emergencyUnits(state).slice(0, 6)
  if (!list.length) return `Medic Hub: no emergency units listed in ${state} yet. Go to the nearest general hospital.`
  return `Medic Hub emergency units in ${state}: ` + list.map((h, i) => `${i + 1}) ${h.name} - ${erStatus(h).label}${h.emergencyPhone || h.phone ? ` - call ${localPhone(h.emergencyPhone || h.phone)}` : ''}`).join('; ') + '. Call before you travel if status is not updated.'
}

function tryBook(u: User, phone: string, slot: Slot, channel: 'ussd' | 'sms'): { ok: true; b: Booking } | { ok: false; message: string } {
  try {
    return { ok: true, b: placeBooking(u, { hospitalId: slot.hospitalId, serviceId: slot.serviceId, slotId: slot.id, phone }, channel) }
  } catch (e) {
    const next = freeSlots(slot.hospitalId, slot.serviceId, 1)[0]
    const msg = (e as Error).message
    if ((e as AppError).code === 'full' || (e as AppError).code === 'past') return { ok: false, message: `Sorry, that time just filled up.${next ? ` Next free time: ${when(next)}.` : ` No free times in the next ${BOOK_DAYS} days.`}` }
    return { ok: false, message: msg }
  }
}

// ------------------------------------------------------------------ USSD

const HOME = screen('CON', ['Medic Hub'], ['1 Emergency: open units', '2 Book appointment', '3 My bookings', '4 Cancel booking', '5 First aid'])

/**
 * Africa's Talking USSD: `text` is every answer so far joined by "*" ("" on the first screen).
 * Replies start with CON (show and wait for an answer) or END (show and close). `sms` = texts to send the caller.
 */
export async function handleUssd(input: { phone: string; text: string }): Promise<{ reply: string; sms: string[] }> {
  const phone = normPhone(input.phone)
  let parts = (input.text ?? '').split('*').map((x) => x.trim())
  const back = parts.lastIndexOf('00'); if (back >= 0) parts = parts.slice(back + 1)
  if (parts.length === 1 && parts[0] === '') parts = []
  const sms: string[] = []
  const end = (head: string[], items: string[] = [], tail: string[] = []) => ({ reply: screen('END', head, items, tail), sms })
  const con = (head: string[], items: string[] = [], tail: string[] = []) => ({ reply: screen('CON', head, items, tail), sms })
  const pick = <T,>(list: T[], v?: string): T | undefined => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= list.length ? list[n - 1] : undefined }
  const user = phoneUser(phone)
  if (!parts.length) return { reply: HOME, sms }
  const [choice, ...rest] = parts

  if (choice === '1') { // Emergency units by state
    const ss = erStates()
    if (!rest.length) return con(['Emergency units. Your state:'], ss.map((s, i) => `${i + 1} ${s}`))
    const st = pick(ss, rest[0]); if (!st) return end(['Invalid choice. Dial again.'])
    const list = emergencyUnits(st)
    sms.push(erSms(st))
    return end([`ERs in ${st}:`], list.slice(0, 4).map((h) => `${short(h.name, 22)}: ${erStatus(h).label}`), ['Numbers sent by SMS.'])
  }

  if (choice === '2') { // Book: state > hospital > service > time > (name) > confirm
    const ss = bookStates()
    if (!ss.length) return end(['No hospital takes phone bookings yet. For emergencies dial again and choose 1.'])
    if (rest.length === 0) return con(['Book. Your state:'], ss.map((s, i) => `${i + 1} ${s}`))
    const st = pick(ss, rest[0]); if (!st) return end(['Invalid choice. Dial again.'])
    const hs = bookable(st)
    if (rest.length === 1) return hs.length ? con([`Hospital in ${st}:`], hs.map((h, i) => `${i + 1} ${short(h.name)}`)) : end([`No hospital in ${st} takes phone bookings yet.`])
    const h = pick(hs, rest[1]); if (!h) return end(['Invalid choice. Dial again.'])
    const svcs = bookableServices(h.id)
    if (rest.length === 2) return con([`${short(h.name)}. Service:`], svcs.map((s, i) => `${i + 1} ${short(s.name, 24)}`))
    const svc = pick(svcs, rest[2]); if (!svc) return end(['Invalid choice. Dial again.'])
    const slots = freeSlots(h.id, svc.id, 5)
    if (!slots.length) return end([`No free times at ${short(h.name)} for ${short(svc.name, 20)} in the next ${BOOK_DAYS} days. Try another hospital.`])
    if (rest.length === 3) return con(['Free times:'], slots.map((s, i) => `${i + 1} ${when(s)} (${s.capacity - s.booked} left)`))
    const slot = pick(slots, rest[3]); if (!slot) return end(['Invalid choice. Dial again.'])
    let i = 4; let name = user?.name
    if (!user) {
      if (rest.length === 4) return con(['Enter your full name:'])
      name = rest[4]; i = 5
      if (!validName(name)) return end(['Please use letters only for your name. Dial again.'])
    }
    if (rest.length === i) return con([`${short(svc.name, 22)} at ${short(h.name, 22)}`, when(slot), svc.fee ? `Fee ${naira(svc.fee)}, pay at hospital` : 'No fee'], ['1 Confirm', '2 Cancel'])
    if (rest[i] !== '1') return end(['Not booked. Dial again any time.'])
    const u = user ?? createPhoneUser(phone, name!.trim())
    const r = tryBook(u, phone, slot, 'ussd')
    if (!r.ok) { sms.push(`Medic Hub: ${r.message} Dial again to book.`); return end([r.message, 'Dial again to book.']) }
    sms.push(bookedSms(r.b))
    return end([`Booked! Ref ${r.b.ref}`, `${when(slot)}, ${short(h.name, 30)}`, r.b.status === 'pending' ? 'Hospital will confirm by SMS.' : 'Details sent by SMS.'])
  }

  if (choice === '3') {
    const list = user ? upcoming(user) : []
    if (!list.length) return end([`No upcoming bookings for ${localPhone(phone)}.`])
    return end(['Your bookings:'], list.map((b) => `${b.ref} ${when(b)} ${short(hName(b.hospitalId), 18)} (${b.status === 'pending' ? 'awaiting' : 'confirmed'})`))
  }

  if (choice === '4') {
    const list = user ? upcoming(user) : []
    if (!list.length) return end([`No bookings to cancel for ${localPhone(phone)}.`])
    if (!rest.length) return con(['Cancel which?'], list.map((b, i) => `${i + 1} ${b.ref} ${when(b)}`))
    const b = pick(list, rest[0]); if (!b) return end(['Invalid choice. Dial again.'])
    if (rest.length === 1) return con([`Cancel ${b.ref}?`, `${when(b)}, ${short(hName(b.hospitalId))}`], ['1 Yes, cancel', '2 No'])
    if (rest[1] !== '1') return end(['Kept. Your booking is still on.'])
    await cancelAsPatient(user!, b.id, 'the patient by USSD')
    sms.push(`Medic Hub: ${b.ref} at ${hName(b.hospitalId)} on ${when(b)} is cancelled. Dial or text BOOK to make a new one.`)
    return end([`Cancelled ${b.ref}.`, 'The time is free for someone else. Thank you.'])
  }

  if (choice === '5') {
    const guides = EMERGENCY_GUIDES.slice(0, 7)
    if (!rest.length) return con(['First aid for:'], guides.map((g, i) => `${i + 1} ${short(g.title, 28)}`))
    const g = pick(guides, rest[0]); if (!g) return end(['Invalid choice. Dial again.'])
    sms.push(`Medic Hub first aid, ${g.title}: ` + g.doNow.map((s, k) => `${k + 1}) ${s}`).join(' ') + ` DON'T: ${g.dont.join(' ')} ${g.call112When}`)
    return end([`${g.title}:`, `1) ${g.doNow[0]}`], [], ['All steps sent by SMS.'])
  }

  return { reply: HOME, sms }
}

// ------------------------------------------------------------------ SMS

const lastOffer = new Map<string, { slotIds: string[]; at: number }>()

const HELP = 'Medic Hub by SMS. Text: ER <state> for open emergency units. HOSPITALS <state> for hospital codes. SLOTS <code> for free times. BOOK <number> <your name>. MY for your bookings. CANCEL <ref>. AID <bleeding|burns|choking|fits...> for first aid.'

export async function handleSms(input: { phone: string; text: string }): Promise<string> {
  const phone = normPhone(input.phone)
  const raw = (input.text ?? '').trim().replace(/\s+/g, ' ')
  const [cmdRaw, ...args] = raw.split(' ')
  const cmd = (cmdRaw || '').toUpperCase()
  const arg = args.join(' ').trim()
  const user = phoneUser(phone)
  const findState = (q: string) => { const all = states(listed()); const l = q.toLowerCase(); return all.find((s) => s.toLowerCase() === l) ?? all.find((s) => s.toLowerCase().startsWith(l)) ?? (listed().find((h) => h.city.toLowerCase() === l || h.area.toLowerCase() === l)?.state) }

  if (!cmd || ['HELP', 'HI', 'HELLO', 'MENU', 'START'].includes(cmd)) return HELP

  if (cmd === 'ER' || cmd === 'EMERGENCY') {
    const st = arg && findState(arg)
    if (!st) return `Medic Hub: which state? Text ER followed by your state, e.g. ER Oyo. States: ${erStates().join(', ')}.`
    return erSms(st)
  }

  if (cmd === 'HOSPITALS' || cmd === 'H') {
    const st = arg && findState(arg)
    if (!st) return `Medic Hub: text HOSPITALS followed by your state, e.g. HOSPITALS Lagos. States: ${bookStates().join(', ') || 'none yet'}.`
    const hs = bookable(st)
    if (!hs.length) return `Medic Hub: no hospital in ${st} takes phone bookings yet. For emergencies text ER ${st}.`
    return `Medic Hub hospitals in ${st}: ` + hs.map((h) => `${codeOf(h)} = ${h.name}`).join('; ') + '. Text SLOTS <code> for free times.'
  }

  if (cmd === 'SLOTS' || cmd === 'SPACE' || cmd === 'FREE') {
    const h = hospitalCodes().get(arg.toUpperCase())
    if (!h) return 'Medic Hub: hospital code not found. Text HOSPITALS <state> to get codes.'
    const slots = freeSlots(h.id, undefined, 6)
    if (!slots.length) return `Medic Hub: ${h.name} has no free times in the next ${BOOK_DAYS} days. Text HOSPITALS ${h.state} to try another hospital.`
    lastOffer.set(phone, { slotIds: slots.map((s) => s.id), at: Date.now() })
    return `Medic Hub free times at ${h.name}: ` + slots.map((s, i) => `${i + 1}) ${sName(s.serviceId)}, ${when(s)}`).join('; ') + `. To book, text BOOK <number>${user ? '' : ' <your name>'}, e.g. BOOK 1${user ? '' : ' Ada Obi'}.`
  }

  if (cmd === 'BOOK') {
    const [nRaw, ...nameParts] = args
    const offer = lastOffer.get(phone)
    if (!offer || Date.now() - offer.at > 60 * 60_000) return 'Medic Hub: first text SLOTS <hospital code> to see free times. Get codes with HOSPITALS <state>.'
    const slot = db.select('hospital_slots').find((s) => s.id === offer.slotIds[Number(nRaw) - 1])
    if (!slot) return `Medic Hub: choose a number from 1 to ${offer.slotIds.length}, e.g. BOOK 1.`
    let u = user
    if (!u) {
      const name = nameParts.join(' ').trim()
      if (!validName(name)) return `Medic Hub: add your full name, e.g. BOOK ${nRaw} Ada Obi.`
      u = createPhoneUser(phone, name)
    }
    const r = tryBook(u, phone, slot, 'sms')
    if (!r.ok) return `Medic Hub: ${r.message} Text SLOTS ${codeOf(db.select('hospitals').find((h) => h.id === slot.hospitalId)!)} to see times again.`
    lastOffer.delete(phone)
    return bookedSms(r.b)
  }

  if (cmd === 'MY' || cmd === 'STATUS') {
    if (cmd === 'STATUS' && arg) {
      const b = db.select('bookings').find((x) => x.ref === arg.toUpperCase() && user && x.patientId === user.id)
      return b ? `Medic Hub: ${b.ref} is ${b.status.replace('_', ' ')}. ${sName(b.serviceId)} at ${hName(b.hospitalId)}, ${when(b)}.` : 'Medic Hub: no booking with that reference for this phone number.'
    }
    const list = user ? upcoming(user) : []
    return list.length ? 'Medic Hub, your bookings: ' + list.map((b) => `${b.ref} ${when(b)} at ${hName(b.hospitalId)} (${b.status === 'pending' ? 'awaiting confirmation' : 'confirmed'})`).join('; ') : 'Medic Hub: no upcoming bookings for this number. Text HELP to book.'
  }

  if (cmd === 'CANCEL') {
    const b = user && db.select('bookings').find((x) => x.ref === arg.toUpperCase() && x.patientId === user.id)
    if (!b) return 'Medic Hub: no booking with that reference for this phone number. Text MY to see your bookings.'
    try { await cancelAsPatient(user!, b.id, 'the patient by SMS') } catch (e) { return `Medic Hub: ${(e as Error).message}` }
    return `Medic Hub: ${b.ref} at ${hName(b.hospitalId)} on ${when(b)} is cancelled.`
  }

  if (cmd === 'AID' || cmd === 'FIRSTAID') {
    const q = arg.toLowerCase()
    const g = q && EMERGENCY_GUIDES.find((x) => [x.title, x.slug, ...x.keywords].some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase())))
    if (!g) return `Medic Hub first aid: text AID followed by one of: ${EMERGENCY_GUIDES.slice(0, 8).map((x) => x.slug.split('-')[0]).join(', ')}.`
    return `Medic Hub first aid, ${g.title}: ` + g.doNow.map((s, k) => `${k + 1}) ${s}`).join(' ') + ` ${g.call112When}`
  }

  return `Medic Hub: sorry, we didn't understand "${raw.slice(0, 30)}". ${HELP}`
}

// ------------------------------------------------------------------ simulator (in the app)

export const DEMO_PHONE = '+2348035550142'

/**
 * Try the phone service from the website. On the live server it always uses YOUR phone number from your
 * account, so nobody can act for someone else's phone. Texts are shown on screen instead of being sent.
 */
export const simulatePhone = rpc('phone.simulate', async function simulatePhone(kind: 'ussd' | 'sms', input: { text: string; phone?: string }): Promise<{ reply: string; sms: string[]; phone: string }> {
  if (kind !== 'ussd' && kind !== 'sms') throw new AppError('validation', 'Invalid request.')
  textArg(input?.text ?? '', 300, 'your message')
  let phone: string
  if (IS_BROWSER && !BACKEND) phone = normPhone(input.phone || DEMO_PHONE)
  else {
    const u = currentUser()
    if (!u) throw new AppError('auth', 'Sign in to try the phone menu. It uses the phone number on your account.')
    if (!u.phone) throw new AppError('validation', 'Add your phone number in your account settings first. The phone menu works with that number.')
    phone = normPhone(u.phone)
  }
  if (kind === 'ussd') { const r = await handleUssd({ phone, text: input.text }); return { ...r, phone } }
  return { reply: await handleSms({ phone, text: input.text }), sms: [], phone }
})
