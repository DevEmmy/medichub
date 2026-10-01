import { useEffect, useRef, useState } from 'react'
import { DEMO } from '../../config'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, UserRound, Leaf, Bell, RotateCcw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { db } from '../../lib/store'
import { cn } from '../../utils/cn'

export function UserMenu({ dark = false, links }: { dark?: boolean; links?: { to: string; label: string; icon: typeof UserRound }[] }) {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmReset(false) } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  if (!user) return null
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  const items = links ?? [{ to: '/app/profile', label: 'Profile & settings', icon: UserRound }, { to: '/wellness', label: 'Wellness', icon: Leaf }, { to: '/app/notifications', label: 'Notifications', icon: Bell }]
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu" className={cn('grid h-10 w-10 place-items-center rounded-full font-display text-[14px] font-semibold ring-2 transition', dark ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20' : 'bg-brand-100 text-brand-800 ring-white hover:ring-brand-200')}>{initials}</button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-black/5">
            <div className="px-3 py-2.5"><p className="truncate text-[14px] font-semibold text-ink">{user.name}</p><p className="truncate text-[12.5px] text-slate-500">{user.email}</p></div>
            <div className="my-1 h-px bg-line" />
            {items.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] text-slate-700 hover:bg-canvas"><l.icon size={16} /> {l.label}</Link>
            ))}
            {DEMO && <button onClick={() => { if (!confirmReset) { setConfirmReset(true); return } db.reset(); setOpen(false); setConfirmReset(false); signOut(); nav('/'); toast('success', 'Demo data reset', 'All demo accounts and data are back to their starting state.') }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] text-slate-700 hover:bg-canvas"><RotateCcw size={16} /> {confirmReset ? 'Tap again to reset demo data' : 'Reset demo data'}</button>}
            <div className="my-1 h-px bg-line" />
            <button onClick={() => { signOut(); setOpen(false); nav('/'); toast('info', 'Signed out') }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] text-slate-700 hover:bg-canvas"><LogOut size={16} /> Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
