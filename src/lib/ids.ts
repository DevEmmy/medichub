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

/** SHA-256 password hashing with a per-app pepper. Production uses Supabase Auth (bcrypt). */
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
