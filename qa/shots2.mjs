import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage()
await p.goto('http://localhost:4173/'); await p.waitForTimeout(900); await p.screenshot({ path: 'qa/shots/x-landing-full.png', fullPage: true })
await p.goto('http://localhost:4173/#/login'); await p.getByRole('button', { name: /^Patient$/ }).click(); await p.waitForURL(/#\/app$/); await p.waitForTimeout(900)
await p.screenshot({ path: 'qa/shots/x-home.png', fullPage: true })
await p.goto('http://localhost:4173/#/hospitals/h_luth'); await p.waitForTimeout(900); await p.screenshot({ path: 'qa/shots/x-profile.png', fullPage: true })
await p.setViewportSize({ width: 390, height: 844 }); await p.goto('http://localhost:4173/'); await p.waitForTimeout(900); await p.screenshot({ path: 'qa/shots/x-mlanding.png', fullPage: true })
await b.close()
