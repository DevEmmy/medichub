// Accessibility audit (axe-core, WCAG 2.1 A/AA) over the main screens of the demo build.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:4173/'
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
const pages = [['landing', ''], ['find', '#/find'], ['emergency', '#/emergency'], ['guide', '#/emergency/severe-bleeding'], ['first-aid', '#/first-aid'], ['assistant', '#/assistant'], ['hospital-profile', '#/hospitals/h_lagooncrest'], ['login', '#/login'], ['signup', '#/signup'], ['triage', '#/triage'], ['wellness', '#/wellness']]
const login = async (role) => { await p.goto(BASE + '#/login'); await p.getByRole('button', { name: new RegExp(`^${role}$`) }).click(); await p.waitForTimeout(1500) }
let total = 0
const audit = async (name) => {
  await p.waitForTimeout(1200)
  await p.addScriptTag({ content: axe })
  const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'], resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, nodes: v.nodes.slice(0, 4).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n').slice(1, 2).join(' ')) })))
  const bad = r.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  total += bad.length
  console.log(`\n== ${name}: ${bad.length} serious/critical, ${r.length - bad.length} minor`)
  for (const v of r) console.log(`  [${v.impact}] ${v.id} (${v.n}) ${v.help}\n    ${v.nodes.join('\n    ')}`)
}
for (const [name, path] of pages) { await p.goto(BASE + path); await audit(name) }
await login('Patient'); for (const [n, path] of [['patient-home', '#/app'], ['bookings', '#/app/bookings'], ['vault', '#/app/health']]) { await p.goto(BASE + path); await audit(n) }
await login('Hospital'); for (const [n, path] of [['hospital-dash', '#/hospital'], ['hospital-team', '#/hospital/team'], ['hospital-status', '#/hospital/status'], ['hospital-bookings', '#/hospital/bookings']]) { await p.goto(BASE + path); await audit(n) }
await b.close()
console.log(`\nTOTAL serious/critical: ${total}`)
