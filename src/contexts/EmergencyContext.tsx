import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Siren } from 'lucide-react'

interface Api { enterEmergency: (e?: { clientX: number; clientY: number } | null, to?: string) => void }
const Ctx = createContext<Api>({ enterEmergency: () => {} })

/** WOW #3: a fast red wash expands from the tap point, then the focused emergency screen appears. */
export function EmergencyProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const enterEmergency = useCallback((e?: { clientX: number; clientY: number } | null, to = '/emergency') => {
    if (reduce) { navigate(to); return }
    const x = e?.clientX ?? window.innerWidth / 2, y = e?.clientY ?? window.innerHeight - 60
    setOrigin({ x, y })
    setTimeout(() => navigate(to), 260)
    setTimeout(() => setOrigin(null), 560)
  }, [navigate, reduce])
  const r = typeof window !== 'undefined' ? Math.hypot(window.innerWidth, window.innerHeight) * 1.1 : 2000
  return (
    <Ctx.Provider value={{ enterEmergency }}>
      {children}
      <AnimatePresence>
        {origin && (
          <motion.div className="pointer-events-none fixed inset-0 z-[90]" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.div className="absolute rounded-full bg-danger-600" style={{ left: origin.x, top: origin.y, width: 2 * r, height: 2 * r, marginLeft: -r, marginTop: -r }}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.42, ease: [0.3, 0.7, 0.2, 1] }} />
            <motion.div className="absolute inset-0 grid place-items-center text-white" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}>
              <div className="flex items-center gap-3 font-display text-2xl font-semibold"><Siren size={28} /> Emergency</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
export const useEmergency = () => useContext(Ctx)
