// One definition of each operation, run in the right place:
// - standalone demo: runs in the browser against local data
// - with the backend: the browser sends the call to the server, which runs this same code
//   with the caller's verified session and access checks, then returns the result plus
//   fresh rows for every table the call changed.
import { API_URL, BACKEND, IS_BROWSER } from '../config'
import { db, type TableName, type Tables } from './store'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncFn = (...args: any[]) => Promise<any>
export const registry = new Map<string, AsyncFn>()

export class RemoteError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

const TOKEN_KEY = 'medichub.token'
export function getToken(): string | null { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export function setToken(t: string | null) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const t = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new RemoteError('network', 'Could not reach Medic Hub. Check your connection and try again.')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new RemoteError(json?.error?.code ?? 'server', json?.error?.message ?? 'Something went wrong. Please try again.')
  return json as T
}

interface RpcResponse { result: unknown; changes?: Partial<Tables>; session?: { token: string; userId: string; createdAt: string } | null }

/** Hooks the session layer installs (avoids an import cycle with services/core). */
export const rpcHooks = { onSession: (_s: RpcResponse['session']) => {} }

export function rpc<F extends AsyncFn>(name: string, fn: F): F {
  registry.set(name, fn)
  if (!(IS_BROWSER && BACKEND)) return fn
  return (async (...args: unknown[]) => {
    const r = await api<RpcResponse>(`/rpc/${name}`, { args })
    if (r.session !== undefined) rpcHooks.onSession(r.session)
    if (r.changes) db.hydrate(r.changes)
    return r.result
  }) as F
}

export async function syncTables(tables?: TableName[]) {
  const q = tables?.length ? `?tables=${tables.join(',')}` : ''
  const r = await api<{ data: Partial<Tables> }>(`/sync${q}`)
  db.hydrate(r.data)
}
