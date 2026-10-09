// Stand-in for the Anthropic Messages streaming API, for automated tests only (ANTHROPIC_BASE_URL=http://localhost:8898).
import { createServer } from 'node:http'
createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c
  const j = JSON.parse(body || '{}')
  if (req.headers['x-api-key'] !== 'sk-ant-mock') { res.writeHead(401); return res.end('{}') }
  const last = j.messages.at(-1).content
  const answer = `## Server answer\n\nYou said: **${last}**. Turns seen: ${j.messages.length}. System ok: ${String(j.system || '').includes('Medic AI')}.\n\n1. First step\n2. Second step`
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  res.write('event: message_start\ndata: {"type":"message_start"}\n\n')
  for (const piece of answer.match(/.{1,12}/gs)) { res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: piece } })}\n\n`); await new Promise((r) => setTimeout(r, 15)) }
  res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n'); res.end()
}).listen(8898, () => console.log('mock ai on 8898'))
