import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { db, type TableName, type Tables } from './lib/store'
import { buildSeed, ensureSlots } from './data/seed'
import App from './App'
import { startReminderScheduler } from './services/reminders'
import { API_URL, BACKEND } from './config'
import { api, getToken, setToken, syncTables } from './lib/rpc'
import { accountRules, getSession, payments, setSession } from './services/core'
import { testGateway } from './services/testGateway'

const root = createRoot(document.getElementById('root')!)
const render = () => root.render(<StrictMode><App /></StrictMode>)

function bootError(retry: () => void) {
  root.render(
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
      <div><p style={{ fontSize: 20, fontWeight: 600 }}>Can't reach Medic Hub</p><p style={{ color: '#555', marginTop: 6 }}>Check your internet connection. In an emergency, call the nearest hospital emergency unit.</p>
        <button onClick={retry} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 12, background: '#0A1F1A', color: 'white', border: 0, fontWeight: 600 }}>Try again</button></div>
    </div>,
  )
}

function waking() {
  root.render(
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', background: '#FBF8F1' }} role="status">
      <div><p style={{ fontSize: 22, fontWeight: 700, color: '#06281F' }}>Medic Hub</p><p style={{ color: '#555', marginTop: 8 }}>Waking up the server. The first visit after a quiet spell can take up to a minute.</p>
        <p style={{ color: '#555', marginTop: 4 }}>In an emergency, call the nearest hospital emergency unit or 112.</p></div>
    </div>,
  )
}

async function bootBackend() {
  db.initClient()
  const wake = setTimeout(waking, 2500)
  try {
    const r = await api<{ data: Partial<Tables>; userId: string | null; payments?: 'off' | 'test' | 'live'; simulator?: boolean; rules?: typeof accountRules }>('/sync')
    if (r.rules) Object.assign(accountRules, r.rules)
    // The browser only needs to know how payments behave; the real gateway (simulator or Paystack) runs on the server
    payments.gateway = { ...payments.gateway, mode: r.payments ?? 'off', ...(r.simulator ? { simulator: { complete: () => {} } } : {}) }
    const s = getSession()
    if (!r.userId) { if (s || getToken()) { setToken(null); setSession(null) } }
    else if (!s || s.userId !== r.userId) setSession({ userId: r.userId, createdAt: new Date().toISOString() })
    db.hydrate(r.data)
  } catch { clearTimeout(wake); return bootError(() => { void bootBackend() }) }
  clearTimeout(wake)
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

// Returning from the payment page: Paystack adds ?reference=… to our callback address
{
  const q = new URLSearchParams(location.search)
  const ref = q.get('reference') ?? q.get('trxref')
  if (ref) {
    history.replaceState(null, '', location.pathname + `#/payment/verify?reference=${encodeURIComponent(ref)}`)
  }
}

if (BACKEND) {
  void bootBackend()
} else {
  payments.gateway = testGateway
  db.init(buildSeed, ensureSlots)
  startReminderScheduler()
  render()
}
