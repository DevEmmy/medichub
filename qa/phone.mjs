// USSD / SMS simulator + email confirmation checks on the demo build (vite preview on 4173).
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:4173/'
const errors = []
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Africa/Lagos' })
const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push('pageerror ' + e.message))
const step = async (name, fn) => { try { await fn(); console.log('OK', name) } catch (e) { errors.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, e.message.split('\n')[0]) } }
const screenText = () => p.getByTestId('ussd-text').innerText()
const choose = async (label) => { const t = await screenText(); const m = t.split('\n').find((l) => l.includes(label)); if (!m) throw new Error(`"${label}" not on screen: ${t}`); await answer(m.trim().split(' ')[0]) }
const answer = async (v) => { await p.getByTestId('ussd-input').fill(v); await p.getByTestId('ussd-send').click(); await p.waitForTimeout(500) }
const dial = async () => { for (const k of ['star', '3', '4', '7', 'star', '6', '3', '3', 'hash']) await p.getByTestId('key-' + k).click(); await p.getByTestId('ussd-call').click(); await p.getByTestId('ussd-text').waitFor() }
let ref = ''

await step('landing links to phone access', async () => { await p.goto(BASE); await p.getByTestId('phone-cta').scrollIntoViewIfNeeded(); await p.getByTestId('phone-cta').click(); await p.getByTestId('ussd-code').waitFor() })
await step('USSD menu opens', async () => { await dial(); const t = await screenText(); if (!/1 Emergency/.test(t) || !/2 Book/.test(t)) throw new Error(t) })
await step('USSD emergency list + SMS', async () => {
  await answer('1'); await choose('Oyo')
  const t = await screenText(); if (!/ERs in Oyo/.test(t)) throw new Error(t)
  await p.getByTestId('sms-inbox').getByText(/emergency units in Oyo/).waitFor()
  await p.getByTestId('ussd-ok').click()
})
await step('USSD booking shows free times and books', async () => {
  await dial(); await answer('2'); await choose('Lagos'); await choose('Lagoon Crest'); await choose('General consultation')
  const t = await screenText(); if (!/Free times/.test(t) || !/left\)/.test(t)) throw new Error(t)
  await answer('1')
  const c = await screenText(); if (!/1 Confirm/.test(c)) throw new Error(c)
  await answer('1')
  const done = await screenText(); const m = done.match(/Ref (MED-[A-Z0-9]{6})/); if (!m) throw new Error(done); ref = m[1]
  await p.getByTestId('sms-inbox').getByText(new RegExp(`Booked! Ref ${ref}`)).waitFor()
  if (done.length > 182) throw new Error('screen too long ' + done.length)
  await p.getByTestId('ussd-ok').click()
})
await step('USSD my bookings lists it', async () => { await dial(); await answer('3'); const t = await screenText(); if (!t.includes(ref)) throw new Error(t); await p.getByTestId('ussd-ok').click() })
await step('USSD first aid sends steps', async () => { await dial(); await answer('5'); await answer('1'); await p.getByTestId('sms-inbox').getByText(/first aid/).waitFor(); await p.getByTestId('ussd-ok').click() })
let smsRef = ''
await step('SMS: new phone books with name', async () => {
  await p.getByTestId('sim-phone').fill('0812 345 6789')
  await p.getByRole('tab', { name: 'Send a text' }).click()
  const send = async (t) => { await p.getByTestId('sms-input').fill(t); await p.getByTestId('sms-send').click(); await p.waitForTimeout(400); return (await p.getByTestId('sms-thread').locator('p').last().innerText()) }
  const help = await send('HELP'); if (!/ER <state>/.test(help)) throw new Error(help)
  const hs = await send('hospitals lagos'); const code = (hs.match(/([A-Z0-9]+) = Lagoon Crest/) || [])[1]; if (!code) throw new Error(hs)
  const sl = await send('SLOTS ' + code); if (!/1\)/.test(sl)) throw new Error(sl)
  const noName = await send('BOOK 1'); if (!/add your full name/.test(noName)) throw new Error(noName)
  const ok = await send('BOOK 1 Mama Bisi Adeyemi'); const m = ok.match(/Ref (MED-[A-Z0-9]{6})/); if (!m) throw new Error(ok); smsRef = m[1]
  const my = await send('MY'); if (!my.includes(smsRef)) throw new Error(my)
  const er = await send('ER Oyo'); if (!/emergency units in Oyo/.test(er)) throw new Error(er)
  const cancel = await send('CANCEL ' + smsRef); if (!/is cancelled/.test(cancel)) throw new Error(cancel)
})
await step('hospital sees the USSD booking', async () => {
  await p.goto(BASE + '#/login'); await p.getByRole('button', { name: /^Hospital$/ }).click(); await p.waitForTimeout(1200)
  await p.goto(BASE + '#/hospital/bookings'); await p.getByRole('button', { name: 'All', exact: true }).click()
  await p.getByPlaceholder(/Search/).fill(ref); await p.locator('text=by USSD >> visible=true').first().waitFor({ timeout: 8000 }).catch(async (e) => { await p.screenshot({ path: 'qa/shots/dbg.png' }); throw e })
})
await step('sign-up sends confirmation; link confirms email', async () => {
  await p.goto(BASE + '#/login'); await p.evaluate(() => { localStorage.removeItem('medichub.lastSession'); sessionStorage.clear() }); await p.reload()
  await p.goto(BASE + '#/signup'); await p.getByRole('radio').first().click()
  await p.getByLabel('Full name').fill('Tolu Ade'); await p.getByLabel('Email').fill('tolu.ade@gmail.com'); await p.getByLabel('Password', { exact: true }).fill('Secret123x')
  await p.getByRole('button', { name: /Create account/ }).click()
  await p.getByTestId('verify-banner').waitFor({ timeout: 10000 })
  await p.getByTestId('demo-verify').click()
  await p.locator('[data-testid=verify-result][data-ok="1"]').waitFor({ timeout: 8000 })
  await p.goto(BASE + '#/app'); await p.waitForTimeout(800)
  if (await p.getByTestId('verify-banner').count()) throw new Error('banner still shown after confirming')
})
await step('signed-up account can sign in again', async () => {
  await p.evaluate(() => { localStorage.removeItem('medichub.lastSession'); sessionStorage.clear() }); await p.goto(BASE + '#/login'); await p.reload()
  await p.getByLabel('Email').fill('tolu.ade@gmail.com'); await p.getByLabel('Password', { exact: true }).fill('Secret123x'); await p.getByRole('button', { name: /^Sign in$/ }).click()
  await p.waitForURL(/#\/app/, { timeout: 8000 })
})
await step('no overflow on phone page', async () => { await p.goto(BASE + '#/phone'); await p.setViewportSize({ width: 320, height: 700 }); await p.waitForTimeout(500); const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > w[1] + 1) throw new Error(`overflow ${w}`); await p.screenshot({ path: 'qa/shots/phone.png', fullPage: true }) })
await b.close()
console.log(errors.length ? errors.join('\n') : 'ALL PHONE + ACCOUNT OK')
process.exit(errors.length ? 1 : 0)
