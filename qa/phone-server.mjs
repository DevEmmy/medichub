// Server-side checks: USSD + SMS webhooks (Africa's Talking format), welcome/confirm email, password reset email.
// Run after qa/launch.mjs so a verified hospital with slots exists. Needs mock-mail (8897) and mock-sms (8896).
const API = process.argv[2] || 'http://localhost:8790'
const errors = []
const step = async (name, fn) => { try { await fn(); console.log('OK', name) } catch (e) { errors.push(`FAIL ${name}: ${e.message}`); console.log('FAIL', name, e.message) } }
const ussd = async (phone, text) => (await fetch(`${API}/api/ussd`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ sessionId: 's1', serviceCode: '*347*633#', phoneNumber: phone, text }) })).text()
// The reply goes out as an SMS (read back from the mock SMS provider)
const sms = async (from, text) => {
  const before = (await texts()).length
  await fetch(`${API}/api/sms/incoming`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ from, to: '32112', text }) })
  for (let i = 0; i < 20; i++) { const t = (await texts()).slice(before).filter((x) => x.to === from); if (t.length) return { reply: t.at(-1).message }; await new Promise((r) => setTimeout(r, 100)) }
  return { reply: '' }
}
const rpc = async (name, args, token) => { const r = await fetch(`${API}/api/rpc/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ args }) }); return { status: r.status, body: await r.json() } }
const pick = (screen, label) => { const l = screen.split('\n').find((x) => x.includes(label)); if (!l) throw new Error(`${label} not in: ${screen}`); return l.trim().split(' ')[0] }
const mails = async () => (await (await fetch('http://localhost:8897/_sent')).json())
const texts = async () => (await (await fetch('http://localhost:8896/_sent')).json())
const phone = '+2348090001111'

await step('USSD home menu', async () => { const r = await ussd(phone, ''); if (!r.startsWith('CON Medic Hub')) throw new Error(r) })
let ref = ''
await step('USSD books at a verified hospital, new caller gives name', async () => {
  let path = ['2']; let r = await ussd(phone, path.join('*'))
  path.push('1'); r = await ussd(phone, path.join('*'))       // first state
  path.push('1'); r = await ussd(phone, path.join('*'))                 // first hospital
  path.push('1'); r = await ussd(phone, path.join('*'))                 // first service
  if (!/Free times/.test(r)) throw new Error(r)
  path.push('1'); r = await ussd(phone, path.join('*'))
  if (!/Enter your full name/.test(r)) throw new Error(r)
  path.push('Iya Basira Lawal'); r = await ussd(phone, path.join('*'))
  if (!/1 Confirm/.test(r)) throw new Error(r)
  path.push('1'); r = await ussd(phone, path.join('*'))
  const m = r.match(/Ref (MED-[A-Z0-9]{6})/); if (!r.startsWith('END') || !m) throw new Error(r); ref = m[1]
  await new Promise((s) => setTimeout(s, 400))
  const t = await texts(); if (!t.some((x) => x.to === phone && x.message.includes(ref))) throw new Error('no confirmation SMS sent')
})
await step('SMS MY and CANCEL from the same phone', async () => {
  const my = await sms(phone, 'my'); if (!String(my.reply).includes(ref)) throw new Error(JSON.stringify(my))
  const c = await sms(phone, 'cancel ' + ref); if (!/is cancelled/.test(c.reply)) throw new Error(JSON.stringify(c))
  await new Promise((s) => setTimeout(s, 300))
  const t = await texts(); if (!t.some((x) => x.to === phone && /is cancelled/.test(x.message))) throw new Error('cancel SMS not sent')
})
await step('other phones cannot touch the booking', async () => { const r = await sms('+2348099999999', 'cancel ' + ref); if (!/no booking with that reference/.test(r.reply)) throw new Error(r.reply) })
await step('sign-up sends a welcome email with a confirm link that works', async () => {
  const before = (await mails()).length
  const r = await rpc('auth.signUp', [{ name: 'Kemi Test', email: 'kemi.test@gmail.com', password: 'Secret123x', role: 'patient' }])
  if (r.status !== 200) throw new Error(JSON.stringify(r.body))
  if (r.body.result?.demoVerifyToken) throw new Error('server leaked the token to the browser')
  await new Promise((s) => setTimeout(s, 300))
  const m = (await mails()).slice(before).find((x) => x.to === 'kemi.test@gmail.com')
  if (!m || !/Welcome to Medic Hub/.test(m.subject) || !m.html) throw new Error('no welcome email')
  const token = (m.text.match(/verify-email\/([A-Za-z0-9_-]+)/) || [])[1]; if (!token) throw new Error('no link in email')
  const v = await rpc('auth.verifyEmail', [token]); if (v.status !== 200) throw new Error(JSON.stringify(v.body))
  const again = await rpc('auth.verifyEmail', [token]); if (again.status === 200) throw new Error('link worked twice')
})
await step('signed-up user can sign in with the same details', async () => {
  const r = await rpc('auth.signIn', ['kemi.test@gmail.com', 'Secret123x']); if (r.status !== 200) throw new Error(JSON.stringify(r.body))
  const bad = await rpc('auth.signIn', ['kemi.test@gmail.com', 'Wrong123x']); if (bad.status === 200) throw new Error('wrong password accepted')
})
await step('forgot password emails a reset link', async () => {
  const before = (await mails()).length
  const r = await rpc('auth.requestPasswordReset', ['kemi.test@gmail.com']); if (r.status !== 200 || r.body.result?.token) throw new Error(JSON.stringify(r.body))
  await new Promise((s) => setTimeout(s, 300))
  const m = (await mails()).slice(before).find((x) => x.to === 'kemi.test@gmail.com' && /Reset your Medic Hub password/.test(x.subject))
  if (!m || !/reset-password\//.test(m.text)) throw new Error('no reset email')
})
console.log(errors.length ? errors.join('\n') : 'ALL SERVER PHONE + EMAIL OK')
process.exit(errors.length ? 1 : 0)
