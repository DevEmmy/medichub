import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const W of [320, 360, 390]) {
  const p = await (await b.newContext({ viewport: { width: W, height: 800 } })).newPage()
  for (const role of [null, 'Patient', 'Hospital']) {
    await p.goto('http://localhost:4173/#/login'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await p.reload()
    if (role) { await p.getByRole('button', { name: new RegExp('^' + role + '$') }).click(); await p.waitForTimeout(1200) }
    for (const path of ['/hospitals/h_lagooncrest', '/find', '/app']) {
      await p.goto('http://localhost:4173/#' + path); await p.waitForTimeout(900)
      const r = await p.evaluate(() => { const W = innerWidth; const out = []; for (const el of document.querySelectorAll('header *, main *')) { const b = el.getBoundingClientRect(); if (b.right > W + 1 && b.width > 0 && !el.closest('.overflow-x-auto, [class*=snap-x]')) out.push(el.tagName + '.' + String(el.className).slice(0, 60) + ' r=' + Math.round(b.right)) } return { sw: document.documentElement.scrollWidth, out: out.slice(0, 3) } })
      if (r.sw > W) console.log(W, role, path, JSON.stringify(r))
    }
  }
}
console.log('done'); await b.close()
