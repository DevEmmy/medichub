import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 420, height: 820 } })
const errs=[]; p.on('pageerror', e=>errs.push(e.message))
await p.goto('http://localhost:4180/frame.html'); await p.waitForTimeout(1500)
const f = p.frames()[1]
f.on?.('pageerror', e=>errs.push(e.message))
await f.goto('http://localhost:4180/page.html#/emergency/choking'); await p.waitForTimeout(1200)
console.log('watch link:', await f.locator('text=Watch on YouTube').count())
await p.screenshot({ path: '/home/claude/medic-hub/qa/shots/framed.png' })
console.log('errors', errs)
await b.close()
