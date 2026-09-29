import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck, CircleAlert, Info, Radio, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info' | 'live'
interface Toast { id: number; kind: Kind; title: string; body?: string }
interface ToastApi { toast: (kind: Kind, title: string, body?: string) => void }
const Ctx = createContext<ToastApi>({ toast: () => {} })
let n = 0

const ICON = { success: CircleCheck, error: CircleAlert, info: Info, live: Radio }
const TONE = {
  success: 'text-brand-600 bg-brand-50',
  error: 'text-danger-600 bg-danger-50',
  info: 'text-slate-700 bg-mist',
  live: 'text-amber-700 bg-amber-50',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback((kind: Kind, title: string, body?: string) => {
    const id = ++n
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }])
    setTimeout(() => dismiss(id), kind === 'error' ? 6500 : 4200)
  }, [dismiss])
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const I = ICON[t.kind]
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                role={t.kind === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white/95 p-3.5 pr-2 shadow-lift ring-1 ring-black/5 backdrop-blur">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${TONE[t.kind]}`}><I size={17} aria-hidden /></span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[14px] font-semibold text-ink">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{t.body}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-mist hover:text-slate-700" aria-label="Dismiss notification"><X size={16} /></button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
export const useToast = () => useContext(Ctx)
