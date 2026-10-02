// Minimal stand-in for the Paystack API, for automated tests only (PAYSTACK_BASE_URL=http://localhost:8899).
import { createServer } from 'node:http'
const KEY = process.env.PAYSTACK_SECRET_KEY ?? 'sk_test_mock'
const tx = new Map(); const refunds = []; const subaccounts = []
const banks = [{ name: 'Guaranty Trust Bank', code: '058', active: true, type: 'nuban' }, { name: 'Access Bank', code: '044', active: true, type: 'nuban' }, { name: 'Zenith Bank', code: '057', active: true, type: 'nuban' }]
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  let body = ''; for await (const c of req) body += c
  const data = body ? JSON.parse(body) : {}
  if (url.pathname.startsWith('/checkout/')) {
    const [, , ref, act] = url.pathname.split('/'); const t = tx.get(ref)
    if (!t) return json(res, 404, { status: false })
    if (act === 'pay') { t.status = 'success'; t.paid_at = new Date().toISOString(); const cb = t.callback_url; res.writeHead(302, { Location: cb + (cb.includes('?') ? '&' : '?') + `trxref=${ref}&reference=${ref}` }); return res.end() }
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(`<h1>Mock Paystack checkout</h1><p>NGN ${t.amount / 100}</p><a id="pay" href="/checkout/${ref}/pay">Pay</a>`)
  }
  if (url.pathname === '/_state') return json(res, 200, { tx: [...tx.values()], refunds, subaccounts })
  if (req.headers.authorization !== `Bearer ${KEY}`) return json(res, 401, { status: false, message: 'Invalid key' })
  if (url.pathname === '/bank') return json(res, 200, { status: true, data: banks })
  if (url.pathname === '/bank/resolve') {
    const n = url.searchParams.get('account_number')
    if (n === '0000000000') return json(res, 422, { status: false, message: 'Could not resolve account name' })
    return json(res, 200, { status: true, data: { account_number: n, account_name: 'HARBOUR POINT MEDICAL CENTRE LTD' } })
  }
  if (url.pathname === '/subaccount') { const code = 'ACCT_' + Math.random().toString(36).slice(2, 10); subaccounts.push({ ...data, code }); return json(res, 200, { status: true, data: { subaccount_code: code } }) }
  if (url.pathname === '/transaction/initialize') {
    if (!data.subaccount || !data.amount || !data.reference || !data.callback_url) return json(res, 400, { status: false, message: 'missing field' })
    tx.set(data.reference, { ...data, status: 'ongoing' })
    return json(res, 200, { status: true, data: { authorization_url: `http://localhost:8899/checkout/${data.reference}`, reference: data.reference } })
  }
  if (url.pathname.startsWith('/transaction/verify/')) {
    const t = tx.get(decodeURIComponent(url.pathname.split('/').pop()))
    if (!t) return json(res, 400, { status: false, message: 'Transaction reference not found' })
    return json(res, 200, { status: true, data: { status: t.status, amount: t.amount, currency: 'NGN', paid_at: t.paid_at, channel: 'card', gateway_response: t.status === 'success' ? 'Approved' : 'Pending' } })
  }
  if (url.pathname === '/refund') { refunds.push(data.transaction); return json(res, 200, { status: true, data: { status: 'pending' } }) }
  json(res, 404, { status: false, message: 'not found' })
}).listen(8899, () => console.log('mock paystack on 8899'))
