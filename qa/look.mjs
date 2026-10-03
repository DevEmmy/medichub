import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const shots = [['d-landing', 1440, '#/', null], ['m-landing', 390, '#/', null], ['m-home', 390, '#/app', 'Patient'], ['d-find', 1440, '#/find', null], ['m-assistant', 390, '#/assistant?q=My child has a fever', null], ['m-emergency', 390, '#/emergency', null]]
for (const [n, w, path, role] of shots) {
  const c = await b.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 } }); const p = await c.newPage()
  if (role) { await p.goto('http://localhost:4173/#/login'); await p.getByRole('button', { name: new RegExp('^' + role + '$') }).click(); await p.waitForTimeout(1200) }
  await p.goto('http://localhost:4173/' + path); await p.waitForTimeout(1500)
  await p.screenshot({ path: `qa/shots/look-${n}.png`, fullPage: n === 'd-landing' })
  await c.close()
}
await b.close()
