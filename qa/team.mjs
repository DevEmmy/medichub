// Hospital team email alerts + accessibility checks (demo build on 4173).
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:4173/'
const errors = []
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
// Fake text-to-speech so read-aloud can be tested headless
await ctx.addInitScript(() => {
  window.__spoken = []
  const synth = { speaking: false, paused: false, pending: false, getVoices: () => [{ lang: 'en-NG', name: 'Test NG', default: true }], addEventListener() {}, cancel() {}, pause() {}, resume() {},
    speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 120) } }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
})
const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push('pageerror ' + e.message))
const step = async (name, fn) => { try { await fn(); console.log('OK', name) } catch (e) { errors.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, e.message.split('\n')[0]) } }
const login = async (role) => { await p.goto(BASE + '#/login'); await p.getByRole('button', { name: new RegExp(`^${role}$`) }).click(); await p.waitForTimeout(1200) }

await step('team page lists staff', async () => {
  await login('Hospital'); await p.goto(BASE + '#/hospital/team')
  await p.getByTestId('team-list').getByText('frontdesk@lagooncrest.example').waitFor()
  await p.getByTestId('email-mode').getByText(/Demo/).waitFor()
})
await step('add staff with Gmail (validates email)', async () => {
  await p.getByTestId('add-member').click()
  await p.getByLabel('Full name').fill('Chiamaka Obi')
  await p.getByLabel('Email (Gmail or work email)').fill('chiamaka.obi@gmail')
  await p.getByTestId('save-member').click()
  await p.getByRole('alert').filter({ hasText: 'Enter a valid email address' }).waitFor({ timeout: 8000 }).catch(async (e) => { await p.screenshot({ path: 'qa/shots/dbg.png' }); throw new Error('no validation error shown') })
  await p.getByLabel('Email (Gmail or work email)').fill('chiamaka.obi@gmail.com')
  await p.getByLabel('Role').selectOption('Nurse')
  await p.getByTestId('save-member').click()
  await p.getByTestId('team-list').getByText('chiamaka.obi@gmail.com').waitFor({ timeout: 8000 }).catch((e) => { throw new Error('member not listed: ' + e.message.split('\n')[0]) })
})
await step('send test email is logged', async () => {
  const card = p.getByTestId('team-list').locator('li', { hasText: 'chiamaka.obi@gmail.com' })
  await card.getByTestId('test-email').click()
  await p.getByTestId('email-log').getByText(/on the Medic Hub team/).first().waitFor()
})
await step('booking emails every matching staff member', async () => {
  await login('Patient')
  await p.goto(BASE + '#/hospitals/h_lagooncrest')
  await p.getByRole('button', { name: 'Book a slot' }).first().click()
  await p.getByRole('button', { name: /General consultation/ }).first().click()
  await p.locator('[role=dialog] button:not([disabled])').filter({ hasText: 'left' }).nth(1).click()
  await p.locator('[role=dialog] button[aria-pressed]:not([disabled])').first().click()
  await p.getByRole('button', { name: 'Continue' }).click()
  await p.getByTestId('pay-and-book').click()
  await p.getByTestId('test-pay').click()
  await p.locator('[data-testid=payment-verify][data-status=paid]').waitFor({ timeout: 15000 })
  await login('Hospital'); await p.goto(BASE + '#/hospital/team')
  const log = p.getByTestId('email-log')
  await log.getByText(/^Paid booking: Amaka Okafor/).first().waitFor()
  const to = await log.locator('li', { hasText: /^Paid booking/ }).allInnerTexts()
  const joined = to.join('\n')
  for (const e of ['frontdesk@lagooncrest.example', 'chiamaka.obi@gmail.com']) if (!joined.includes(e)) throw new Error('missing email to ' + e)
  if (joined.includes('tunde.bakare@lagooncrest.example')) throw new Error('cardiology-only doctor should not get a general consultation email')
  await log.locator('li', { hasText: /^Paid booking/ }).first().locator('button').click()
  await p.getByText(/Reference: MED-/).first().waitFor()
  await p.screenshot({ path: 'qa/shots/team.png', fullPage: true })
})
await step('a11y: text size + contrast', async () => {
  await p.getByTestId('a11y-btn').click(); await p.getByTestId('a11y-panel').waitFor()
  await p.getByRole('radio', { name: 'Larger' }).click()
  await p.getByRole('switch', { name: 'High contrast' }).click()
  const z = await p.evaluate(() => [document.documentElement.style.zoom, document.documentElement.classList.contains('a11y-contrast')])
  if (z[0] !== '1.3' || !z[1]) throw new Error('settings not applied ' + z)
  await p.screenshot({ path: 'qa/shots/a11y-panel.png' })
  await p.getByRole('radio', { name: 'Default' }).click(); await p.getByRole('switch', { name: 'High contrast' }).click()
})
await step('a11y: read page aloud with highlight', async () => {
  await p.getByTestId('read-page').click()
  await p.getByTestId('reader-bar').waitFor()
  await p.locator('.a11y-reading').first().waitFor()
  await p.waitForTimeout(800)
  const spoken = await p.evaluate(() => window.__spoken.slice(0, 4))
  if (!spoken.length || !/Team/.test(spoken.join(' '))) throw new Error('page not read: ' + JSON.stringify(spoken))
  await p.getByTestId('reader-stop').click()
})
await step('a11y: settings persist after reload', async () => {
  await p.getByTestId('a11y-btn').click(); await p.getByRole('switch', { name: 'Underline links' }).click(); await p.keyboard.press('Escape')
  await p.reload(); await p.waitForTimeout(800)
  if (!(await p.evaluate(() => document.documentElement.classList.contains('a11y-links')))) throw new Error('not persisted')
  await p.getByTestId('a11y-btn').click(); await p.getByRole('switch', { name: 'Underline links' }).click(); await p.keyboard.press('Escape')
})
await step('a11y: first-aid steps read aloud', async () => {
  await p.goto(BASE + '#/emergency/severe-bleeding')
  await p.evaluate(() => { window.__spoken = [] })
  await p.getByTestId('listen-guide').click(); await p.waitForTimeout(400)
  const s = await p.evaluate(() => window.__spoken.join(' '))
  if (!/Step 1/.test(s)) throw new Error('guide not read: ' + s.slice(0, 80))
})
await step('a11y: route announced for screen readers', async () => {
  await p.goto(BASE + '#/find'); await p.waitForTimeout(900)
  const t = await p.getByTestId('route-announcer').textContent()
  if (!/page/.test(t || '')) throw new Error('no announcement: ' + t)
})
await step('a11y: header fits 320px', async () => {
  await p.setViewportSize({ width: 320, height: 700 })
  for (const path of ['', '#/find', '#/emergency', '#/hospital/team']) { await p.goto(BASE + path); await p.waitForTimeout(600); const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > w[1] + 1) throw new Error(`overflow ${path} ${w}`) }
})
await b.close()
console.log(errors.length ? errors.join('\n') : 'ALL TEAM + A11Y OK')
process.exit(errors.length ? 1 : 0)
