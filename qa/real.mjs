import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ timezoneId: 'Africa/Lagos', viewport: { width: 1280, height: 900 } })).newPage()
await p.goto('http://localhost:8790/#/find'); await p.waitForTimeout(2000); await p.screenshot({ path: 'qa/shots/R-find.png' })
await p.goto('http://localhost:8790/#/hospitals/h_uith'); await p.waitForTimeout(2000); await p.screenshot({ path: 'qa/shots/R-uith.png' })
await p.goto('http://localhost:8790/#/emergency'); await p.waitForTimeout(1500)
console.log('112 on emergency page:', (await p.textContent('body')).includes('112'), '| tel:112 links:', await p.locator('a[href="tel:112"]').count())
await b.close()
