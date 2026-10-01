const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid misreads at the front desk

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n)
  try { crypto.getRandomValues(a) } catch { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256) }
  return a
}

export function uid(prefix = ''): string {
  const b = randomBytes(10)
  return prefix + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function bookingRef(): string {
  const b = randomBytes(6)
  return 'MED-' + Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('')
}

export function secureToken(): string {
  const b = randomBytes(24)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('')
const PBKDF2_ITER = 210_000

/** PBKDF2-SHA256 with a random salt (OWASP-recommended iteration count). Format: pbkdf2$iter$salt$hash */
export async function hashPasswordStrong(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITER }, key, 256)
  return `pbkdf2$${PBKDF2_ITER}$${hex(salt)}$${hex(bits)}`
}

export async function verifyPassword(stored: string, password: string, email: string): Promise<boolean> {
  if (!stored || stored === 'locked') return false
  if (stored.startsWith('plain:')) return stored.slice(6) === password
  if (stored.startsWith('pbkdf2$')) {
    const [, iter, saltHex, want] = stored.split('$')
    const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)))
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(iter) }, key, 256)
    const got = hex(bits)
    let diff = got.length ^ want.length
    for (let i = 0; i < Math.min(got.length, want.length); i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i)
    return diff === 0
  }
  return stored === (await hashPassword(password, email))
}

/** Legacy SHA-256 hash, kept only to verify passwords created by older demo builds. */
export async function hashPassword(password: string, email: string): Promise<string> {
  const data = new TextEncoder().encode(`medichub:${email.toLowerCase()}:${password}`)
  try {
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback for non-secure contexts (plain http on LAN during a demo)
    let h = 0x811c9dc5
    for (const c of data) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0 }
    return 'fnv-' + h.toString(16)
  }
}

/** Deterministic PRNG for seed data */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
