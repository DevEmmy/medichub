// Booking payments.
// Standard flow (Paystack split payments):
//   1. The hospital adds its settlement bank account. We confirm the account name with the bank
//      (account resolution) and register it as a Paystack subaccount, so money goes straight to the hospital.
//   2. When a patient books a paid service, the slot is held for 30 minutes as "awaiting payment".
//   3. The patient pays on Paystack's secure checkout (card, bank transfer or USSD). We never see card details.
//   4. The server verifies the transaction with Paystack (status, amount, currency, reference) before marking
//      the booking paid. Paystack's signed webhook does the same, so a closed browser can't lose a payment.
//   5. Cancelled paid bookings are refunded; unpaid holds expire and free the slot.
import { rpc } from '../lib/rpc'
import { db } from '../lib/store'
import { uid } from '../lib/ids'
import type { Booking, HospitalPayout, Payment } from '../types'
import { AppError, currentUser, latency, payments, requireHospitalStaff, requireRole, text } from './core'
import { notify } from './notifications'
import { alertTeam, emailPatient } from './team'
import { fmtDate, fmtTime } from '../utils/date'

export const HOLD_MINUTES = 30
export const naira = (n: number) => '₦' + n.toLocaleString('en-NG')

export function paymentsAvailable() { return payments.gateway.mode !== 'off' }

/** Does booking this service require online payment? */
export function requiresPayment(hospitalId: string, fee?: number) {
  const h = db.select('hospitals').find((x) => x.id === hospitalId)
  if (!(fee && fee > 0 && h?.payoutsEnabled && paymentsAvailable())) return false
  // On the server, also require an account registered with the active gateway (e.g. not a demo test account)
  const p = db.select('hospital_payouts').find((x) => x.hospitalId === hospitalId)
  return typeof window !== 'undefined' && !p ? true : !!p && p.provider === payments.gateway.provider
}

// ---------------- Hospital: settlement account ----------------
export const listBanks = rpc('payments.listBanks', async function listBanks() {
  requireRole('hospital', 'admin')
  return payments.gateway.listBanks()
})

export const verifyBankAccount = rpc('payments.verifyBankAccount', async function verifyBankAccount(hospitalId: string, bankCode: string, accountNumber: string) {
  requireHospitalStaff(hospitalId)
  text(bankCode, 20, 'your bank', true)
  if (!/^\d{10}$/.test(String(accountNumber))) throw new AppError('validation', 'Enter the 10-digit account number (NUBAN).')
  await latency(500)
  return payments.gateway.resolveAccount(accountNumber, bankCode)
})

export const savePayoutAccount = rpc('payments.savePayoutAccount', async function savePayoutAccount(hospitalId: string, bankCode: string, accountNumber: string) {
  requireHospitalStaff(hospitalId)
  text(bankCode, 20, 'your bank', true)
  if (!/^\d{10}$/.test(String(accountNumber))) throw new AppError('validation', 'Enter the 10-digit account number (NUBAN).')
  const h = db.select('hospitals').find((x) => x.id === hospitalId)!
  if (h.verification !== 'verified') throw new AppError('forbidden', 'Your hospital must be verified before it can receive payments.')
  await latency(600)
  const banks = await payments.gateway.listBanks()
  const bank = banks.find((b) => b.code === bankCode)
  if (!bank) throw new AppError('validation', 'Choose your bank.')
  const { accountName } = await payments.gateway.resolveAccount(accountNumber, bankCode)
  const { subaccountCode } = await payments.gateway.createSubaccount({ businessName: h.name, bankCode, accountNumber })
  const row: HospitalPayout = { hospitalId, bankCode, bankName: bank.name, accountLast4: accountNumber.slice(-4), accountName, subaccountCode, provider: payments.gateway.provider, verifiedAt: new Date().toISOString() }
  db.write(['hospital_payouts', 'hospitals'], (d) => {
    d.hospital_payouts = d.hospital_payouts.filter((p) => p.hospitalId !== hospitalId)
    d.hospital_payouts.push(row)
    d.hospitals.find((x) => x.id === hospitalId)!.payoutsEnabled = true
  })
  db.select('hospital_staff').filter((s) => s.hospitalId === hospitalId).forEach((s) => notify(s.userId, 'system', 'Payment account verified', `Patients can now pay online. Money settles to ${bank.name} ••••${row.accountLast4} (${accountName}).`, '/hospital/payments'))
  return { accountName, bankName: bank.name, accountLast4: row.accountLast4 }
})

export const disablePayouts = rpc('payments.disablePayouts', async function disablePayouts(hospitalId: string) {
  requireHospitalStaff(hospitalId)
  db.write(['hospitals'], (d) => { d.hospitals.find((x) => x.id === hospitalId)!.payoutsEnabled = false })
})

// ---------------- Patient: paying for a booking ----------------
export const startPayment = rpc('payments.startPayment', async function startPayment(bookingId: string) {
  const u = requireRole('patient')
  const b = db.select('bookings').find((x) => x.id === bookingId && x.patientId === u.id)
  if (!b) throw new AppError('not_found', 'Booking not found.')
  if (b.paymentStatus === 'paid') throw new AppError('conflict', 'This booking is already paid.')
  if (b.status !== 'awaiting_payment' || !b.amount) throw new AppError('invalid', 'This booking does not need payment.')
  const payout = db.select('hospital_payouts').find((p) => p.hospitalId === b.hospitalId)
  const h = db.select('hospitals').find((x) => x.id === b.hospitalId)!
  if (!payout || !h.payoutsEnabled) throw new AppError('unavailable', 'This hospital is not accepting online payments right now.')
  const reference = `MH-${b.ref.replace('MED-', '')}-${uid().slice(0, 8).toUpperCase()}`
  const amountKobo = Math.round(b.amount * 100)
  const p: Payment = { id: uid('pay_'), reference, bookingId: b.id, hospitalId: b.hospitalId, patientId: u.id, amountKobo, currency: 'NGN', status: 'initialized', provider: payments.gateway.provider, createdAt: new Date().toISOString() }
  const { authorizationUrl } = await payments.gateway.initialize({ email: u.email, amountKobo, reference, subaccount: payout.subaccountCode, callbackUrl: payments.callbackUrl, metadata: { bookingId: b.id, bookingRef: b.ref, hospital: h.name } })
  db.write(['payments', 'bookings'], (d) => {
    d.payments.push(p)
    const x = d.bookings.find((y) => y.id === b.id)!; x.paymentRef = reference
  })
  return { authorizationUrl, reference }
})

/** Confirm a payment by asking the gateway directly. Safe to call any number of times. */
export async function settleReference(reference: string): Promise<{ status: 'paid' | 'failed' | 'pending'; bookingId?: string; message?: string }> {
  const p = db.select('payments').find((x) => x.reference === reference)
  if (!p) return { status: 'failed', message: 'Payment not found.' }
  if (p.status === 'success' || p.status === 'refunded') return { status: 'paid', bookingId: p.bookingId }
  const v = await payments.gateway.verify(reference)
  // Another request (e.g. the webhook) may have settled it while we waited
  const again = db.select('payments').find((x) => x.reference === reference)!
  if (again.status === 'success' || again.status === 'refunded') return { status: 'paid', bookingId: p.bookingId }
  if (v.status === 'pending') return { status: 'pending', bookingId: p.bookingId }
  if (v.status !== 'success') {
    db.write(['payments'], (d) => { const x = d.payments.find((y) => y.id === p.id)!; x.status = v.status === 'abandoned' ? 'abandoned' : 'failed'; x.gatewayResponse = v.gatewayResponse })
    return { status: 'failed', bookingId: p.bookingId, message: v.gatewayResponse || 'The payment was not completed.' }
  }
  // Never trust the browser: the amount and currency must match what we charged.
  if (v.amountKobo !== p.amountKobo || v.currency !== 'NGN') {
    db.write(['payments'], (d) => { const x = d.payments.find((y) => y.id === p.id)!; x.status = 'failed'; x.gatewayResponse = `Amount mismatch: expected ${p.amountKobo}, got ${v.amountKobo} ${v.currency}` })
    console.error('[payments] amount mismatch', reference)
    return { status: 'failed', bookingId: p.bookingId, message: 'Payment amount did not match. Contact support.' }
  }
  const b = db.select('bookings').find((x) => x.id === p.bookingId)!
  const h = db.select('hospitals').find((x) => x.id === b.hospitalId)!
  const paidAt = v.paidAt ?? new Date().toISOString()
  const late = b.status === 'cancelled' // the hold expired before the money arrived
  let won = true
  db.write(['payments', 'bookings', 'booking_events', 'hospital_slots'], (d) => {
    const x = d.payments.find((y) => y.id === p.id)!
    if (x.status === 'success' || x.status === 'refunded') { won = false; return } // settled by a parallel request
    x.status = 'success'; x.paidAt = paidAt; x.channel = v.channel; x.gatewayResponse = v.gatewayResponse
    const bk = d.bookings.find((y) => y.id === b.id)!
    bk.paymentStatus = 'paid'; bk.paidAt = paidAt; bk.paymentRef = reference; bk.updatedAt = paidAt
    if (bk.status === 'awaiting_payment') {
      bk.status = h.autoConfirm ? 'confirmed' : 'pending'
      d.booking_events.push({ id: uid('be_'), bookingId: bk.id, status: bk.status, at: paidAt, by: 'system', note: `Paid ${naira(p.amountKobo / 100)} (${reference})` })
    }
  })
  if (!won) return { status: 'paid', bookingId: b.id }
  if (late) {
    await refundPayment(reference, 'The appointment hold expired before payment arrived.')
    return { status: 'failed', bookingId: b.id, message: 'Your payment arrived after the time slot was released, so it has been refunded. Please book again.' }
  }
  const svc = db.select('hospital_services').find((s) => s.id === b.serviceId)
  notify(b.patientId, 'booking', 'Payment received · booking confirmed', `${naira(p.amountKobo / 100)} paid for ${svc?.name ?? 'your appointment'} at ${h.name}, ${fmtDate(b.date)} at ${fmtTime(b.time)}. Ref ${b.ref}.`, `/app/bookings/${b.id}`)
  db.select('hospital_staff').filter((s) => s.hospitalId === b.hospitalId).forEach((s) => notify(s.userId, 'booking', 'New paid booking', `${b.patientName} paid ${naira(p.amountKobo / 100)} for ${svc?.name ?? 'an appointment'} on ${fmtDate(b.date)} at ${fmtTime(b.time)}.`, '/hospital/payments'))
  { const fresh = db.select('bookings').find((x) => x.id === b.id) ?? b; void alertTeam(fresh, 'paid', { amount: p.amountKobo / 100 }); void emailPatient(fresh, 'paid') }
  return { status: 'paid', bookingId: b.id }
}

export const confirmPayment = rpc('payments.confirmPayment', async function confirmPayment(reference: string) {
  text(reference, 80, 'a payment reference', true)
  const u = currentUser()
  const p = db.select('payments').find((x) => x.reference === reference)
  if (!p) throw new AppError('not_found', 'We could not find that payment.')
  if (u && u.role === 'patient' && p.patientId !== u.id) throw new AppError('forbidden', 'This payment belongs to another account.')
  await latency(400)
  return settleReference(reference)
})

export async function refundPayment(reference: string, reason: string) {
  const p = db.select('payments').find((x) => x.reference === reference && x.status === 'success')
  if (!p) return
  try { await payments.gateway.refund(reference) } catch (e) { console.error('[payments] refund failed', reference, e); return }
  const now = new Date().toISOString()
  db.write(['payments', 'bookings'], (d) => {
    const x = d.payments.find((y) => y.id === p.id)!; x.status = 'refunded'; x.refundedAt = now
    const b = d.bookings.find((y) => y.id === p.bookingId); if (b) { b.paymentStatus = 'refunded'; b.updatedAt = now }
  })
  notify(p.patientId, 'booking', 'Refund on its way', `${naira(p.amountKobo / 100)} is being refunded to your original payment method. ${reason}`, `/app/bookings/${p.bookingId}`)
}

/** Unpaid holds expire so the slot goes back to other patients. Runs on the scheduler. */
export function expireUnpaidHolds(now = Date.now()) {
  const cutoff = new Date(now - HOLD_MINUTES * 60_000).toISOString()
  const stale = db.select('bookings').filter((b) => b.status === 'awaiting_payment' && b.createdAt < cutoff)
  if (!stale.length) return 0
  const at = new Date(now).toISOString()
  db.write(['bookings', 'booking_events', 'hospital_slots', 'payments'], (d) => {
    for (const s of stale) {
      const b = d.bookings.find((y) => y.id === s.id)!
      b.status = 'cancelled'; b.paymentStatus = 'failed'; b.updatedAt = at
      d.booking_events.push({ id: uid('be_'), bookingId: b.id, status: 'cancelled', at, by: 'system', note: 'Payment not completed in time' })
      const slot = d.hospital_slots.find((y) => y.id === b.slotId); if (slot && slot.booked > 0) slot.booked--
      d.payments.filter((p) => p.bookingId === b.id && p.status === 'initialized').forEach((p) => { p.status = 'abandoned' })
    }
  })
  stale.forEach((b: Booking) => notify(b.patientId, 'booking', 'Booking released', `We didn't receive payment for ${b.ref} within ${HOLD_MINUTES} minutes, so the time slot was released. You can book again.`, '/find'))
  return stale.length
}

export function hospitalPayments(hospitalId: string) {
  requireHospitalStaff(hospitalId)
  return db.select('payments').filter((p) => p.hospitalId === hospitalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
