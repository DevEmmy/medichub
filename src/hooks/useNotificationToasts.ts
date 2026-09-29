import { useEffect, useRef } from 'react'
import { db } from '../lib/store'
import { useToast } from '../contexts/ToastContext'

/** Surfaces notifications that arrive in realtime (e.g. hospital changed a booking in another tab) as toasts. */
export function useNotificationToasts(userId: string | undefined) {
  const { toast } = useToast()
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!userId) return
    seen.current = new Set(db.select('notifications').filter((n) => n.userId === userId).map((n) => n.id))
    return db.subscribe((tables, remote) => {
      if (!tables.includes('notifications')) return
      const fresh = db.select('notifications').filter((n) => n.userId === userId && !seen.current!.has(n.id))
      fresh.forEach((n) => seen.current!.add(n.id))
      // Local actions already show their own success toast; only surface what came from elsewhere.
      if (remote) fresh.filter((n) => !(n.type === 'status' && n.link && window.location.hash.includes(n.link))).slice(-2).forEach((n) => toast(n.type === 'status' || n.type === 'announcement' ? 'live' : 'info', n.title, n.body))
    })
  }, [userId, toast])
}
