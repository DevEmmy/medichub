// End-to-end test of the production build against the real server + PostgreSQL.
// Three separate browser contexts = three different devices (no shared storage).
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://localhost:8790/'
mkdirSync('qa/shots', { recursive: true })
writeFileSync('/tmp/doc.pdf', '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const fails = []; const errs = []
const step = async (name, fn) => { try { await fn(); console.log('OK', name) } catch (e) { fails.push(name); console.log('FAIL', name, '-', e.message.split('\n')[0]) } }
const ctx = async (geo) => { const c = await b.newContext({ timezoneId: 'Africa/Lagos', viewport: { width: 1280, height: 860 }, ...(geo ? { geolocation: geo, permissions: ['geolocation'] } : {}) }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL|youtube|wikimedia/i.test(m.text())) errs.push(m.text()) }); return p }
const shot = (p, n) => p.screenshot({ path: `qa/shots/L-${n}.png` })
const stamp = Date.now().toString(36)
const H = { email: `ops+${stamp}@harbourpoint.ng`, pw: 'Harbour2026a' }
const P = { email: `ada+${stamp}@gmail.com`, pw: 'Patient2026a' }

const h = await ctx(); const a = await ctx(); const p = await ctx({ latitude: 6.6, longitude: 3.35 })

await step('landing has no demo content', async () => {
  await p.goto(BASE); await p.waitForTimeout(800)
  const txt = await p.textContent('body')
  if (/demo/i.test(txt)) throw new Error('found "demo" on landing: ' + txt.match(/.{30}demo.{30}/i)?.[0])
  await shot(p, 'landing')
})

await step('hospital signs up', async () => {
  await h.goto(BASE + '#/signup'); await h.getByRole('radio', { name: /Hospital/ }).click()
  await h.getByLabel('Your full name').fill('Dr. Tolu Adeyemi'); await h.getByLabel('Work email').fill(H.email); await h.getByLabel('Password', { exact: true }).fill(H.pw)
  await h.getByRole('button', { name: 'Create account' }).click(); await h.waitForURL(/onboarding/, { timeout: 15000 })
})

await step('hospital completes onboarding with documents', async () => {
  await h.getByLabel('Facility name').fill('Harbour Point Medical Centre')
  await h.getByLabel('Description').fill('24-hour general and emergency care in Ikeja.')
  await h.getByLabel('Main phone').fill('+234 803 555 0100'); await h.getByLabel('Emergency unit direct line').fill('+234 803 555 0199')
  await h.getByRole('button', { name: 'Continue' }).click()
  await h.getByLabel('Street address').fill('12 Allen Avenue'); await h.getByLabel('Area').fill('Ikeja')
  await h.getByRole('button', { name: 'Continue' }).click()
  for (const s of ['Emergency medicine', 'General practice', 'Pediatrics']) await h.getByRole('button', { name: s, exact: true }).click()
  await h.getByRole('button', { name: 'Continue' }).click()
  await h.getByLabel('CAC registration number').fill('RC 1849302'); await h.getByLabel('Operating licence number').fill('HEF/LA/2024/1182'); await h.getByLabel('Licensing body').fill('HEFAMAA')
  await h.getByLabel('Number of beds').fill('40')
  await h.getByRole('button', { name: 'Continue' }).click()
  const inputs = h.locator('input[type=file]')
  for (let i = 0; i < 3; i++) await inputs.nth(0).setInputFiles({ name: `doc${i}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') })
  await h.getByRole('button', { name: 'Continue' }).click()
  await h.getByLabel('Full name').fill('Dr. Tolu Adeyemi'); await h.getByLabel('Email').fill(H.email)
  await h.getByRole('button', { name: 'Continue' }).click()
  await h.getByRole('button', { name: /Submit for verification/ }).click()
  await h.getByText('Submitted for verification').waitFor({ timeout: 15000 }); await shot(h, 'submitted')
})

await step('unverified hospital is hidden from patients', async () => {
  await p.goto(BASE + '#/find'); await p.waitForTimeout(1500)
  if (await p.getByText('Harbour Point').count()) throw new Error('visible before verification')
})

await step('reviewer signs in, opens a document, verifies', async () => {
  await a.goto(BASE + '#/login'); await a.getByLabel('Email').fill('review@medichub.ng'); await a.getByLabel('Password', { exact: true }).fill('Reviewer#2026x')
  await a.getByRole('button', { name: 'Sign in' }).click(); await a.waitForURL(/#\/admin/, { timeout: 15000 }); await a.waitForTimeout(800)
  await a.getByText('Harbour Point Medical Centre').first().click().catch(() => {})
  const link = a.getByRole('link', { name: 'Open' }).first()
  const href = await link.getAttribute('href')
  const r = await a.request.get(href.startsWith('http') ? href : BASE.replace(/\/$/, '') + href)
  if (r.status() !== 200 || !(await r.text()).startsWith('%PDF')) throw new Error('document not retrievable: ' + r.status())
  const anon = await a.request.get((href.startsWith('http') ? href : BASE.replace(/\/$/, '') + href).replace(/token=[^&]+/, 'token=x'))
  if (anon.status() !== 401) throw new Error('document leaked without auth: ' + anon.status())
  await a.getByRole('button', { name: /Verify|Approve/ }).first().click(); await a.waitForTimeout(1200); await shot(a, 'admin')
})

await step('hospital sees verified + sets live status (realtime)', async () => {
  await h.goto(BASE + '#/hospital'); await h.waitForTimeout(1500)
  await h.goto(BASE + '#/hospital/status'); await h.waitForTimeout(800); await shot(h, 'status')
})

await step('hospital adds bank account (name verified) and sets fees', async () => {
  await h.goto(BASE + '#/hospital/payments'); await h.getByTestId('payout-form').waitFor({ timeout: 10000 })
  await h.getByLabel('Bank').selectOption('058'); await h.getByLabel('Account number').fill('0000000000')
  await h.getByRole('button', { name: 'Verify account' }).click(); await h.getByText(/could not find that account/i).waitFor({ timeout: 8000 })
  await h.getByLabel('Account number').fill('0123456789')
  await h.getByRole('button', { name: 'Verify account' }).click(); await h.getByTestId('resolved-name').waitFor({ timeout: 8000 })
  await h.getByRole('button', { name: /Save and start receiving payments/ }).click()
  await h.getByText('Online payments are ON').waitFor({ timeout: 10000 }); await shot(h, 'payouts')
  await h.evaluate(async () => {
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('medichub.token') }
    const s = await (await fetch('/api/sync', { headers: H })).json()
    const hid = s.data.hospital_staff[0].hospitalId
    for (const sv of s.data.hospital_services.filter((x) => x.hospitalId === hid && x.bookable)) {
      const r = await fetch('/api/rpc/hospitals.saveService', { method: 'POST', headers: H, body: JSON.stringify({ args: [hid, { ...sv, fee: 5000 }] }) })
      if (!r.ok) throw new Error('fee ' + r.status)
    }
  })
})

await step('patient signs up and finds the hospital', async () => {
  await p.goto(BASE + '#/signup'); await p.getByRole('radio', { name: /Patient/ }).click()
  await p.getByLabel('Full name').fill('Adaeze Nwosu'); await p.getByLabel('Email').fill(P.email); await p.getByLabel('Password', { exact: true }).fill(P.pw)
  await p.getByRole('button', { name: 'Create account' }).click(); await p.waitForTimeout(2500)
  await p.goto(BASE + '#/find'); await p.getByText('Harbour Point Medical Centre').first().waitFor({ timeout: 10000 }); await shot(p, 'find')
})

let ref = ''
await step('patient books a slot and gets a QR pass', async () => {
  const hid = await p.evaluate(() => [...document.querySelectorAll('a[href*="/hospitals/"]')].find((x) => x.textContent.includes('Harbour Point'))?.getAttribute('href'))
  await p.goto(BASE + hid); await p.waitForTimeout(1200)
  await p.getByRole('button', { name: /Book a slot/ }).first().click(); await p.waitForTimeout(600)
  const svc = p.locator('[role=dialog] li button').first(); if (await svc.count()) await svc.click().catch(() => {})
  await p.waitForTimeout(400)
  const day = p.locator('[role=dialog] button:not([disabled])').filter({ hasText: /left/ }).first(); await day.click()
  await p.locator('[role=dialog] button[aria-pressed]:not([disabled])').first().click()
  await p.getByRole('button', { name: 'Continue' }).click()
  await p.getByTestId('pay-and-book').click()
  await p.waitForURL(/localhost:8899\/checkout\//, { timeout: 15000 }); await shot(p, 'paystack')
  await p.click('#pay')
  await p.locator('[data-testid=payment-verify][data-status=paid]').waitFor({ timeout: 20000 }); await shot(p, 'paid')
  await p.getByRole('link', { name: 'View my booking pass' }).click()
  await p.getByText('Booking reference').first().waitFor({ timeout: 15000 })
  await p.getByText(/Paid ₦5,000/).first().waitFor({ timeout: 8000 })
  ref = (await p.textContent('body')).match(/MED-[A-Z0-9]{6}/)[0]
  await p.waitForTimeout(1500); await shot(p, 'pass')
  const qr = p.locator('[role=img][aria-label^="QR code"]').last().locator('..')
  await qr.screenshot({ path: '/tmp/pass-qr.png' })
})

await step('hospital sees booking in realtime and checks in by scanning QR photo', async () => {
  await h.goto(BASE + '#/hospital'); await h.getByText(/New booking/).first().waitFor({ timeout: 10000 }).catch(() => {})
  await h.goto(BASE + '#/hospital/check-in'); await h.getByTestId('open-scanner').click()
  await h.getByTestId('qr-photo-input').setInputFiles('/tmp/pass-qr.png')
  await h.waitForTimeout(1500); await shot(h, 'after-scan')
  await h.getByText('Adaeze Nwosu').first().waitFor({ timeout: 8000 })
  const btn = h.getByRole('button', { name: /Confirm check-in/ })
  if (await btn.count()) await btn.click()
  await h.getByText(/Checked in/).first().waitFor({ timeout: 8000 }); await shot(h, 'checkin')
})

await step('patient rates the visit', async () => {
  await p.goto(BASE + '#/find'); await p.locator('a[href*="/hospitals/"]', { hasText: 'Harbour Point' }).first().waitFor({ timeout: 10000 })
  const hid = await p.evaluate(() => location.hash)
  const href = await p.evaluate(() => [...document.querySelectorAll('a[href*="/hospitals/"]')].find((x) => x.textContent.includes('Harbour Point'))?.getAttribute('href'))
  await p.goto(BASE + (href ?? hid));
  await p.getByTestId('rate-form').waitFor({ timeout: 10000 })
  await p.getByRole('radio', { name: '5 stars' }).click(); await p.getByRole('button', { name: 'Kind staff' }).click()
  await p.getByPlaceholder(/Anything other patients/).fill('Seen quickly, very kind nurses.')
  await p.getByRole('button', { name: 'Post rating' }).click(); await p.getByText('Seen quickly, very kind nurses.').waitFor({ timeout: 8000 }); await shot(p, 'rated')
})

await step('hospital replies to review; analytics locked on Basic, unlocked by trial', async () => {
  await h.goto(BASE + '#/hospital/reviews'); await h.getByText('Seen quickly').first().waitFor({ timeout: 10000 })
  await h.getByRole('button', { name: /Reply publicly/ }).click(); await h.locator('textarea').fill('Thank you, Adaeze!'); await h.getByRole('button', { name: 'Post reply' }).click()
  await h.goto(BASE + '#/hospital/analytics'); await h.getByText('Analytics is a Premium feature').waitFor()
  await h.goto(BASE + '#/hospital/plan'); await h.getByTestId('start-trial').click(); await h.waitForTimeout(1500)
  await h.goto(BASE + '#/hospital/analytics'); await h.waitForTimeout(800)
  if (await h.getByText('Analytics is a Premium feature').count()) throw new Error('still locked')
  await shot(h, 'analytics')
})

await step('patient emergency mode shows direct hospital line', async () => {
  await p.goto(BASE + '#/emergency'); await p.getByTestId('nearest-emergency').waitFor()
  const href = await p.getAttribute('[data-testid=call-nearest]', 'href')
  if (href !== 'tel:+2348035550199') throw new Error('wrong line ' + href)
  await shot(p, 'emergency')
})

await step('live status change reaches patient without reload', async () => {
  const hid = await p.evaluate(() => null)
  await p.goto(BASE + '#/find'); await p.waitForTimeout(800)
  const link = await p.evaluate(() => [...document.querySelectorAll('a[href*="/hospitals/"]')].find((x) => x.textContent.includes('Harbour Point'))?.getAttribute('href'))
  await p.goto(BASE + link); await p.waitForTimeout(1000)
  await h.goto(BASE + '#/hospital/status'); await h.waitForTimeout(800)
  await h.getByRole('radio', { name: /Busy/ }).first().click()
  await p.getByText(/^Busy$/).first().waitFor({ timeout: 8000 })
  void hid
})

await step('anyone scanning the pass sees it is genuine (public view)', async () => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const x = await c.newPage()
  await x.goto(BASE + '#/scan'); await x.getByTestId('qr-photo-input').setInputFiles('/tmp/pass-qr.png')
  await x.getByTestId('pass-check').waitFor({ timeout: 10000 })
  const t = await x.textContent('body')
  if (!t.includes('Genuine Medic Hub pass') || !t.includes(ref)) throw new Error('pass check failed')
  if (t.includes('Adaeze Nwosu')) throw new Error('public view leaked full name')
  await c.close()
})

await step('cancelling a paid booking refunds it; fake webhooks are rejected', async () => {
  const out = await p.evaluate(async () => {
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('medichub.token') }
    const rpc = async (n, args) => { const r = await fetch('/api/rpc/' + n, { method: 'POST', headers: H, body: JSON.stringify({ args }) }); const j = await r.json(); if (!r.ok) throw new Error(n + ': ' + j.error?.message); return j.result }
    const s = await (await fetch('/api/sync', { headers: H })).json()
    const hosp = s.data.hospitals.find((h) => h.name.includes('Harbour Point'))
    const today = new Date().toISOString().slice(0, 10)
    const slot = s.data.hospital_slots.filter((x) => x.hospitalId === hosp.id && x.date > today && x.booked < x.capacity).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[3]
    const bk = await rpc('bookings.createBooking', [{ hospitalId: hosp.id, serviceId: slot.serviceId, slotId: slot.id }])
    const { authorizationUrl, reference } = await rpc('payments.startPayment', [bk.id])
    await fetch(authorizationUrl + '/pay', { redirect: 'manual' }).catch(() => {})
    const conf = await rpc('payments.confirmPayment', [reference])
    await rpc('bookings.cancelMyBooking', [bk.id])
    const s2 = await (await fetch('/api/sync?tables=payments,bookings', { headers: H })).json()
    return { status0: bk.status, conf: conf.status, pay: s2.data.payments.find((x) => x.reference === reference)?.status, bkPay: s2.data.bookings.find((x) => x.id === bk.id)?.paymentStatus, reference }
  })
  if (out.status0 !== 'awaiting_payment' || out.conf !== 'paid' || out.pay !== 'refunded' || out.bkPay !== 'refunded') throw new Error(JSON.stringify(out))
  const st = await (await fetch('http://localhost:8899/_state')).json()
  if (!st.refunds.includes(out.reference)) throw new Error('refund not sent to Paystack')
  const bad = await fetch(BASE + 'api/paystack/webhook', { method: 'POST', headers: { 'x-paystack-signature': 'forged' }, body: JSON.stringify({ event: 'charge.success', data: { reference: out.reference } }) })
  if (bad.status !== 401) throw new Error('forged webhook accepted: ' + bad.status)
  const { createHmac } = await import('node:crypto')
  const body = JSON.stringify({ event: 'charge.success', data: { reference: out.reference } })
  const good = await fetch(BASE + 'api/paystack/webhook', { method: 'POST', headers: { 'x-paystack-signature': createHmac('sha512', 'sk_test_mock').update(body).digest('hex') }, body })
  if (good.status !== 200) throw new Error('signed webhook rejected: ' + good.status)
})

if (process.env.RESTART_CMD) {
  await step('data survives a server restart', async () => {
    const { execSync } = await import('node:child_process'); execSync(process.env.RESTART_CMD)
    for (let i = 0; i < 20; i++) { try { await fetch(BASE + 'api/health'); break } catch { await new Promise((r) => setTimeout(r, 500)) } }
    const r = await (await fetch(BASE + 'api/health')).json()
    if (r.hospitals < 1 || r.users < 3) throw new Error(JSON.stringify(r))
    await p.goto(BASE + '#/app/bookings'); await p.waitForTimeout(1500)
    if (!(await p.textContent('body')).includes(ref)) throw new Error('booking missing after restart')
    await h.goto(BASE + '#/hospital/reviews'); await h.getByText('Thank you, Adaeze!').first().waitFor({ timeout: 8000 })
  })
}
console.log('\nFAILED:', fails.length ? fails : 'none'); console.log('page errors:', errs.slice(0, 8))
await b.close()
