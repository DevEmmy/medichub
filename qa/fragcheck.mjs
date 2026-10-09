import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto('file:///tmp/fragtest/index.html'); await p.waitForTimeout(3000)
const t = await p.evaluate(() => document.body.innerText)
console.log('stray template text:', /\$\{ms\(|You get this because/.test(t), '| app rendered:', /Medic Hub|hospital/i.test(t), '| errors:', errs.slice(0, 2))
await b.close()
