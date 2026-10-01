// How fresh a hospital's live status is, and the reminder policy behind it.
//
// Why 12 hours: hourly reminders become noise that busy ward staff learn to ignore,
// and 24 hours is too long for emergency information (oxygen, beds, the ED queue
// change several times a day). Twelve hours lines up with the two nursing shifts
// most Nigerian hospitals run, so every shift handover is a natural "confirm or
// update" moment. After 24 hours with no update the status is treated as at risk.
export const REMINDER_HOURS = 12
export const STALE_HOURS = 24

export type Freshness = 'fresh' | 'ageing' | 'stale' | 'unreported'

interface HasStatus { publicRecord?: boolean; status: { updatedAt: string }; capacity: { updatedAt: string } }

export function lastUpdate(h: HasStatus): string {
  return h.status.updatedAt > h.capacity.updatedAt ? h.status.updatedAt : h.capacity.updatedAt
}
export function hoursSince(iso: string, now = Date.now()): number {
  return Math.max(0, (now - new Date(iso).getTime()) / 3_600_000)
}
export function freshnessOf(h: HasStatus, now = Date.now()): Freshness {
  if (h.publicRecord) return 'unreported'
  const hrs = hoursSince(lastUpdate(h), now)
  if (hrs >= STALE_HOURS) return 'stale'
  if (hrs >= REMINDER_HOURS) return 'ageing'
  return 'fresh'
}
export function ageLabel(hrs: number): string {
  if (hrs < 1) return `${Math.max(1, Math.round(hrs * 60))} min`
  if (hrs < 48) return `${Math.floor(hrs)} h`
  return `${Math.floor(hrs / 24)} days`
}
