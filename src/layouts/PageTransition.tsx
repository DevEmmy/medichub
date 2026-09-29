import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}
