// Medic AI chat checks. Demo build (vite preview on 4173) uses the public provider (intercepted here);
// pass a server URL as argv[2] to test the server's streaming Claude route (mock upstream).
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:4173/'
const SERVER = !!process.argv[2]
const errors = []
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push('pageerror ' + e.message))
let calls = []
if (!SERVER) {
  await p.route('https://text.pollinations.ai/**', async (route) => {
    const j = JSON.parse(route.request().postData())
    calls.push(j)
    const last = j.messages.at(-1).content
    const text = `**Public answer** to: ${last}\n\n- turns ${j.messages.length}\n- system ${j.messages[0].role}`
    const chunks = text.match(/.{1,10}/gs).map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join('') + 'data: [DONE]\n\n'
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: chunks })
  })
}
const step = async (name, fn) => { try { await fn(); console.log('OK', name) } catch (e) { errors.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, e.message.split('\n')[0]) } }
const lastAi = () => p.getByTestId('msg-ai').last()
const tag = SERVER ? 'Server answer' : 'Public answer'

await step('open', async () => { await p.goto(BASE + '#/assistant'); await p.getByTestId('ai-mode').getByText('AI connected').waitFor({ timeout: 8000 }) })
await step('ask + stream + markdown', async () => {
  await p.locator('#ai-input').fill('What helps a headache?'); await p.getByTestId('send').click()
  await lastAi().getByText(tag).waitFor({ timeout: 15000 })
  await lastAi().locator('strong, [role=heading]').first().waitFor()
  await p.getByTestId('regenerate').waitFor()
})
await step('follow-up keeps context', async () => {
  await p.locator('#ai-input').fill('And for children?'); await p.locator('#ai-input').press('Enter')
  await p.getByTestId('msg-ai').nth(1).getByText(SERVER ? 'Turns seen: 3' : 'turns 4').waitFor({ timeout: 15000 })
})
await step('edit resend', async () => {
  await p.getByTestId('msg-user').last().hover(); await p.getByTestId('edit-msg').last().click()
  await p.getByLabel('Edit message').fill('What about adults?'); await p.getByTestId('save-edit').click()
  await lastAi().getByText('What about adults?').waitFor({ timeout: 15000 })
  if (await p.getByTestId('msg-ai').count() !== 2) throw new Error('edit should replace the old answer')
})
await step('regenerate', async () => { await p.getByTestId('regenerate').click(); await lastAi().getByText('What about adults?').waitFor({ timeout: 15000 }) })
await step('history persists', async () => {
  await p.reload(); await p.getByTestId('history-btn').click()
  await p.locator('[data-testid=chat-history]:visible').getByText('What helps a headache?').first().click()
  await p.getByTestId('msg-user').first().waitFor()
  if (await p.getByTestId('msg-user').count() !== 2) throw new Error('history not restored')
})
await step('new chat + ?q', async () => {
  await p.goto(BASE + '#/assistant?q=' + encodeURIComponent('Where can I get an ultrasound scan?'))
  await p.getByTestId('ai-actions').first().waitFor({ timeout: 15000 })
})
await step('no overflow', async () => { const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > w[1] + 1) throw new Error(`overflow ${w}`) })
await p.screenshot({ path: 'qa/shots/ai-chat.png' })
await ctx.setViewportSize?.({ width: 1280, height: 860 })
await p.setViewportSize({ width: 1280, height: 860 }); await p.waitForTimeout(500); await p.screenshot({ path: 'qa/shots/ai-chat-desktop.png' })
if (!SERVER && calls[0] && calls[0].messages[0].role !== 'system') errors.push('system prompt missing for public provider')
await b.close()
console.log(errors.length ? errors.join('\n') : 'ALL AI OK')
process.exit(errors.length ? 1 : 0)
