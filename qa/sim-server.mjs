// Live-server payment simulator in a real browser: book a priced slot, pay on the simulator, booking confirmed.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:8790/'
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1 } else console.log('ok -', m) }
const r = await (await fetch(BASE + 'api/rpc/auth.signUp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ args: [{ name: 'Sim Tester', email: `sim${Date.now()}@gmail.com`, password: 'Secret123x', role: 'patient' }] }) })).json()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 430, height: 932 } })
await ctx.addInitScript((t) => localStorage.setItem('medichub.token', t), r.session.token)
const p = await ctx.newPage()
const d = (await (await fetch(BASE + 'api/sync', { headers: { authorization: 'Bearer ' + r.session.token } })).json()).data
const h = d.hospitals.find((x) => d.hospital_services.some((s) => s.hospitalId === x.id && s.fee && s.bookable) && x.publicRecord)
await p.goto(BASE + `#/hospitals/${h.id}`); await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Book', exact: true }).first().click(); await p.waitForTimeout(600)
await p.locator('[role=dialog] button:not([disabled])').filter({ hasText: /left/ }).first().click()
await p.locator('[role=dialog] button[aria-pressed]:not([disabled])').first().click()
await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(300)
ok(await p.getByTestId('doctor-select').count() === 1, 'doctor choice shown')
await p.getByTestId('pay-and-book').click(); await p.waitForURL(/#\/pay\/test\//, { timeout: 15000 }); await p.waitForTimeout(800)
const txt = await p.getByTestId('test-checkout').innerText()
ok(/₦\d/.test(txt) && txt.includes(h.name), `server simulator checkout: ${txt.split('\n').slice(1, 5).join(' / ')}`)
await p.getByTestId('test-pay').click()
await p.locator('[data-testid=payment-verify][data-status=paid]').waitFor({ timeout: 20000 })
ok(true, 'paid and confirmed on the live server')
await b.close()
