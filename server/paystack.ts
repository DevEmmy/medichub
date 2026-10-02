// Paystack (https://paystack.com/docs/api) — Nigeria's standard card / transfer / USSD gateway.
// The secret key stays on the server. PAYSTACK_BASE_URL can point at a mock for automated tests.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { AppError, type PayGateway } from '../src/services/core'

const BASE = (process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co').replace(/\/$/, '')
const FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 0)

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(BASE + path, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  }).catch(() => { throw new AppError('upstream', 'The payment provider could not be reached. Try again.') })
  const j = (await r.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T }
  if (!r.ok || !j.status) throw new AppError(r.status === 422 || r.status === 400 ? 'validation' : 'upstream', j.message || 'The payment provider returned an error.')
  return j.data as T
}

let bankCache: { at: number; list: { code: string; name: string }[] } | null = null

export function paystackGateway(): PayGateway {
  const live = String(process.env.PAYSTACK_SECRET_KEY).startsWith('sk_live_')
  return {
    mode: live ? 'live' : 'test',
    provider: 'paystack',
    async listBanks() {
      if (bankCache && Date.now() - bankCache.at < 86_400_000) return bankCache.list
      const d = await call<{ name: string; code: string; active: boolean; type?: string }[]>('/bank?country=nigeria&currency=NGN&perPage=200')
      const list = d.filter((b) => b.active !== false && (!b.type || b.type === 'nuban')).map((b) => ({ code: b.code, name: b.name })).sort((a, b) => a.name.localeCompare(b.name))
      bankCache = { at: Date.now(), list }
      return list
    },
    async resolveAccount(accountNumber, bankCode) {
      try {
        const d = await call<{ account_name: string }>(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`)
        return { accountName: d.account_name }
      } catch (e) { if (e instanceof AppError && e.code === 'validation') throw new AppError('not_found', 'We could not find that account. Check the number and bank.'); throw e }
    },
    async createSubaccount({ businessName, bankCode, accountNumber }) {
      const d = await call<{ subaccount_code: string }>('/subaccount', { method: 'POST', body: { business_name: businessName, settlement_bank: bankCode, account_number: accountNumber, percentage_charge: FEE_PERCENT } })
      return { subaccountCode: d.subaccount_code }
    },
    async initialize({ email, amountKobo, reference, subaccount, callbackUrl, metadata }) {
      const d = await call<{ authorization_url: string }>('/transaction/initialize', { method: 'POST', body: { email, amount: amountKobo, currency: 'NGN', reference, subaccount, bearer: 'subaccount', callback_url: callbackUrl, metadata, channels: ['card', 'bank', 'ussd', 'bank_transfer'] } })
      return { authorizationUrl: d.authorization_url }
    },
    async verify(reference) {
      const d = await call<{ status: string; amount: number; currency: string; paid_at?: string; channel?: string; gateway_response?: string }>(`/transaction/verify/${encodeURIComponent(reference)}`)
      const status = d.status === 'success' ? 'success' : d.status === 'abandoned' ? 'abandoned' : d.status === 'failed' || d.status === 'reversed' ? 'failed' : 'pending'
      return { status, amountKobo: d.amount, currency: d.currency, paidAt: d.paid_at, channel: d.channel, gatewayResponse: d.gateway_response }
    },
    async refund(reference) { await call('/refund', { method: 'POST', body: { transaction: reference } }) },
  }
}

/** Paystack signs every webhook with HMAC-SHA512 of the raw body using your secret key. */
export function validWebhookSignature(raw: Buffer, signature: string | undefined) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false
  const want = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex')
  try { return timingSafeEqual(Buffer.from(want), Buffer.from(signature)) } catch { return false }
}
