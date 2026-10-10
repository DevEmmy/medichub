// Demo build: book a priced service with a chosen doctor, pay on the simulator, then see it on the doctor's dashboard.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:4173/'
const OUT = process.env.OUT ?? '.'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1 } else console.log('ok -', m) }
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
await p.goto(BASE + '#/login'); await p.waitForTimeout(800)
await p.getByRole('button', { name: /Patient/ }).click(); await p.waitForURL(/#\/app/); await p.waitForTimeout(500)
await p.goto(BASE + '#/hospitals/h_lagooncrest'); await p.waitForTimeout(1200)
const prices = await p.locator('[data-testid=service-price]').allInnerTexts()
ok(prices.length > 3 && prices.some((x) => x.startsWith('₦')), `price list on profile: ${prices.slice(0, 4).join(', ')}`)
await p.locator('#svc-h').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/prices.png` })
await p.getByRole('button', { name: 'Book', exact: true }).first().click(); await p.waitForTimeout(600)
// date then time
await p.locator('[role=dialog] button:not([disabled])').filter({ hasText: /^(Today|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/ }).nth(1).click(); await p.waitForTimeout(400)
await p.locator('[role=dialog] button:not([disabled])').filter({ hasText: /place/ }).first().click()
await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(500)
const opts = await p.locator('[data-testid=doctor-select] option').allInnerTexts()
ok(opts.length >= 2, `doctor choices: ${opts.join(' | ')}`)
await p.locator('[data-testid=doctor-select]').selectOption({ label: opts.find((o) => o.startsWith('Dr. Adaeze Nwosu')) })
await p.screenshot({ path: `${OUT}/review.png` })
await p.getByTestId('pay-and-book').click(); await p.waitForURL(/pay\/test/); await p.waitForTimeout(800)
await p.screenshot({ path: `${OUT}/checkout.png` })
await p.getByTestId('test-pay').click(); await p.waitForURL(/payment\/verify|app\/bookings/, { timeout: 15000 }); await p.waitForTimeout(2500)
const body = await p.locator('main').innerText()
ok(/confirmed|paid/i.test(body), 'payment confirms the booking')
await p.screenshot({ path: `${OUT}/paid.png` })
// doctor
await ctx.clearCookies()
await p.evaluate(() => { localStorage.removeItem('medichub.session'); })
await p.goto(BASE + '#/login'); await p.waitForTimeout(600)
const um = p.getByRole('button', { name: /Doctor/ })
if (!(await um.count())) { console.log('signed in still; signing out via storage'); }
await um.first().click().catch(() => {})
await p.waitForURL(/#\/doctor/, { timeout: 8000 }).catch(() => {})
await p.waitForTimeout(1000)
const doc = await p.locator('main').innerText()
ok(/Upcoming patients/.test(doc) && /Amaka Okafor/.test(doc), 'doctor dashboard lists the patient')
ok(/New patient for you|You will be with/.test(doc), 'doctor sees the new-patient message')
await p.screenshot({ path: `${OUT}/doctor.png`, fullPage: false })
await b.close()
