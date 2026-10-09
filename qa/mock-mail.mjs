// Stand-in for the Resend email API, for automated tests only (RESEND_BASE_URL=http://localhost:8897).
import { createServer } from 'node:http'
const sent = []
createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c
  if (req.url === '/_sent') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(sent)) }
  if (req.headers.authorization !== 'Bearer re_mock') { res.writeHead(401); return res.end('{"message":"bad key"}') }
  const j = JSON.parse(body); sent.push(j)
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: 'em_' + sent.length }))
}).listen(8897, () => console.log('mock mail on 8897'))
