import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto('http://localhost:4173/#/scan'); await p.waitForTimeout(800)
await p.getByTestId('qr-photo-input').setInputFiles('/tmp/demo-pass.png'); await p.waitForTimeout(2500)
console.log(p.url()); console.log((await p.textContent('main') ?? await p.textContent('body')).slice(0, 300))
await b.close()
