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
import { AppError, mailer, sessionRuntime } from '../src/services/core'
import { hashPasswordStrong } from '../src/lib/ids'
import { buildSeed, ensureSlots } from '../src/data/seed'
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

const PORT = Number(process.env.PORT ?? 8787)
const SESSION_DAYS = 30
const STATIC_DIR = process.env.STATIC_DIR ?? join(process.cwd(), 'dist')
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const PUBLIC_RPCS = new Set(['auth.signIn', 'auth.signUp', 'auth.requestPasswordReset', 'auth.resetPassword'])

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

async function handleAsk(req: IncomingMessage, res: ServerResponse) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return send(res, 503, { error: { code: 'unavailable', message: 'Medic AI is not configured on this server.' } })
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '')
  if (limited(`${ip}:ask`, 20)) return send(res, 429, { error: { code: 'rate_limited', message: 'Too many questions at once. Wait a minute.' } })
  const { messages, system } = (await body(req, 200_000)) as { messages?: { role: string; content: string }[]; system?: string }
  if (!Array.isArray(messages) || !messages.length || messages.length > 24) return send(res, 400, { error: { code: 'bad_request', message: 'Invalid question.' } })
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.MEDIC_AI_MODEL ?? 'claude-sonnet-4-5', max_tokens: 800, system: typeof system === 'string' ? system.slice(0, 8000) : undefined, messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) })) }),
  })
  if (!r.ok) { console.error('[ask] upstream', r.status, await r.text().catch(() => '')); return send(res, 502, { error: { code: 'upstream', message: 'Medic AI is unavailable right now.' } }) }
  const j = (await r.json()) as { content?: { type: string; text?: string }[] }
  send(res, 200, { text: (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n') })
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
      return send(res, 200, { data: visibleData(a?.session.userId ?? null, only), userId: a?.session.userId ?? null })
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
  db.initServer(data, {
    onWrite: (tables) => {
      const c = als.getStore(); if (c) tables.forEach((t) => c.changed.add(t))
      database.persist(db.all(), tables)
      broadcast(tables)
    },
  }, ensureSlots)
  if (fresh && process.env.SEED_DEMO === '1') database.persist(db.all(), Object.keys(emptyTables()) as TableName[])

  // First reviewer account comes from the environment (there is no public sign-up for reviewers).
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && !db.select('users').some((u) => u.email === adminEmail)) {
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 10) throw new Error('Set ADMIN_PASSWORD (10+ characters) to create the reviewer account.')
    const passwordHash = await hashPasswordStrong(process.env.ADMIN_PASSWORD)
    db.write(['users'], (d) => { d.users.push({ id: 'u_admin_' + randomBytes(5).toString('hex'), email: adminEmail, passwordHash, role: 'admin', name: process.env.ADMIN_NAME ?? 'Medic Hub Reviewer', createdAt: new Date().toISOString() }) })
    console.log(`[boot] created reviewer account ${adminEmail}`)
  }

  const rows = await database.query('select token_hash, user_id, created_at, expires_at from sessions where expires_at > now()')
  for (const r of rows.rows) sessions.set(String(r.token_hash), { userId: String(r.user_id), createdAt: String(r.created_at), expiresAt: new Date(String(r.expires_at)).getTime() })
  await database.query('delete from sessions where expires_at <= now()')

  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    mailer.enabled = true
    mailer.appUrl = (process.env.APP_URL ?? '').replace(/\/?$/, '/')
    mailer.send = async (m) => {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.MAIL_FROM, to: m.to, subject: m.subject, text: m.text }) })
      if (!r.ok) throw new Error(`email failed: ${r.status} ${await r.text().catch(() => '')}`)
    }
  }
  await database.flush()
  startReminderScheduler()
  server.listen(PORT, () => console.log(`[boot] Medic Hub on :${PORT} · database: ${database.kind} · email: ${mailer.enabled ? 'on' : 'off'} · AI: ${process.env.ANTHROPIC_API_KEY ? 'on' : 'off'} · ${db.select('hospitals').length} hospitals`))
}

const shutdown = async () => { await database.flush().catch(() => {}); await database.close().catch(() => {}); process.exit(0) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
main().catch((e) => { console.error(e); process.exit(1) })
