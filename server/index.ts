// Medic Hub server: API + realtime + scheduled jobs + the web app, in one Node process.
//
//   POST /api/rpc/:name   run an operation (bookings, status updates, reviews…) as the signed-in user
//   GET  /api/sync        the rows this user may see (all tables, or ?tables=a,b)
//   GET  /api/events      Server-Sent Events: which tables changed, so open apps refresh instantly
//   POST /api/logout      end this session
//   POST /api/ask         Medic AI (needs ANTHROPIC_API_KEY)
//   GET  /api/health      liveness + database status
//   everything else       the built web app (dist/)
process.env.TZ = process.env.TZ || 'Africa/Lagos'

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { Database } from './db'
import { visibleData } from './policy'
import { db, emptyTables, type TableName } from '../src/lib/store'
import { registry } from '../src/lib/rpc'
import { AppError, mailer, payments, sessionRuntime, smsGateway } from '../src/services/core'
import { handleSms, handleUssd } from '../src/services/phone'
import { hashPasswordStrong } from '../src/lib/ids'
import { buildPublicDirectory, buildSeed, ensureSlots } from '../src/data/seed'
import { startReminderScheduler } from '../src/services/reminders'
import type { Session } from '../src/types'
// Register every operation
import '../src/services/auth'
import '../src/services/bookings'
import '../src/services/health'
import '../src/services/hospitals'
import '../src/services/notifications'
import '../src/services/plans'
import '../src/services/reminders'
import '../src/services/reviews'
import { settleReference } from '../src/services/payments'
import { paystackGateway, validWebhookSignature } from './paystack'

const PORT = Number(process.env.PORT ?? 8787)
const SESSION_DAYS = 30
const STATIC_DIR = process.env.STATIC_DIR ?? join(process.cwd(), 'dist')
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const PUBLIC_RPCS = new Set(['auth.signIn', 'auth.signUp', 'auth.requestPasswordReset', 'auth.resetPassword', 'auth.verifyEmail', 'bookings.verifyPass', 'payments.confirmPayment'])

interface Ctx { session: Session | null; sessionChanged: boolean; changed: Set<TableName> }
const als = new AsyncLocalStorage<Ctx>()
sessionRuntime.get = () => als.getStore()?.session ?? null
sessionRuntime.set = (s) => { const c = als.getStore(); if (c) { c.session = s; c.sessionChanged = true } }

const database = new Database()
const sessions = new Map<string, { userId: string; createdAt: string; expiresAt: number }>()
const sha = (t: string) => createHash('sha256').update(t).digest('hex')

// ---------------- realtime ----------------
const streams = new Set<ServerResponse>()
let pending = new Set<TableName>()
let flushTimer: NodeJS.Timeout | null = null
function broadcast(tables: TableName[]) {
  tables.forEach((t) => pending.add(t))
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    const msg = `event: change\ndata: ${JSON.stringify([...pending])}\n\n`
    pending = new Set(); flushTimer = null
    for (const s of streams) s.write(msg)
  }, 120)
}

// ---------------- helpers ----------------
function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}
function cors(req: IncomingMessage, res: ServerResponse) {
  const o = req.headers.origin
  if (o && (ORIGINS.includes('*') || ORIGINS.includes(o))) {
    res.setHeader('Access-Control-Allow-Origin', o)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }
}
async function body(req: IncomingMessage, limit = 8 * 1024 * 1024): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0
  for await (const c of req) { size += (c as Buffer).length; if (size > limit) throw new AppError('too_large', 'That upload is too large.'); chunks.push(c as Buffer) }
  if (!size) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new AppError('bad_request', 'Invalid request.') }
}
function authed(req: IncomingMessage, url: URL): { token: string; session: Session } | null {
  const h = req.headers.authorization
  const token = h?.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token')
  if (!token) return null
  const s = sessions.get(sha(token))
  if (!s || s.expiresAt < Date.now()) return null
  if (!db.select('users').some((u) => u.id === s.userId)) return null
  return { token, session: { userId: s.userId, createdAt: s.createdAt } }
}
async function issueSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const createdAt = new Date().toISOString()
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000
  sessions.set(sha(token), { userId, createdAt, expiresAt })
  await database.query('insert into sessions (token_hash, user_id, created_at, expires_at) values ($1, $2, $3, $4)', [sha(token), userId, createdAt, new Date(expiresAt).toISOString()])
  return { token, userId, createdAt }
}
const hits = new Map<string, { n: number; at: number }>()
function limited(key: string, max: number, windowMs = 60_000) {
  const now = Date.now(); const h = hits.get(key)
  if (!h || now - h.at > windowMs) { hits.set(key, { n: 1, at: now }); return false }
  h.n++; return h.n > max
}
const STATUS: Record<string, number> = { auth: 401, forbidden: 403, not_found: 404, conflict: 409, exists: 409, too_large: 413, rate_limited: 429 }

// ---------------- routes ----------------
async function handleRpc(req: IncomingMessage, res: ServerResponse, name: string, url: URL) {
  const fn = registry.get(name)
  if (!fn) return send(res, 404, { error: { code: 'not_found', message: 'Unknown operation.' } })
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
  if (PUBLIC_RPCS.has(name) && limited(`${ip}:${name}`, 10)) return send(res, 429, { error: { code: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' } })
  const auth = authed(req, url)
  if (!auth && !PUBLIC_RPCS.has(name)) return send(res, 401, { error: { code: 'auth', message: 'Please sign in to continue.' } })
  const { args } = (await body(req)) as { args?: unknown[] }
  const ctx: Ctx = { session: auth?.session ?? null, sessionChanged: false, changed: new Set() }
  try {
    const result = await als.run(ctx, () => fn(...(Array.isArray(args) ? args : [])))
    await database.flush()
    let session: Awaited<ReturnType<typeof issueSession>> | null | undefined
    if (ctx.sessionChanged) {
      if (auth) { sessions.delete(sha(auth.token)); await database.query('delete from sessions where token_hash = $1', [sha(auth.token)]) }
      session = ctx.session ? await issueSession(ctx.session.userId) : null
    }
    const viewer = ctx.sessionChanged ? (ctx.session?.userId ?? null) : (auth?.session.userId ?? null)
    const changes = ctx.sessionChanged ? visibleData(viewer) : visibleData(viewer, [...ctx.changed])
    send(res, 200, { result: result ?? null, changes, ...(session !== undefined ? { session } : {}) })
  } catch (e) {
    if (e instanceof AppError) return send(res, STATUS[e.code] ?? 400, { error: { code: e.code, message: e.message } })
    console.error(`[rpc ${name}]`, e)
    send(res, 500, { error: { code: 'server', message: 'Something went wrong on our side. Please try again.' } })
  }
}

/**
 * Medic AI. Streams the answer back as Server-Sent Events: `data: {"t":"…"}` chunks, then `data: [DONE]`.
 * Providers: ANTHROPIC_API_KEY (Claude), or any OpenAI-compatible API via AI_API_KEY + AI_BASE_URL + AI_MODEL
 * (Groq, OpenRouter, OpenAI, Together…). Keys stay on the server.
 */
/** Reads a form (Africa's Talking posts application/x-www-form-urlencoded) or JSON body as plain fields. */
async function fields(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = []; let size = 0
  for await (const c of req) { size += (c as Buffer).length; if (size > 64 * 1024) throw new AppError('too_large', 'Too large.'); chunks.push(c as Buffer) }
  const raw = Buffer.concat(chunks).toString('utf8')
  if ((req.headers['content-type'] ?? '').includes('json')) { try { return JSON.parse(raw || '{}') } catch { return {} } }
  return Object.fromEntries(new URLSearchParams(raw))
}
/** Optional shared secret on the phone webhooks: set PHONE_WEBHOOK_KEY and add ?key=… to the callback URLs. */
const phoneKeyOk = (url: URL) => !process.env.PHONE_WEBHOOK_KEY || url.searchParams.get('key') === process.env.PHONE_WEBHOOK_KEY
const sendSmsSafe = (to: string, message: string) => {
  if (smsGateway.enabled) smsGateway.send(to, message).catch((e) => console.error('[sms] send failed', e))
  else console.log(`[sms] (not configured) to ${to}: ${message.slice(0, 120)}`)
}

async function handleAsk(req: IncomingMessage, res: ServerResponse) {
  const anthropic = process.env.ANTHROPIC_API_KEY
  const compatKey = process.env.AI_API_KEY
  if (!anthropic && !compatKey) return send(res, 503, { error: { code: 'unavailable', message: 'Medic AI is not configured on this server.' } })
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
  if (limited(`${ip}:ask`, 20)) return send(res, 429, { error: { code: 'rate_limited', message: 'Too many questions at once. Wait a minute.' } })
  const { messages, system, stream } = (await body(req, 200_000)) as { messages?: { role: string; content: string }[]; system?: string; stream?: boolean }
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) return send(res, 400, { error: { code: 'bad_request', message: 'Invalid question.' } })
  const msgs = messages.slice(-24).map((m) => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: String(m.content ?? '').slice(0, 6000) })).filter((m) => m.content.trim())
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  if (!msgs.length) return send(res, 400, { error: { code: 'bad_request', message: 'Invalid question.' } })
  const sys = typeof system === 'string' ? system.slice(0, 8000) : undefined
  const ctl = new AbortController()
  res.on('close', () => { if (!res.writableFinished) ctl.abort() })

  let upstream: Response
  try {
    upstream = anthropic
      ? await fetch(`${(process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': anthropic, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.MEDIC_AI_MODEL ?? 'claude-sonnet-4-5', max_tokens: 1500, system: sys, messages: msgs, stream: true }),
      })
      : await fetch(`${(process.env.AI_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${compatKey}` },
        body: JSON.stringify({ model: process.env.AI_MODEL ?? 'llama-3.3-70b-versatile', max_tokens: 1500, stream: true, messages: [...(sys ? [{ role: 'system', content: sys }] : []), ...msgs] }),
      })
  } catch (e) { console.error('[ask] network', e); return send(res, 502, { error: { code: 'upstream', message: 'Medic AI is unavailable right now.' } }) }
  if (!upstream.ok || !upstream.body) {
    console.error('[ask] upstream', upstream.status, await upstream.text().catch(() => ''))
    return send(res, upstream.status === 429 ? 429 : 502, { error: { code: upstream.status === 429 ? 'rate_limited' : 'upstream', message: upstream.status === 429 ? 'Medic AI is busy. Try again in a minute.' : 'Medic AI is unavailable right now.' } })
  }

  // Pull text deltas out of either provider's event stream
  const deltas = async function* () {
    const reader = upstream.body!.getReader(); const dec = new TextDecoder(); let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
        if (!line.startsWith('data:')) continue
        const d = line.slice(5).trim()
        if (!d || d === '[DONE]') continue
        try {
          const j = JSON.parse(d)
          if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') yield String(j.delta.text)
          else if (j.type === 'error') throw new Error(j.error?.message ?? 'stream error')
          else if (j.choices?.[0]?.delta?.content) yield String(j.choices[0].delta.content)
        } catch (e) { if (e instanceof SyntaxError) continue; throw e }
      }
    }
  }

  if (!stream) {
    let text = ''
    try { for await (const t of deltas()) text += t } catch (e) { console.error('[ask]', e) }
    return send(res, text ? 200 : 502, text ? { text } : { error: { code: 'upstream', message: 'Medic AI is unavailable right now.' } })
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  try {
    for await (const t of deltas()) res.write(`data: ${JSON.stringify({ t })}\n\n`)
    res.write('data: [DONE]\n\n')
  } catch (e) {
    if (!ctl.signal.aborted) { console.error('[ask] stream', e); res.write(`data: ${JSON.stringify({ error: 'Medic AI was interrupted.' })}\n\n`) }
  }
  res.end()
}

const DOC_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
async function uploadFile(req: IncomingMessage, res: ServerResponse, url: URL) {
  const a = authed(req, url)
  if (!a) return send(res, 401, { error: { code: 'auth', message: 'Please sign in to continue.' } })
  const u = db.select('users').find((x) => x.id === a.session.userId)
  if (u?.role !== 'hospital') return send(res, 403, { error: { code: 'forbidden', message: 'Only hospital accounts upload documents.' } })
  const mime = String(req.headers['content-type'] ?? '').split(';')[0]
  if (!DOC_TYPES.has(mime)) return send(res, 415, { error: { code: 'unsupported', message: 'Upload a PDF, JPG or PNG.' } })
  if (limited(`${u.id}:upload`, 30)) return send(res, 429, { error: { code: 'rate_limited', message: 'Too many uploads. Wait a minute.' } })
  const chunks: Buffer[] = []; let size = 0
  for await (const c of req) { size += (c as Buffer).length; if (size > 10 * 1024 * 1024) return send(res, 413, { error: { code: 'too_large', message: 'Upload a file under 10 MB.' } }); chunks.push(c as Buffer) }
  if (!size) return send(res, 400, { error: { code: 'bad_request', message: 'Empty file.' } })
  const id = 'f_' + randomBytes(12).toString('hex')
  const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'document')).slice(0, 200)
  await database.query('insert into files (id, owner_user_id, name, mime, size, data) values ($1, $2, $3, $4, $5, $6)', [id, u.id, name, mime, size, Buffer.concat(chunks)])
  send(res, 200, { id })
}
async function downloadFile(res: ServerResponse, id: string, url: URL, req: IncomingMessage) {
  const a = authed(req, url)
  if (!a) return send(res, 401, { error: { code: 'auth', message: 'Please sign in to continue.' } })
  const r = await database.query('select owner_user_id, name, mime, data from files where id = $1', [id])
  const f = r.rows[0]
  if (!f) return send(res, 404, { error: { code: 'not_found', message: 'File not found.' } })
  const u = db.select('users').find((x) => x.id === a.session.userId)
  const doc = db.select('hospital_documents').find((d) => d.fileId === id)
  const staff = doc && db.select('hospital_staff').some((s) => s.userId === u?.id && s.hospitalId === doc.hospitalId)
  if (!(u?.role === 'admin' || f.owner_user_id === u?.id || staff)) return send(res, 403, { error: { code: 'forbidden', message: 'You cannot open this file.' } })
  res.writeHead(200, { 'Content-Type': String(f.mime), 'Content-Disposition': `inline; filename="${String(f.name).replace(/"/g, '')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(Buffer.from(f.data as Uint8Array))
}

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain' }
async function serveStatic(res: ServerResponse, path: string) {
  const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '')
  let file = join(STATIC_DIR, safe)
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html') } catch { file = join(STATIC_DIR, 'index.html') }
  try {
    const data = await readFile(file)
    const immutable = file.includes(`${join('assets', '')}`)
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN',
    })
    res.end(data)
  } catch { res.writeHead(404); res.end('Not found') }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  cors(req, res)
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  try {
    if (url.pathname.startsWith('/api/rpc/') && req.method === 'POST') return await handleRpc(req, res, url.pathname.slice(9), url)
    if (url.pathname === '/api/sync') {
      const a = authed(req, url)
      const only = url.searchParams.get('tables')?.split(',').filter(Boolean) as TableName[] | undefined
      return send(res, 200, { data: visibleData(a?.session.userId ?? null, only), userId: a?.session.userId ?? null, payments: payments.gateway.mode })
    }
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      res.write('retry: 3000\n\n')
      streams.add(res)
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
      req.on('close', () => { clearInterval(ping); streams.delete(res) })
      return
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      const a = authed(req, url)
      if (a) { sessions.delete(sha(a.token)); await database.query('delete from sessions where token_hash = $1', [sha(a.token)]) }
      return send(res, 200, { ok: true })
    }
    if (url.pathname === '/api/ask' && req.method === 'POST') return await handleAsk(req, res)
    if (url.pathname === '/api/ussd' && req.method === 'POST') {
      if (!phoneKeyOk(url)) return send(res, 403, { error: { code: 'forbidden', message: 'Bad key' } })
      const f = await fields(req)
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
      if (limited(`${ip}:ussd`, 600)) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('END Busy. Try again shortly.') }
      const ctx: Ctx = { session: null, sessionChanged: false, changed: new Set() }
      const r = await als.run(ctx, () => handleUssd({ phone: f.phoneNumber ?? f.phone ?? '', text: f.text ?? '' })).catch((e) => { console.error('[ussd]', e); return { reply: 'END Sorry, something went wrong. Please try again.', sms: [] as string[] } })
      await database.flush()
      for (const m of r.sms) sendSmsSafe(f.phoneNumber ?? f.phone ?? '', m)
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(r.reply)
    }
    if (url.pathname === '/api/sms/incoming' && req.method === 'POST') {
      if (!phoneKeyOk(url)) return send(res, 403, { error: { code: 'forbidden', message: 'Bad key' } })
      const f = await fields(req)
      const from = f.from ?? f.phone ?? ''
      if (!from) return send(res, 400, { error: { code: 'bad_request', message: 'Missing sender' } })
      if (limited(`${from}:sms`, 30)) return send(res, 200, { ok: true })
      const ctx: Ctx = { session: null, sessionChanged: false, changed: new Set() }
      const reply = await als.run(ctx, () => handleSms({ phone: from, text: f.text ?? '' })).catch((e) => { console.error('[sms in]', e); return 'Medic Hub: sorry, something went wrong. Please try again.' })
      await database.flush()
      sendSmsSafe(from, reply)
      return send(res, 200, { ok: true, reply: process.env.NODE_ENV === 'production' ? undefined : reply })
    }
    if (url.pathname === '/api/paystack/webhook' && req.method === 'POST') {
      const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer)
      const raw = Buffer.concat(chunks)
      if (!validWebhookSignature(raw, req.headers['x-paystack-signature'] as string | undefined)) return send(res, 401, { error: { code: 'auth', message: 'Bad signature' } })
      let evt: { event?: string; data?: { reference?: string } } = {}
      try { evt = JSON.parse(raw.toString('utf8')) } catch { return send(res, 400, { error: { code: 'bad_request', message: 'Invalid JSON' } }) }
      if (evt.event === 'charge.success' && evt.data?.reference) {
        // Re-verify with Paystack rather than trusting the webhook body alone
        const ctx: Ctx = { session: null, sessionChanged: false, changed: new Set() }
        await als.run(ctx, () => settleReference(evt.data!.reference!)).catch((e) => console.error('[webhook]', e))
        await database.flush()
      }
      return send(res, 200, { ok: true })
    }
    if (url.pathname === '/api/files' && req.method === 'POST') return await uploadFile(req, res, url)
    if (url.pathname.startsWith('/api/files/') && req.method === 'GET') return await downloadFile(res, url.pathname.slice(11), url, req)
    if (url.pathname === '/api/health') return send(res, 200, { ok: database.failures === 0, database: database.kind, persistFailures: database.failures, hospitals: db.select('hospitals').length, users: db.select('users').length })
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: { code: 'not_found', message: 'Not found.' } })
    return await serveStatic(res, url.pathname)
  } catch (e) {
    if (e instanceof AppError) return send(res, STATUS[e.code] ?? 400, { error: { code: e.code, message: e.message } })
    console.error(e)
    send(res, 500, { error: { code: 'server', message: 'Something went wrong on our side.' } })
  }
})

async function main() {
  await database.open()
  let data = await database.loadAll()
  const fresh = !data.users.length
  if (fresh && process.env.SEED_DEMO === '1') { data = buildSeed(); console.log('[boot] empty database: loaded demo data (SEED_DEMO=1)') }
  else if (fresh && process.env.SEED_PUBLIC !== '0') { data = buildPublicDirectory(); console.log(`[boot] empty database: loaded ${data.hospitals.length} real hospitals from public records`) }
  db.initServer(data, {
    onWrite: (tables) => {
      const c = als.getStore(); if (c) tables.forEach((t) => c.changed.add(t))
      database.persist(db.all(), tables)
      broadcast(tables)
    },
  }, ensureSlots)
  if (fresh && data.hospitals.length) database.persist(db.all(), Object.keys(emptyTables()) as TableName[])

  // First reviewer account comes from the environment (there is no public sign-up for reviewers).
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && !db.select('users').some((u) => u.email === adminEmail)) {
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 10) throw new Error('Set ADMIN_PASSWORD (10+ characters) to create the reviewer account.')
    const passwordHash = await hashPasswordStrong(process.env.ADMIN_PASSWORD)
    db.write(['users'], (d) => { d.users.push({ id: 'u_admin_' + randomBytes(5).toString('hex'), email: adminEmail, passwordHash, role: 'admin', name: process.env.ADMIN_NAME ?? 'Medic Hub Reviewer', emailVerifiedAt: new Date().toISOString(), createdAt: new Date().toISOString() }) })
    console.log(`[boot] created reviewer account ${adminEmail}`)
  }

  const rows = await database.query('select token_hash, user_id, created_at, expires_at from sessions where expires_at > now()')
  for (const r of rows.rows) sessions.set(String(r.token_hash), { userId: String(r.user_id), createdAt: String(r.created_at), expiresAt: new Date(String(r.expires_at)).getTime() })
  await database.query('delete from sessions where expires_at <= now()')

  // Email: Gmail / any SMTP (SMTP_USER + SMTP_PASS), or Resend (RESEND_API_KEY + MAIL_FROM)
  const appUrl = (process.env.APP_URL ?? '').replace(/\/?$/, '/')
  const fromAddr = (name?: string, addr = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '') => {
    const bare = addr.replace(/^.*<([^>]+)>.*$/, '$1')
    return name ? `"${name.replace(/["\r\n]/g, '')} via Medic Hub" <${bare}>` : addr.includes('<') ? addr : `"Medic Hub" <${bare}>`
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = (await import('nodemailer')).default
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com', port: Number(process.env.SMTP_PORT ?? 465), secure: (process.env.SMTP_PORT ?? '465') === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    mailer.enabled = true; mailer.appUrl = appUrl
    mailer.send = async (m) => { await transport.sendMail({ from: fromAddr(m.fromName), to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: m.replyTo }) }
  } else if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    mailer.enabled = true; mailer.appUrl = appUrl
    mailer.send = async (m) => {
      const r = await fetch(`${process.env.RESEND_BASE_URL ?? 'https://api.resend.com'}/emails`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: fromAddr(m.fromName), to: m.to, subject: m.subject, text: m.text, html: m.html, reply_to: m.replyTo }) })
      if (!r.ok) throw new Error(`email failed: ${r.status} ${await r.text().catch(() => '')}`)
    }
  }
  // SMS: Africa's Talking (works on all Nigerian networks). AT_USERNAME "sandbox" uses their free test simulator.
  if (process.env.AT_USERNAME && process.env.AT_API_KEY) {
    const base = process.env.AT_BASE_URL ?? (process.env.AT_USERNAME === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com')
    smsGateway.enabled = true
    smsGateway.send = async (to, message) => {
      const form = new URLSearchParams({ username: process.env.AT_USERNAME!, to, message })
      if (process.env.AT_SENDER_ID) form.set('from', process.env.AT_SENDER_ID)
      const r = await fetch(`${base}/version1/messaging`, { method: 'POST', headers: { apiKey: process.env.AT_API_KEY!, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
      if (!r.ok) throw new Error(`sms failed: ${r.status} ${await r.text().catch(() => '')}`)
    }
  }
  if (process.env.PAYSTACK_SECRET_KEY) {
    payments.gateway = paystackGateway()
    payments.callbackUrl = (process.env.APP_URL ?? '').replace(/\/?$/, '/') + '?paystack=1'
    if (!process.env.APP_URL) console.warn('[boot] set APP_URL so Paystack can send patients back after paying')
  }
  await database.flush()
  startReminderScheduler()
  server.listen(PORT, () => console.log(`[boot] Medic Hub on :${PORT} · database: ${database.kind} · email: ${mailer.enabled ? 'on' : 'off'} · AI: ${process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY ? 'on' : 'off'} · sms: ${smsGateway.enabled ? 'on' : 'off'} · payments: ${payments.gateway.mode} · ${db.select('hospitals').length} hospitals`))
}

const shutdown = async () => { await database.flush().catch(() => {}); await database.close().catch(() => {}); process.exit(0) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
main().catch((e) => { console.error(e); process.exit(1) })
