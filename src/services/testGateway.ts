// Test payment gateway for the offline demo build. It behaves like Paystack's test mode:
// no real money moves, and every screen says so.
import type { PayGateway } from './core'
import { AppError } from './core'

export const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' }, { code: '023', name: 'Citibank Nigeria' }, { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' }, { code: '011', name: 'First Bank of Nigeria' }, { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' }, { code: '030', name: 'Heritage Bank' }, { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' }, { code: '50211', name: 'Kuda Bank' }, { code: '50515', name: 'Moniepoint MFB' },
  { code: '999992', name: 'OPay Digital Services (OPay)' }, { code: '999991', name: 'PalmPay' }, { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' }, { code: '221', name: 'Stanbic IBTC Bank' }, { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' }, { code: '100', name: 'Suntrust Bank' }, { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' }, { code: '215', name: 'Unity Bank' }, { code: '035', name: 'Wema Bank' }, { code: '057', name: 'Zenith Bank' },
]

const KEY = 'medichub.testpay'
type Tx = { reference: string; amountKobo: number; status: 'pending' | 'success' | 'failed'; paidAt?: string; refunded?: boolean; hospital: string; email: string }
const load = (): Record<string, Tx> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }
const save = (m: Record<string, Tx>) => { try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* ignore */ } }

export function testTransaction(reference: string): Tx | null { return load()[reference] ?? null }
export function completeTestPayment(reference: string, success: boolean) {
  const m = load(); const t = m[reference]; if (!t) return
  t.status = success ? 'success' : 'failed'; if (success) t.paidAt = new Date().toISOString(); save(m)
}

export const testGateway: PayGateway = {
  mode: 'test',
  provider: 'test',
  async listBanks() { return NIGERIAN_BANKS },
  async resolveAccount(accountNumber, bankCode) {
    if (!/^\d{10}$/.test(accountNumber)) throw new AppError('validation', 'Enter the 10-digit account number (NUBAN).')
    const bank = NIGERIAN_BANKS.find((b) => b.code === bankCode)
    if (!bank) throw new AppError('validation', 'Choose your bank.')
    if (accountNumber === '0000000000') throw new AppError('not_found', 'We could not find that account. Check the number and bank.')
    return { accountName: `TEST ACCOUNT ${accountNumber.slice(-4)}` }
  },
  async createSubaccount() { return { subaccountCode: 'ACCT_test' + Math.random().toString(36).slice(2, 10) } },
  async initialize({ reference, amountKobo, email, metadata }) {
    const m = load(); m[reference] = { reference, amountKobo, status: 'pending', hospital: metadata.hospital ?? '', email }; save(m)
    return { authorizationUrl: `#/pay/test/${encodeURIComponent(reference)}` }
  },
  async verify(reference) {
    const t = load()[reference]
    if (!t) return { status: 'failed', amountKobo: 0, currency: 'NGN', gatewayResponse: 'Transaction not found' }
    return { status: t.status === 'pending' ? 'pending' : t.status, amountKobo: t.amountKobo, currency: 'NGN', paidAt: t.paidAt, channel: 'card', gatewayResponse: t.status === 'success' ? 'Approved (test)' : 'Declined (test)' }
  },
  async refund(reference) { const m = load(); if (m[reference]) { m[reference].refunded = true; save(m) } },
  simulator: { complete: (reference, success) => completeTestPayment(reference, success) },
}
