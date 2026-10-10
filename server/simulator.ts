// Payment simulator for demos: behaves like a payment gateway, but no real money moves.
// It is used when the server has no PAYSTACK_SECRET_KEY (turn it off with PAYMENT_SIMULATOR=0).
// Going commercial = set PAYSTACK_SECRET_KEY. Nothing else in the app changes: bookings, price checks,
// receipts and refunds all go through the same PayGateway interface.
import type { PayGateway } from '../src/services/core'
import { AppError } from '../src/services/core'
import { NIGERIAN_BANKS } from '../src/services/testGateway'

type Tx = { status: 'pending' | 'success' | 'failed'; amountKobo: number; paidAt?: string; refunded?: boolean }

export function simulatorGateway(): PayGateway {
  const txs = new Map<string, Tx>()
  return {
    mode: 'test',
    provider: 'test',
    async listBanks() { return NIGERIAN_BANKS },
    async resolveAccount(accountNumber, bankCode) {
      if (!/^\d{10}$/.test(accountNumber)) throw new AppError('validation', 'Enter the 10-digit account number (NUBAN).')
      if (!NIGERIAN_BANKS.some((b) => b.code === bankCode)) throw new AppError('validation', 'Choose your bank.')
      if (accountNumber === '0000000000') throw new AppError('not_found', 'We could not find that account. Check the number and bank.')
      return { accountName: `TEST ACCOUNT ${accountNumber.slice(-4)}` }
    },
    async createSubaccount() { return { subaccountCode: 'ACCT_sim' + Math.random().toString(36).slice(2, 10) } },
    async initialize({ reference, amountKobo }) {
      txs.set(reference, { status: 'pending', amountKobo })
      return { authorizationUrl: `#/pay/test/${encodeURIComponent(reference)}` }
    },
    async verify(reference) {
      const t = txs.get(reference)
      if (!t) return { status: 'pending', amountKobo: 0, currency: 'NGN', gatewayResponse: 'Not paid yet' }
      return { status: t.status === 'pending' ? 'pending' : t.status, amountKobo: t.amountKobo, currency: 'NGN', paidAt: t.paidAt, channel: 'card', gatewayResponse: t.status === 'success' ? 'Approved (simulated)' : 'Declined (simulated)' }
    },
    async refund(reference) { const t = txs.get(reference); if (t) t.refunded = true },
    simulator: {
      complete(reference, success, amountKobo) {
        txs.set(reference, { status: success ? 'success' : 'failed', amountKobo, paidAt: success ? new Date().toISOString() : undefined })
      },
    },
  }
}
