import { chromium } from 'playwright'
const BASE = 'http://localhost:4173/'
const out = process.argv[2] || 'qa/shots'
const errors = []
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const watch = (p, tag) => { p.on('pageerror', (e) => errors.push(`[${tag}] pageerror ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console ${m.text()}`) }) }
const p = await ctx.newPage(); watch(p, 'patient')
const overflow = async (pg, name) => { const w = await pg.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (w[0] > w[1] + 1) errors.push(`OVERFLOW ${name}: ${w[0]} > ${w[1]}`) }
const shot = async (pg, name) => { await pg.waitForTimeout(700); await overflow(pg, name); await pg.screenshot({ path: `${out}/${name}.png`, fullPage: false }) }
const step = async (name, fn) => { try { await fn(); console.log('OK', name) } catch (e) { errors.push(`STEP FAIL ${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, e.message.split('\n')[0]) } }

await step('landing', async () => { await p.goto(BASE); await p.getByText('without the guesswork').waitFor(); await shot(p, 'm-landing') })
await step('emergency public', async () => { await p.goto(BASE + '#/emergency'); await p.getByText('Call 112').first().waitFor(); await shot(p, 'm-emergency') })
await step('guide', async () => { await p.goto(BASE + '#/emergency/severe-bleeding'); await p.getByText('Do this now').waitFor(); await shot(p, 'm-guide') })
await step('triage', async () => { await p.goto(BASE + '#/triage'); await p.getByRole('button', { name: 'No' }).click(); await p.getByRole('button', { name: 'Yes' }).click(); await p.getByText('Call 112 and seek emergency care now').waitFor(); await shot(p, 'm-triage') })
await step('login patient', async () => { await p.goto(BASE + '#/login'); await p.getByRole('button', { name: /^Patient$/ }).click(); await p.waitForURL(/#\/app$/); await shot(p, 'm-home') })
await step('find', async () => { await p.goto(BASE + '#/find'); await p.getByText('Choose city').click(); await p.getByRole('button', { name: /Lekki Phase 1/ }).click(); await p.waitForTimeout(600); await shot(p, 'm-find') })
await step('filters', async () => { await p.getByRole('button', { name: 'Emergency available' }).click(); await p.waitForTimeout(400); await shot(p, 'm-find-filter') })
await step('profile', async () => { await p.goto(BASE + '#/hospitals/h_lagooncrest'); await p.getByText('Live status').waitFor(); await shot(p, 'm-profile') })
await step('book', async () => {
  await p.getByRole('button', { name: 'Book a slot' }).first().click()
  await p.getByText('Choose a service').waitFor()
  await p.getByRole('button', { name: /General consultation/ }).first().click()
  await p.getByText('Choose a date').waitFor()
  const days = p.locator('[role=dialog] button:not([disabled])').filter({ hasText: 'left' })
  await days.nth(1).click()
  await p.getByText('Choose a time').waitFor()
  const times = p.locator('[role=dialog] button[aria-pressed]:not([disabled])')
  await times.first().click()
  await p.getByRole('button', { name: 'Continue' }).click()
  await p.getByRole('button', { name: /Confirm booking/ }).click()
  await p.getByText('Booking reference').waitFor({ timeout: 8000 })
  await shot(p, 'm-pass')
})
await step('vault', async () => { await p.goto(BASE + '#/app/health'); await p.getByText('Emergency snapshot').waitFor(); await shot(p, 'm-vault') })
await step('bookings', async () => { await p.goto(BASE + '#/app/bookings'); await p.waitForTimeout(500); await shot(p, 'm-bookings') })
await step('wellness', async () => { await p.goto(BASE + '#/wellness'); await shot(p, 'm-wellness') })
await step('firstaid', async () => { await p.goto(BASE + '#/first-aid'); await shot(p, 'm-firstaid') })

// Hospital in a second tab (same browser context → realtime via BroadcastChannel)
const h = await ctx.newPage(); watch(h, 'hospital')
await h.setViewportSize({ width: 1440, height: 900 })
await step('hospital login', async () => {
  await h.goto(BASE + '#/login')
  await h.getByRole('button', { name: /^Hospital$/ }).click()
  await h.waitForURL(/#\/hospital$/); await h.getByText('Live status').first().waitFor(); await shot(h, 'd-dashboard')
})
await step('realtime status', async () => {
  await p.goto(BASE + '#/hospitals/h_lagooncrest'); await p.getByText('Live status').waitFor(); await p.waitForTimeout(500)
  await h.getByRole('radiogroup', { name: 'Emergency department status' }).getByRole('radio', { name: 'Busy' }).click()
  await p.getByText('Live update from the hospital').waitFor({ timeout: 5000 })
  await shot(p, 'm-realtime')
})
await step('hospital bookings', async () => { await h.goto(BASE + '#/hospital/bookings'); await h.waitForTimeout(500); await shot(h, 'd-bookings') })
await step('hospital checkin', async () => { await h.goto(BASE + '#/hospital/check-in'); await h.getByRole('button', { name: 'MED-K7RA5N' }).click(); await h.getByRole('button', { name: /Confirm check-in/ }).click(); await h.getByText('Checked in. The patient').waitFor(); await shot(h, 'd-checkin') })
await step('hospital slots', async () => { await h.goto(BASE + '#/hospital/slots'); await shot(h, 'd-slots') })
await step('hospital status', async () => { await h.goto(BASE + '#/hospital/status'); await shot(h, 'd-status') })
await step('hospital profile', async () => { await h.goto(BASE + '#/hospital/profile'); await shot(h, 'd-profile') ; await h.getByRole('button', { name: 'Services' }).click(); await shot(h, 'd-profile-services') })
await step('announce', async () => { await h.goto(BASE + '#/hospital/announcements'); await h.getByRole('button', { name: 'Clinic closing at 4 PM.' }).click(); await h.getByRole('button', { name: /Publish announcement/ }).click(); await h.getByText('Announcement published').waitFor(); await shot(h, 'd-announce') })
await step('hospital mobile', async () => { await h.setViewportSize({ width: 375, height: 812 }); await h.goto(BASE + '#/hospital'); await shot(h, 'm-hdash'); await h.goto(BASE + '#/hospital/bookings'); await shot(h, 'm-hbookings'); await h.setViewportSize({ width: 1440, height: 900 }) })

// Desktop patient + admin
const d = await ctx.newPage(); watch(d, 'desktop'); await d.setViewportSize({ width: 1440, height: 900 })
await step('desktop landing', async () => { await d.goto(BASE); await shot(d, 'd-landing') })
await step('desktop find', async () => { await d.goto(BASE + '#/find'); await d.waitForTimeout(600); await shot(d, 'd-find') })
await step('desktop profile', async () => { await d.goto(BASE + '#/hospitals/h_lagooncrest'); await shot(d, 'd-hprofile') })
await step('desktop home', async () => { await d.goto(BASE + '#/app'); await shot(d, 'd-home') })
await step('admin', async () => {
  const a = await b.newContext({ viewport: { width: 1440, height: 900 } }); const ap = await a.newPage(); watch(ap, 'admin')
  await ap.goto(BASE + '#/login'); await ap.getByRole('button', { name: /^Platform$/ }).click(); await ap.waitForURL(/#\/admin/); await ap.waitForTimeout(500); await shot(ap, 'd-admin')
  await ap.getByRole('button', { name: /Approve & verify/ }).click(); await ap.getByText(/verified$/).first().waitFor()
})
await step('signup hospital + onboarding', async () => {
  const a = await b.newContext({ viewport: { width: 390, height: 844 } }); const s = await a.newPage(); watch(s, 'signup')
  await s.goto(BASE + '#/signup'); await s.getByRole('radio', { name: /I'm a Hospital/ }).click()
  await s.getByLabel('Your full name').fill('Tola Ade'); await s.getByLabel('Work email').fill('tola@test.ng'); await s.getByLabel('Password').fill('secret123')
  await s.getByRole('button', { name: /Create account/ }).click(); await s.waitForURL(/onboarding/)
  await shot(s, 'm-onboarding')
})
for (const w of [320, 360, 430, 768, 1024]) {
  await step('width ' + w, async () => { await p.setViewportSize({ width: w, height: 800 }); for (const r of ['', '#/find', '#/app', '#/emergency', '#/hospitals/h_lagooncrest', '#/app/health', '#/wellness']) { await p.goto(BASE + r); await p.waitForTimeout(450); await overflow(p, `${w}${r}`) } })
}
console.log('\nERRORS:\n' + (errors.join('\n') || 'none'))
await b.close()
