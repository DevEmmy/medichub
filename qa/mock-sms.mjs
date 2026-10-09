// Stand-in for Africa's Talking SMS API, for automated tests only (AT_BASE_URL=http://localhost:8896).
import { createServer } from 'node:http'
const sent = []
createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c
  if (req.url === '/_sent') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(sent)) }
  if (req.headers.apikey !== 'at_mock') { res.writeHead(401); return res.end('bad key') }
  const f = Object.fromEntries(new URLSearchParams(body)); sent.push(f)
  res.writeHead(201, { 'content-type': 'application/json' }); res.end(JSON.stringify({ SMSMessageData: { Recipients: [{ status: 'Success' }] } }))
}).listen(8896, () => console.log('mock sms on 8896'))
