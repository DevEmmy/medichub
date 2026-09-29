/**
 * Example serverless route for Medic AI outside the Claude viewer (e.g. Vercel: api/ask.ts).
 * Set ANTHROPIC_API_KEY on the server and VITE_AI_ENDPOINT=/api/ask in the web app.
 * The key stays on the server; the browser only sends the chat turns.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length > 24) return new Response('Bad request', { status: 400 })
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.MEDIC_AI_MODEL ?? 'claude-sonnet-4-5', max_tokens: 700, messages }),
  })
  if (!r.ok) return new Response('Upstream error', { status: 502 })
  const j = await r.json()
  const text = (j.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n')
  return Response.json({ text })
}
