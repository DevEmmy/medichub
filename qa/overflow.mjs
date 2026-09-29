import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 375, height: 800 } })
const p = await ctx.newPage()
const find = async (label) => {
  const r = await p.evaluate(() => { const W = window.innerWidth; const res = []; document.querySelectorAll('body *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0) { let s = el.tagName.toLowerCase() + '.' + (el.className?.toString?.() || '').slice(0, 80); res.push(`${Math.round(r.right)} ${s} :: ${(el.textContent||'').slice(0,40)}`) } }); return res.slice(0, 8) })
  console.log('---', label); r.forEach((x) => console.log(x))
}
await p.goto('http://localhost:4173/#/login'); await p.getByRole('button', { name: /^Hospital$/ }).click(); await p.waitForURL(/#\/hospital$/); await p.waitForTimeout(800); await find('hdash')
await p.goto('http://localhost:4173/#/first-aid'); await p.waitForTimeout(800); await find('firstaid')
await p.setViewportSize({ width: 320, height: 800 }); await p.goto('http://localhost:4173/#/find'); await p.waitForTimeout(800); await find('find320')
await b.close()
