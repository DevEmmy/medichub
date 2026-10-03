import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../utils/cn'

/** Crossfading photos with a slow Ken Burns drift. Pauses for reduced-motion users. */
export function Slideshow({ slides, interval = 5200, className, overlay, onIndex }: { slides: { src: string; caption?: string }[]; interval?: number; className?: string; overlay?: string; onIndex?: (i: number) => void }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), interval)
    return () => clearInterval(t)
  }, [slides.length, interval])
  useEffect(() => { onIndex?.(i) }, [i, onIndex])
  return (
    <div className={cn('overflow-hidden', /\babsolute\b|\bfixed\b/.test(className ?? '') ? '' : 'relative', className)} aria-hidden>
      <AnimatePresence initial={false}>
        <motion.img key={i} src={slides[i].src} alt="" className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.2 }, scale: { duration: interval / 1000 + 1.2, ease: 'linear' } }} />
      </AnimatePresence>
      {overlay && <div className={cn('absolute inset-0', overlay)} />}
    </div>
  )
}
