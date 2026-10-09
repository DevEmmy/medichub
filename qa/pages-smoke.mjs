// Smoke test of the built site served from a sub-path, the way GitHub Pages serves it.
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:8601/medichub/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(`${r.status()} ${r.url()}`) })
const checks = [['', 'right now.'], ['#/find', 'facilities'], ['#/emergency', 'Call the hospital directly'], ['#/assistant', 'How can I help you'], ['#/emergency/severe-bleeding', 'Read steps aloud'], ['#/login', 'Patient']]
for (const [path, text] of checks) { await p.goto(BASE + path); await p.getByText(text).first().waitFor({ timeout: 10000 }).then(() => console.log('OK', path || '/'), (e) => errs.push('FAIL ' + path + ' ' + e.message.split('\n')[0])) }
await p.goto(BASE + '#/login'); await p.getByRole('button', { name: /^Hospital$/ }).click(); await p.waitForTimeout(1200)
await p.goto(BASE + '#/hospital/team'); await p.getByRole('heading', { name: 'Team & email alerts' }).waitFor().then(() => console.log('OK hospital team'), (e) => errs.push('FAIL team ' + e.message.split('\n')[0]))
await b.close(); console.log(errs.length ? errs.join('\n') : 'PAGES BUILD OK')
