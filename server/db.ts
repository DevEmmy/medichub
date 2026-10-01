// PostgreSQL persistence for the Medic Hub server.
// DATABASE_URL set  → any PostgreSQL (Neon, Supabase, Render, Railway, RDS…)
// not set           → embedded PostgreSQL (PGlite) stored in ./data — handy for local runs and tests.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TABLE_KEYS, TABLE_ORDER, emptyTables, type TableName, type Tables } from '../src/lib/store'

type Row = Record<string, unknown>
interface Exec { query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }> }
interface Driver extends Exec { tx: (fn: (q: Exec) => Promise<void>) => Promise<void>; close: () => Promise<void>; kind: string }

const here = dirname(fileURLToPath(import.meta.url))
const schemaPath = [join(here, 'db', 'schema.sql'), join(here, '..', 'server', 'db', 'schema.sql')]

const isoTs = (v: string) => {
  const d = new Date(v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
  return isNaN(d.getTime()) ? v : d.toISOString()
}

async function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL
  if (url) {
    const pg = (await import('pg')).default
    pg.types.setTypeParser(1184, isoTs) // timestamptz → ISO string
    pg.types.setTypeParser(1114, isoTs) // timestamp
    pg.types.setTypeParser(1082, (v: string) => v) // date → YYYY-MM-DD
    const ssl = /localhost|127\.0\.0\.1/.test(url) || process.env.PGSSL === 'off' ? undefined : { rejectUnauthorized: false }
    const pool = new pg.Pool({ connectionString: url, ssl, max: 5 })
    return {
      kind: 'postgres',
      query: (sql, params) => pool.query(sql, params as unknown[]),
      tx: async (fn) => {
        const c = await pool.connect()
        try { await c.query('begin'); await fn({ query: (s, p) => c.query(s, p as unknown[]) }); await c.query('commit') }
        catch (e) { await c.query('rollback').catch(() => {}); throw e }
        finally { c.release() }
      },
      close: () => pool.end(),
    }
  }
  if (process.env.NODE_ENV === 'production' && !process.env.PGLITE_DIR) {
    throw new Error('DATABASE_URL is not set. In production Medic Hub needs a PostgreSQL database (e.g. Neon, Render, Supabase).')
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const dir = process.env.PGLITE_DIR ?? join(process.cwd(), 'data', 'pglite')
  const lite = await PGlite.create(dir === ':memory:' ? undefined : dir, {
    parsers: { 1184: (v: string) => isoTs(v), 1114: (v: string) => isoTs(v), 1082: (v: string) => v },
  })
  return {
    kind: `embedded (${dir})`,
    query: (sql, params) => lite.query(sql, params as unknown[]) as Promise<{ rows: Row[] }>,
    tx: async (fn) => { await lite.transaction(async (t) => { await fn({ query: (s, p) => t.query(s, p as unknown[]) as Promise<{ rows: Row[] }> }) }) },
    close: () => lite.close(),
  }
}

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
const q = (c: string) => `"${c}"`

export class Database {
  private d!: Driver
  private columns = new Map<TableName, string[]>()
  private jsonCols = new Map<TableName, Set<string>>()
  private snap = new Map<TableName, Map<string, string>>()
  private chain: Promise<void> = Promise.resolve()
  kind = ''
  failures = 0

  async open() {
    this.d = await connect()
    this.kind = this.d.kind
    const file = schemaPath.find((p) => { try { readFileSync(p); return true } catch { return false } })
    if (!file) throw new Error('schema.sql not found')
    if (this.d.kind === 'postgres') await this.d.query("set time zone 'UTC'")
    for (const stmt of readFileSync(file, 'utf8').split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) {
      await this.d.query(stmt.replace(/^--.*$/gm, '').trim() || 'select 1')
    }
    const cols = await this.d.query("select table_name, column_name, data_type from information_schema.columns where table_schema = current_schema() order by ordinal_position")
    for (const t of TABLE_ORDER) {
      const mine = cols.rows.filter((r) => r.table_name === t)
      this.columns.set(t, mine.map((r) => String(r.column_name)))
      this.jsonCols.set(t, new Set(mine.filter((r) => r.data_type === 'jsonb').map((r) => String(r.column_name))))
    }
  }

  query(sql: string, params?: unknown[]) { return this.d.query(sql, params) }

  async loadAll(): Promise<Tables> {
    const data = emptyTables() as unknown as Record<TableName, Row[]>
    for (const t of TABLE_ORDER) {
      const res = await this.d.query(`select * from ${t}`)
      data[t] = res.rows.map((r) => {
        const o: Row = {}
        for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) o[camel(k)] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && (k === 'fee' || k.endsWith('_cm') || k.endsWith('_kg')) ? Number(v) : v
        return o
      })
      this.snap.set(t, new Map(data[t].map((r) => [String(r[TABLE_KEYS[t]]), JSON.stringify(r)])))
    }
    return data as unknown as Tables
  }

  /** Persist the rows that changed in these tables since the last save. Writes are serialized. */
  persist(all: Tables, tables: TableName[]) {
    const work: { t: TableName; up: Row[]; del: string[] }[] = []
    for (const t of TABLE_ORDER) {
      if (!tables.includes(t)) continue
      const key = TABLE_KEYS[t]
      const prev = this.snap.get(t) ?? new Map<string, string>()
      const next = new Map<string, string>()
      const up: Row[] = []
      for (const r of all[t] as unknown as Row[]) {
        const k = String(r[key]); const j = JSON.stringify(r)
        next.set(k, j)
        if (prev.get(k) !== j) up.push(r)
      }
      const del = [...prev.keys()].filter((k) => !next.has(k))
      this.snap.set(t, next)
      if (up.length || del.length) work.push({ t, up, del })
    }
    if (!work.length) return this.chain
    this.chain = this.chain.then(() => this.d.tx(async (x) => {
      for (const w of [...work].reverse()) if (w.del.length) await x.query(`delete from ${w.t} where ${q(snake(TABLE_KEYS[w.t]))} = any($1)`, [w.del])
      for (const w of work) {
        const cols = this.columns.get(w.t)!; const json = this.jsonCols.get(w.t)!
        const pk = snake(TABLE_KEYS[w.t])
        for (let i = 0; i < w.up.length; i += 200) {
          const chunk = w.up.slice(i, i + 200)
          const params: unknown[] = []
          const values = chunk.map((r) => '(' + cols.map((c) => {
            let v = r[camel(c)]
            if (v === undefined) v = null
            else if (json.has(c)) v = JSON.stringify(v)
            params.push(v)
            return `$${params.length}`
          }).join(',') + ')').join(',')
          const set = cols.filter((c) => c !== pk).map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')
          await x.query(`insert into ${w.t} (${cols.map(q).join(',')}) values ${values} on conflict (${q(pk)}) do update set ${set}`, params)
        }
      }
    })).catch((e) => {
      this.failures++
      console.error('[db] persist failed; rows will be re-sent on the next write', e)
      for (const w of work) this.snap.set(w.t, new Map())
    })
    return this.chain
  }

  flush() { return this.chain }
  close() { return this.d.close() }
}
