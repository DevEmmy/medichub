/**
 * Medic Hub local data engine.
 *
 * A small relational store that mirrors the PostgreSQL schema in /server/db/schema.sql.
 * - Persists to localStorage (per browser)
 * - Broadcasts every write to other open tabs (BroadcastChannel + storage event)
 *   so hospital updates appear instantly on patient screens — the same contract
 *   Supabase Realtime provides in production.
 * - All reads/writes go through /src/services, which enforce the access policies
 *   that Row Level Security enforces on the server.
 */
import type {
  User, PatientProfile, Hospital, HospitalStaff, Department, Service, Doctor, HospitalStatus, HospitalCapacity,
  Slot, Booking, BookingEvent, HealthProfile, HealthEvent, EmergencyContact, Notification, Announcement,
  HospitalDocument, PasswordReset, Review, Payment, HospitalPayout,
} from '../types'

export interface Tables {
  users: User[]
  patient_profiles: PatientProfile[]
  hospitals: Hospital[]
  hospital_staff: HospitalStaff[]
  hospital_departments: Department[]
  hospital_services: Service[]
  hospital_doctors: Doctor[]
  hospital_status: HospitalStatus[]
  hospital_capacity: HospitalCapacity[]
  hospital_slots: Slot[]
  bookings: Booking[]
  booking_events: BookingEvent[]
  health_profiles: HealthProfile[]
  health_events: HealthEvent[]
  emergency_contacts: EmergencyContact[]
  notifications: Notification[]
  hospital_announcements: Announcement[]
  hospital_documents: HospitalDocument[]
  password_resets: PasswordReset[]
  hospital_reviews: Review[]
  payments: Payment[]
  hospital_payouts: HospitalPayout[]
}
export type TableName = keyof Tables

/** Primary key per table (rows without an `id` are keyed by their owner). */
export const TABLE_KEYS: Record<TableName, string> = {
  users: 'id', patient_profiles: 'userId', hospitals: 'id', hospital_staff: 'id', hospital_departments: 'id',
  hospital_services: 'id', hospital_doctors: 'id', hospital_status: 'hospitalId', hospital_capacity: 'hospitalId',
  hospital_slots: 'id', bookings: 'id', booking_events: 'id', health_profiles: 'userId', health_events: 'id',
  emergency_contacts: 'id', notifications: 'id', hospital_announcements: 'id', hospital_documents: 'id',
  password_resets: 'token', hospital_reviews: 'id', payments: 'id', hospital_payouts: 'hospitalId',
}
/** Parent tables first, so inserts respect foreign keys (deletes run in reverse). */
export const TABLE_ORDER: TableName[] = [
  'users', 'patient_profiles', 'hospitals', 'hospital_staff', 'hospital_departments', 'hospital_services', 'hospital_doctors',
  'hospital_status', 'hospital_capacity', 'hospital_slots', 'bookings', 'booking_events', 'health_profiles', 'health_events',
  'emergency_contacts', 'notifications', 'hospital_announcements', 'hospital_documents', 'password_resets', 'hospital_reviews', 'payments', 'hospital_payouts',
]
export const emptyTables = (): Tables => Object.fromEntries(TABLE_ORDER.map((t) => [t, []])) as unknown as Tables

const KEY = 'medichub.db.v8'
const SCHEMA_VERSION = 8

type Listener = (tables: TableName[], remote: boolean) => void

/**
 * Where the data lives:
 * - 'local'  : this browser only (localStorage + cross-tab sync). Used for the offline pitch demo.
 * - 'client' : a cache of what the server lets this user see; writes go through the API.
 * - 'server' : the authoritative copy inside the Node server; every write is persisted to PostgreSQL.
 */
export type StoreMode = 'local' | 'client' | 'server'
export interface ServerHooks { onWrite: (tables: TableName[]) => void }

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); return true } catch { return false }
}

class Store {
  private data: Tables = emptyTables()
  private listeners = new Set<Listener>()
  private channel: BroadcastChannel | null = null
  private seedFn: (() => Tables) | null = null
  private maintain: ((t: Tables) => boolean) | null = null
  private hooks: ServerHooks | null = null
  mode: StoreMode = 'local'
  ready = false

  /** Local (browser-only) mode with seed data. */
  init(seed: () => Tables, maintain: (t: Tables) => boolean) {
    this.mode = 'local'
    this.seedFn = seed
    this.maintain = maintain
    this.load()
    try {
      this.channel = new BroadcastChannel('medichub-realtime')
      this.channel.onmessage = (e) => this.onRemote(e.data?.tables ?? [])
    } catch { /* not supported */ }
    try {
      window.addEventListener('storage', (e) => { if (e.key === KEY) this.onRemote([]) })
    } catch { /* ignore */ }
    this.ready = true
  }

  /** Client mode: data comes from the server, filtered by the access policies. */
  initClient() { this.mode = 'client'; this.data = emptyTables(); this.ready = true }

  /** Server mode: authoritative data loaded from PostgreSQL; hooks persist every write. */
  initServer(data: Tables, hooks: ServerHooks, maintain?: (t: Tables) => boolean) {
    this.mode = 'server'
    this.data = { ...emptyTables(), ...data }
    this.hooks = hooks
    this.maintain = maintain ?? null
    if (this.maintain && this.maintain(this.data)) hooks.onWrite(['hospital_slots'])
    this.ready = true
  }

  /** Client mode: replace whole tables with fresh rows from the server. */
  hydrate(partial: Partial<Tables>) {
    const tables = Object.keys(partial) as TableName[]
    if (!tables.length) return
    for (const t of tables) (this.data as unknown as Record<string, unknown[]>)[t] = (partial[t] ?? []) as unknown[]
    this.emit(tables, true)
  }

  private load() {
    const raw = safeGet(KEY)
    let parsed: (Tables & { __v?: number }) | null = null
    if (raw) { try { parsed = JSON.parse(raw) } catch { parsed = null } }
    if (!parsed || parsed.__v !== SCHEMA_VERSION) {
      this.data = this.seedFn!()
      this.persist()
    } else {
      delete parsed.__v
      this.data = parsed
    }
    if (this.maintain && this.maintain(this.data)) this.persist()
  }

  private onRemote(tables: TableName[]) {
    const raw = safeGet(KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      delete parsed.__v
      this.data = parsed
      this.emit(tables.length ? tables : (Object.keys(this.data) as TableName[]), true)
    } catch { /* ignore */ }
  }

  private persist() {
    if (this.mode === 'local') safeSet(KEY, JSON.stringify({ ...this.data, __v: SCHEMA_VERSION }))
  }

  private emit(tables: TableName[], remote: boolean) {
    this.listeners.forEach((l) => l(tables, remote))
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }

  select<T extends TableName>(table: T): Tables[T] {
    return this.data[table]
  }

  /** Whole dataset (server only, for persistence diffs). */
  all(): Tables { return this.data }

  /** Mutate one or more tables atomically; persists and broadcasts. */
  write(tables: TableName[], fn: (d: Tables) => void) {
    fn(this.data)
    if (this.mode === 'server') { this.hooks?.onWrite(tables); this.emit(tables, false); return }
    if (this.mode === 'client') console.warn('[medichub] local write in client mode ignored by server:', tables)
    this.persist()
    this.emit(tables, false)
    try { this.channel?.postMessage({ tables }) } catch { /* ignore */ }
  }

  reset() {
    if (this.mode !== 'local') return
    this.data = this.seedFn!()
    if (this.maintain) this.maintain(this.data)
    this.persist()
    this.emit(Object.keys(this.data) as TableName[], false)
    try { this.channel?.postMessage({ tables: Object.keys(this.data) }) } catch { /* ignore */ }
  }
}

export const db = new Store()
