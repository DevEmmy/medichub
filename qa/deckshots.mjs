// Phone-size screenshots of the real app for the pitch deck.
import { chromium } from 'playwright'
const BASE = 'http://localhost:4173/'
const OUT = 'qa/deck'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const mk = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Africa/Lagos', geolocation: { latitude: 6.4474, longitude: 3.4723 }, permissions: ['geolocation'] }); await c.addInitScript(() => { const st = document.createElement('style'); st.textContent = 'div[aria-live=polite].fixed.top-0{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)) }); return c.newPage() }
const p = await mk()
const shot = async (pg, name, wait = 900) => { await pg.waitForTimeout(wait); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name) }
const tryit = async (name, fn) => { try { await fn() } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]) } }
const login = async (pg, role) => { await pg.goto(BASE + '#/login'); await pg.getByRole('button', { name: new RegExp(`^${role}$`) }).click(); await pg.waitForTimeout(1500) }

await tryit('landing', async () => { await p.goto(BASE); await shot(p, 'landing', 2000) })
await tryit('emergency', async () => { await p.goto(BASE + '#/emergency'); await p.getByText('Call the hospital directly').first().waitFor(); await shot(p, 'emergency', 1500) })
await tryit('guide', async () => { await p.goto(BASE + '#/emergency/severe-bleeding'); await shot(p, 'guide') })
await login(p, 'Patient')
await tryit('home', async () => { await p.goto(BASE + '#/app'); await shot(p, 'patient-home', 1800) })
await tryit('find', async () => { await p.goto(BASE + '#/find'); await p.waitForTimeout(800); await shot(p, 'find', 1200) })
await tryit('find-scroll', async () => { await p.mouse.wheel(0, 700); await shot(p, 'find-cards') })
await tryit('profile', async () => { await p.goto(BASE + '#/hospitals/h_lagooncrest'); await p.getByText('Live status').waitFor(); await shot(p, 'profile', 1500); await p.getByText('Live status').first().scrollIntoViewIfNeeded(); await p.mouse.wheel(0, -120); await shot(p, 'profile-status') })
await tryit('stale', async () => { await p.goto(BASE + '#/hospitals/h_luth'); await shot(p, 'profile-stale', 1500) })
await tryit('book', async () => {
  await p.goto(BASE + '#/hospitals/h_lagooncrest')
  await p.getByRole('button', { name: 'Book a slot' }).first().click()
  await p.getByRole('button', { name: /General consultation/ }).first().click()
  await p.locator('[role=dialog] button:not([disabled])').filter({ hasText: 'left' }).nth(1).click()
  await p.getByText('Choose a time').waitFor(); await shot(p, 'book-time')
  await p.locator('[role=dialog] button[aria-pressed]:not([disabled])').first().click()
  await p.getByRole('button', { name: 'Continue' }).click(); await shot(p, 'book-confirm')
  await p.getByTestId('pay-and-book').click(); await p.getByTestId('test-checkout').waitFor(); await shot(p, 'pay-checkout')
  await p.getByTestId('test-pay').click(); await p.locator('[data-testid=payment-verify][data-status=paid]').waitFor({ timeout: 15000 }); await shot(p, 'pay-done')
  await p.getByRole('link', { name: 'View my booking pass' }).click(); await p.getByText('Booking reference').waitFor(); await shot(p, 'pass', 1200)
  const qr = p.locator('[role=img][aria-label^="QR code"]').first(); await qr.scrollIntoViewIfNeeded(); await p.mouse.wheel(0, -150); await shot(p, 'pass-qr')
})
await tryit('ai', async () => {
  await p.goto(BASE + '#/assistant?q=' + encodeURIComponent('My child has a fever of 39°C. What should I do?'))
  await p.getByTestId('ai-actions').first().waitFor({ timeout: 20000 }); await p.evaluate(() => window.scrollTo(0, 0)); await shot(p, 'ai', 1200)
  await p.getByTestId('ai-actions').first().scrollIntoViewIfNeeded(); await shot(p, 'ai-actions')
})
await tryit('a11y', async () => { await p.goto(BASE + '#/emergency/severe-bleeding'); await p.getByTestId('a11y-btn').click(); await p.getByTestId('a11y-panel').waitFor(); await shot(p, 'a11y-panel') })
await tryit('reading', async () => {
  await p.keyboard.press('Escape'); await p.goto(BASE + '#/emergency/severe-bleeding'); await p.waitForTimeout(800)
  await p.evaluate(() => { const el = [...document.querySelectorAll('main li')][1]; el.classList.add('a11y-reading'); el.scrollIntoView({ block: 'center' }) })
  await shot(p, 'reading')
})
await tryit('vault', async () => { await p.goto(BASE + '#/app/health'); await shot(p, 'vault', 1200) })

const h = p; await login(h, 'Hospital')
await tryit('hdash', async () => { await h.goto(BASE + '#/hospital'); await shot(h, 'h-dashboard', 1500) })
await tryit('hstatus', async () => { await h.goto(BASE + '#/hospital/status'); await shot(h, 'h-status', 1200); await h.mouse.wheel(0, 600); await shot(h, 'h-status-2') })
await tryit('hbookings', async () => { await h.goto(BASE + '#/hospital/bookings'); await shot(h, 'h-bookings', 1200) })
await tryit('hcheckin', async () => { await h.goto(BASE + '#/hospital/check-in'); await shot(h, 'h-checkin', 1200) })
await tryit('hteam', async () => { await h.goto(BASE + '#/hospital/team'); await shot(h, 'h-team', 1200); await h.getByTestId('team-list').scrollIntoViewIfNeeded(); await h.mouse.wheel(0, -40); await shot(h, 'h-team-list'); await h.getByTestId('email-log').scrollIntoViewIfNeeded(); await h.getByTestId('email-log').locator('li button').first().click(); await h.getByTestId('email-log').scrollIntoViewIfNeeded(); await shot(h, 'h-email') })
await tryit('trial', async () => { await h.goto(BASE + '#/hospital/plan'); await h.getByRole('button', { name: /trial/i }).first().click(); await h.waitForTimeout(1200); await h.goto(BASE + '#/hospital/analytics'); await shot(h, 'h-analytics-pro', 1800) })
await tryit('email-render', async () => { const e = await (await b.newContext({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 2 })).newPage(); await e.goto('file:///tmp/email.html'); await shot(e, 'email', 500) })
await tryit('map', async () => { await p.goto(BASE + '#/find'); await p.getByRole('button', { name: /^Map$/ }).first().click(); await shot(p, 'find-map', 2500) })
await tryit('hpay', async () => { await h.goto(BASE + '#/hospital/payments'); await shot(h, 'h-payments', 1200) })
await tryit('hplan', async () => { await h.goto(BASE + '#/hospital/plan'); await shot(h, 'h-plan', 1200) })
await tryit('hreviews', async () => { await h.goto(BASE + '#/hospital/reviews'); await shot(h, 'h-reviews', 1200) })
await tryit('hanalytics', async () => { await h.goto(BASE + '#/hospital/analytics'); await shot(h, 'h-analytics', 1200) })
await b.close()
