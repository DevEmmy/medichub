import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellRing, CalendarCheck, Megaphone, ShieldCheck, Activity, UserRound, Info } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { markRead, myNotifications } from '../../services/notifications'
import { relTime } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { NotificationType } from '../../types'

export const NOTIF_ICON: Record<NotificationType, typeof Bell> = { booking: CalendarCheck, status: Activity, verification: ShieldCheck, profile: UserRound, announcement: Megaphone, system: Info }

export function NotificationBell({ allHref, dark = false }: { allHref: string; dark?: boolean }) {
  const { data = [] } = useLive(myNotifications, ['notifications'])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const unread = data.filter((n) => !n.read).length
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])
  const I = unread ? BellRing : Bell
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className={cn('relative grid h-11 w-11 place-items-center rounded-full transition', dark ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-mist hover:text-ink')}>
        <I size={20} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white ring-2 ring-white tabular">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.16 }}
            className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] origin-top-right overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display text-[16px] font-semibold text-ink">Notifications</p>
              {unread > 0 && <button onClick={() => markRead()} className="text-[13px] font-medium text-brand-700 hover:underline">Mark all read</button>}
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {data.length === 0 && <li className="px-4 py-8 text-center text-[14px] text-slate-500">You're all caught up.</li>}
              {data.slice(0, 8).map((n) => {
                const Icon = NOTIF_ICON[n.type]
                return (
                  <li key={n.id}>
                    <button onClick={() => { markRead(n.id); setOpen(false); if (n.link) nav(n.link) }} className={cn('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-canvas', !n.read && 'bg-brand-50/40')}>
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mist text-slate-600"><Icon size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className="truncate text-[14px] font-semibold text-ink">{n.title}</span>{!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-coral-500" aria-label="Unread" />}</span>
                        <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-slate-600">{n.body}</span>
                        <span className="mt-1 block text-[11.5px] text-slate-400">{relTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <Link to={allHref} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-[13px] font-semibold text-brand-700 hover:bg-canvas">View all</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
