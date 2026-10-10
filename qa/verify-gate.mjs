// Email must be confirmed before using the app (server with email on); the email link opens this server.
// Also: demo mode approves a newly registered hospital at once, with starting prices.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:8911/'
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1 } else console.log('ok -', m) }
const mails = async () => (await (await fetch('http://localhost:8897/_sent')).json())
const rpc = async (name, args, token) => { const r = await fetch(`${BASE}api/rpc/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ args }) }); return { status: r.status, ...(await r.json()) } }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
const email = `gate${Date.now()}@gmail.com`
await p.goto(BASE + '#/signup?role=patient'); await p.waitForTimeout(1500)
await p.getByLabel('Full name').fill('Gate Tester'); await p.getByLabel('Email').fill(email); await p.getByLabel('Password', { exact: true }).fill('Secret123x')
await p.getByRole('button', { name: /Create account/ }).click()
await p.getByTestId('verify-gate').waitFor({ timeout: 15000 })
ok(true, 'after sign-up only the "Confirm your email" screen shows')
await p.goto(BASE + '#/find'); await p.waitForTimeout(800)
ok(await p.getByTestId('verify-gate').count() === 1, 'other pages stay locked')
await p.goto(BASE + '#/emergency'); await p.waitForTimeout(1200)
ok(await p.getByTestId('verify-gate').count() === 0, 'emergency help stays open')
const token = await p.evaluate(() => localStorage.getItem('medichub.token'))
const tryBook = await rpc('notifications.markRead', [], token)
ok(tryBook.status !== 200 && tryBook.error.code === 'unverified', `server refuses actions too: "${tryBook.error?.message}"`)
await p.goto(BASE + '#/app'); await p.waitForTimeout(800)
await new Promise((r) => setTimeout(r, 800))
const m = (await mails()).reverse().find((x) => x.to === email)
const link = (m.text.match(/https?:\/\/\S+verify-email\/\S+/) || [])[0]
ok(link && link.startsWith(BASE), `email link opens this server: ${link?.slice(0, 60)}…`)
const p2 = await p.context().newPage()
await p2.goto(link); await p2.locator('[data-testid=verify-result][data-ok="1"]').waitFor({ timeout: 15000 })
ok(true, 'clicking the link confirms the email')
await p.waitForTimeout(2500)
ok(await p.getByTestId('verify-gate').count() === 0, 'the first tab unlocks by itself')
// demo hospital auto-approval
const hs = await rpc('auth.signUp', [{ name: 'Demo Admin', email: `hosp${Date.now()}@gmail.com`, password: 'Secret123x', role: 'hospital' }])
const hm = (await mails()).reverse().find((x) => x.to === hs.result.email)
const ht = (hm.text.match(/verify-email\/([A-Za-z0-9_-]+)/) || [])[1]
await rpc('auth.verifyEmail', [ht])
const ob = await rpc('hospitals.submitOnboarding', [{ name: 'Team Medic Demo Clinic', type: 'Private', tagline: 'Demo', description: 'Our demo clinic', address: '1 UI Road', area: 'Agbowo', city: 'Ibadan', state: 'Oyo', lat: 7.44, lng: 3.9, phone: '+234 803 000 0000', emergencyPhone: '', email: 'clinic@gmail.com', specialties: ['General practice', 'Pediatrics'], facilities: ['Pharmacy'], is24h: false, registration: { cacNumber: 'RC1', licenseNumber: 'L1', licensingBody: 'Oyo MoH', bedCount: 20 }, admin: { name: 'Demo Admin', email: 'a@b.ng' }, documents: [] }], hs.session.token)
ok(ob.status === 200, `hospital onboarding ${ob.error?.message ?? 'ok'}`)
const pub = (await (await fetch(BASE + 'api/sync')).json()).data
const mine = pub.hospitals.find((h) => h.name === 'Team Medic Demo Clinic')
ok(mine?.verification === 'verified', 'new hospital is live for patients straight away (demo)')
ok(pub.hospital_services.filter((s) => s.hospitalId === mine?.id && s.fee).length > 0, 'starting prices filled in')
await b.close()
