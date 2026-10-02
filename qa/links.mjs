import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Africa/Lagos', geolocation: { latitude: 6.45, longitude: 3.45 }, permissions: ['geolocation'] })).newPage()
const B = 'http://localhost:4173/'
await p.goto(B); await p.evaluate(() => localStorage.clear())
const seen = new Map()
const routes = ['#/emergency', '#/triage', '#/first-aid', '#/find?emergency=1', '#/assistant', '#/scan', '#/hospitals/h_lagooncrest', '#/hospitals/h_uch']
await p.goto(B + '#/emergency'); await p.waitForTimeout(800)
const guides = await p.$$eval('a[href*="#/emergency/"]', (as) => as.map((a) => a.getAttribute('href')))
for (const r of [...routes, ...guides]) {
  await p.goto(B + (r.startsWith('#') ? r : r.replace(/^.*#/, '#'))); await p.waitForTimeout(700)
  const links = await p.$$eval('a[href]', (as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 40), target: a.target })))
  for (const l of links) if (!seen.has(l.href)) seen.set(l.href, { ...l, from: r })
}
const bad = []
for (const [href, l] of seen) {
  if (href.startsWith('tel:')) { if (!/^tel:\+?\d{3,15}$/.test(href)) bad.push(['bad tel', href, l.from]); continue }
  if (/^(https?:|mailto:)/.test(href)) continue
  const url = href.startsWith('#') ? B + href : href.startsWith('/') ? 'http://localhost:4173' + href : B + href
  await p.goto(url); await p.waitForTimeout(500)
  const t = await p.textContent('body')
  if (/Page not found|isn't available|not found/i.test(t)) bad.push(['notfound', href, l.text, l.from])
}
console.log('links checked', seen.size); console.log(JSON.stringify(bad, null, 1))
console.log('tel links:', [...seen.keys()].filter((h) => h.startsWith('tel:')))
await b.close()
