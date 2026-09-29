import { db } from '../lib/store'
import { uid } from '../lib/ids'
import type { NotificationType } from '../types'
import { requireUser } from './core'

/** Server-side style insert (in production: a Postgres trigger / edge function). */
export function notify(userId: string, type: NotificationType, title: string, body: string, link?: string) {
  db.write(['notifications'], (d) => {
    d.notifications.push({ id: uid('nt_'), userId, type, title, body, link, read: false, createdAt: new Date().toISOString() })
    // keep the table bounded per user
    const mine = d.notifications.filter((n) => n.userId === userId)
    if (mine.length > 60) {
      const drop = new Set(mine.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, mine.length - 60).map((n) => n.id))
      d.notifications = d.notifications.filter((n) => !drop.has(n.id))
    }
  })
}

export function myNotifications() {
  const u = requireUser()
  return db.select('notifications').filter((n) => n.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function markRead(id?: string) {
  const u = requireUser()
  db.write(['notifications'], (d) => d.notifications.forEach((n) => { if (n.userId === u.id && (!id || n.id === id)) n.read = true }))
}
