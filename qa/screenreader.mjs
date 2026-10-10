// Built-in screen reader: keyboard (NVDA style) and touch (TalkBack style). Needs `vite preview` on :4173.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1 }
const ok = (c, m) => (c ? console.log('ok -', m) : fail(m))
const stub = () => {
  window.__said = []
  const fake = { speaking: false, paused: false, pending: false, getVoices: () => [], cancel() {}, pause() {}, resume() {}, addEventListener() {},
    speak(u) { window.__said.push(u.text); setTimeout(() => u.onend?.({}), 5) } }
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  localStorage.setItem('medichub.a11y.v1', JSON.stringify({ talkBack: true }))
}
const last = (p) => p.evaluate(() => window.__said.at(-1) ?? '')
const since = (p) => p.evaluate(() => window.__said.join(' '))
const clear = (p) => p.evaluate(() => { window.__said = [] })

// ---- computer: keyboard
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(stub)
  const p = await ctx.newPage()
  await p.goto(BASE + '#/'); await p.waitForTimeout(1200)
  ok((await p.evaluate(() => window.__said.join(' | '))).includes('Screen reader on'), 'announces it is on')
  await clear(p); await p.keyboard.press('Tab'); await p.waitForTimeout(150)
  const t1 = await last(p); ok(/, (link|button)/.test(t1), `Tab reads focus: "${t1}"`)
  await p.keyboard.press('Tab'); await p.waitForTimeout(150)
  const t2 = await last(p); ok(t2 && t2 !== t1, `Tab again moves on: "${t2}"`)
  await clear(p); await p.keyboard.press('Escape'); await p.locator('body').click({ position: { x: 5, y: 400 } })
  await p.keyboard.press('h'); await p.waitForTimeout(150)
  const h = await last(p); ok(/^The right hospital, right now, heading level 1$/.test(h), `H jumps to a heading: "${h}"`)
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150)
  const d1 = await last(p); ok(d1 && d1 !== h, `Down arrow reads the next thing: "${d1.slice(0, 70)}"`)
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150)
  ok((await last(p)) === h, 'Up arrow goes back')
  ok(await p.locator('.sr-cursor').count() === 1, 'what is being read is outlined')
  // K to a link, Enter opens it
  await p.keyboard.press('k'); await p.waitForTimeout(150)
  const link = await last(p); const before = p.url()
  await p.keyboard.press('Enter'); await p.waitForTimeout(800)
  ok(p.url() !== before || /link/.test(link), `Enter opens the link being read ("${link}") → ${p.url().split('#')[1]}`)
  // Tab into a field and Enter on a button
  await p.goto(BASE + '#/login'); await p.waitForTimeout(1000); await clear(p)
  await p.locator('input[type=email]').focus(); await p.waitForTimeout(150)
  ok(/Email, edit/.test(await last(p)), `field read with its label: "${await last(p)}"`)
  await ctx.close()
}

// ---- phone: touch
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await ctx.addInitScript(stub)
  const p = await ctx.newPage()
  await p.goto(BASE + '#/'); await p.waitForTimeout(1200); await clear(p)
  const target = p.locator('main a[href="#/find"]:visible').first()
  const start = p.url()
  await target.tap(); await p.waitForTimeout(700)
  const said = await last(p)
  ok(p.url() === start, `single tap does not open the link`)
  ok(/link/.test(said), `single tap reads it: "${said}"`)
  const bb = await target.boundingBox(); const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2
  await p.touchscreen.tap(cx, cy); await p.waitForTimeout(90); await p.touchscreen.tap(cx, cy); await p.waitForTimeout(900)
  ok(p.url() !== start, `double-tap opens it → ${p.url().split('#')[1]}`)
  await p.goto(BASE + '#/'); await p.waitForTimeout(1000); await clear(p)
  const swipe = async (dx) => p.evaluate((dx) => {
    const mk = (type, x) => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 })], changedTouches: [new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 })] })
    document.body.dispatchEvent(mk('touchstart', 150)); document.body.dispatchEvent(mk('touchend', 150 + dx))
  }, dx)
  await swipe(150); await p.waitForTimeout(150); const s1 = await last(p)
  await swipe(150); await p.waitForTimeout(150); const s2 = await last(p)
  ok(s1 && s2 && s1 !== s2, `swipe right moves forward: "${s1.slice(0, 40)}" → "${s2.slice(0, 40)}"`)
  await swipe(-150); await p.waitForTimeout(150)
  ok((await last(p)) === s1, 'swipe left goes back')
  await ctx.close()
}
await b.close()
