import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 440, height: 1000 }, deviceScaleFactor: 2, timezoneId: 'Africa/Lagos' })).newPage()
await p.goto('http://localhost:4173/#/phone'); await p.waitForTimeout(800)
const sim = p.locator('section[aria-label="Phone simulator"]')
const dial = async () => { for (const k of ['star','3','4','7','star','6','3','3','hash']) await p.getByTestId('key-'+k).click(); await p.getByTestId('ussd-call').click(); await p.getByTestId('ussd-text').waitFor() }
const ans = async (v) => { await p.getByTestId('ussd-input').fill(v); await p.getByTestId('ussd-send').click(); await p.waitForTimeout(500) }
const choose = async (l) => { const t = await p.getByTestId('ussd-text').innerText(); await ans(t.split('\n').find((x) => x.includes(l)).trim().split(' ')[0]) }
await p.addStyleTag({ content: 'nav.fixed, header{display:none!important}' })
await dial(); await sim.screenshot({ path: 'qa/deck/ussd-menu.png' })
await ans('2'); await choose('Lagos'); await choose('Lagoon Crest'); await choose('General consultation')
await p.getByTestId('ussd-input').fill('1'); await sim.screenshot({ path: 'qa/deck/ussd-times.png' })
await ans('1'); await ans('1'); await sim.screenshot({ path: 'qa/deck/ussd-booked.png' })
await b.close(); console.log('ok')
