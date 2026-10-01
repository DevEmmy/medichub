import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { db, type TableName, type Tables } from './lib/store'
import { buildSeed, ensureSlots } from './data/seed'
import App from './App'
import { startReminderScheduler } from './services/reminders'
import { API_URL, BACKEND } from './config'
import { api, getToken, setToken, syncTables } from './lib/rpc'
import { getSession, setSession } from './services/core'

const root = createRoot(document.getElementById('root')!)
const render = () => root.render(<StrictMode><App /></StrictMode>)

function bootError(retry: () => void) {
  root.render(
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
      <div><p style={{ fontSize: 20, fontWeight: 600 }}>Can't reach Medic Hub</p><p style={{ color: '#555', marginTop: 6 }}>Check your internet connection. In an emergency, call 112.</p>
        <button onClick={retry} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 12, background: '#0A1F1A', color: 'white', border: 0, fontWeight: 600 }}>Try again</button></div>
    </div>,
  )
}

async function bootBackend() {
  db.initClient()
  try {
    const r = await api<{ data: Partial<Tables>; userId: string | null }>('/sync')
    const s = getSession()
    if (!r.userId) { if (s || getToken()) { setToken(null); setSession(null) } }
    else if (!s || s.userId !== r.userId) setSession({ userId: r.userId, createdAt: new Date().toISOString() })
    db.hydrate(r.data)
  } catch { return bootError(() => { void bootBackend() }) }
  render()
  // Realtime: the server says which tables changed; we re-fetch only what this user may see.
  let queued = new Set<TableName>(); let t: ReturnType<typeof setTimeout> | null = null
  const connect = () => {
    const es = new EventSource(`${API_URL}/api/events`)
    let dropped = false
    es.addEventListener('change', (e) => {
      try { (JSON.parse((e as MessageEvent).data) as TableName[]).forEach((x) => queued.add(x)) } catch { return }
      if (t) return
      t = setTimeout(() => { const tables = [...queued]; queued = new Set(); t = null; syncTables(tables).catch(() => {}) }, 150)
    })
    es.onerror = () => { dropped = true }
    es.onopen = () => { if (dropped) { dropped = false; syncTables().catch(() => {}) } }
  }
  connect()
  window.addEventListener('online', () => { syncTables().catch(() => {}) })
}

if (BACKEND) {
  void bootBackend()
} else {
  db.init(buildSeed, ensureSlots)
  startReminderScheduler()
  render()
}
