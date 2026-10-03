import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 150)))
await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(2500)
console.log(await p.$$eval('section img', (is) => is.slice(0, 4).map((i) => [i.src.slice(0, 60), i.naturalWidth, getComputedStyle(i).opacity, i.getBoundingClientRect().height])))
await p.screenshot({ path: 'qa/shots/look-hero.png' })
await b.close()
