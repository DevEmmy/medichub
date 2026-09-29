import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('response', r=>{ if (r.status()>=400 && r.url().includes('4190')) errs.push(r.status()+' '+r.url()) })
await p.goto('http://localhost:4190/medic-hub/'); await p.getByText('without the guesswork').waitFor()
await p.goto('http://localhost:4190/medic-hub/#/find'); await p.waitForTimeout(1200)
console.log('find cards:', await p.locator('article').count(), 'errors:', errs)
await b.close()
