import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Images, Pause, Play } from 'lucide-react'
import { galleryFor } from '../ui/HospitalAvatar'
import { commonsPage } from '../../data/realPhotos'
import { Modal } from '../ui/Modal'
import { cn } from '../../utils/cn'

/** Auto-playing photo tour: exterior, then interiors. */
export function PhotoGallery({ hue, seed, cover, photos: own, name, note }: { hue: number; seed?: string; cover?: string; photos?: { src: string; label: string }[]; name: string; note?: string }) {
  const base = galleryFor(seed ?? hue, cover, own)
  const [broken, setBroken] = useState<Set<number>>(new Set())
  const photos = base.map((p, k) => (broken.has(k) && p.fallback ? { ...p, src: p.fallback, credit: undefined, label: 'Main building (illustrative)' } : p))
  const fail = (k: number) => setBroken((b) => (b.has(k) ? b : new Set(b).add(k)))
  const realCount = photos.filter((p) => p.credit).length
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!playing || open) return; const t = setInterval(() => setI((x) => (x + 1) % photos.length), 4000); return () => clearInterval(t) }, [playing, open, photos.length])
  const go = (d: number) => { setPlaying(false); setI((x) => (x + d + photos.length) % photos.length) }
  if (!photos.length) return null
  const fromHospital = !!own?.length
  return (
    <section aria-labelledby="ph-h">
      <div className="flex items-center justify-between"><h2 id="ph-h" className="flex items-center gap-2 text-[20px] font-semibold">Inside {name.split(' ').slice(0, 2).join(' ')}</h2><span className="text-[12px] text-slate-500">{i + 1} / {photos.length}</span></div>
      <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-ink">
        <AnimatePresence initial={false}>
          <motion.img key={i + photos[i].src} src={photos[i].src} alt={photos[i].label} referrerPolicy="no-referrer" onError={() => fail(i)} onClick={() => setOpen(true)} className="absolute inset-0 h-full w-full cursor-zoom-in object-cover"
            initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ opacity: { duration: 0.7 }, scale: { duration: 4.5, ease: 'linear' } }} />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="pointer-events-none absolute bottom-3 left-4 right-28 text-[14px] font-semibold text-white">{photos[i].label}<span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide">{photos[i].credit || fromHospital ? 'Real photo' : 'Illustrative'}</span></p>
        <div className="absolute bottom-2.5 right-3 flex gap-1.5">
          <button onClick={() => setPlaying((p) => !p)} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
          <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60" aria-label="View all photos"><Images size={15} /></button>
        </div>
        <button onClick={() => go(-1)} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow hover:bg-white" aria-label="Previous photo"><ChevronLeft size={19} /></button>
        <button onClick={() => go(1)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow hover:bg-white" aria-label="Next photo"><ChevronRight size={19} /></button>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {photos.map((p, k) => (
          <button key={k} onClick={() => { setPlaying(false); setI(k) }} aria-label={`Show ${p.label}`} aria-current={k === i} className={cn('relative aspect-[4/3] overflow-hidden rounded-lg ring-2 transition', k === i ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100')}>
            <img src={p.src} alt="" referrerPolicy="no-referrer" onError={() => fail(k)} className="h-full w-full object-cover" />
            {k === i && playing && <motion.span key={'bar' + i} className="absolute bottom-0 left-0 h-1 bg-brand-400" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 4, ease: 'linear' }} />}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-slate-500">
        {realCount > 0 ? <>Building photo{realCount > 1 ? 's' : ''}: {photos.filter((p) => p.credit).map((p, k) => <a key={k} href={commonsPage(p.credit!)} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">{k ? ', ' : ''}Wikimedia Commons{realCount > 1 ? ` (${k + 1})` : ''}</a>)} (author and licence on the file page). Interior photos are illustrative until the hospital shares its own.</> : (fromHospital ? 'Photos provided by the hospital.' : note ?? 'Illustrative photos for this demo facility. Verified hospitals upload their own.')}
      </p>
      <Modal open={open} onClose={() => setOpen(false)} title={photos[i].label} size="lg">
        <img src={photos[i].src} alt={photos[i].label} className="w-full rounded-xl" />
        <div className="mt-3 flex justify-between"><button onClick={() => go(-1)} className="btn btn-secondary btn-sm"><ChevronLeft size={15} /> Previous</button><button onClick={() => go(1)} className="btn btn-secondary btn-sm">Next <ChevronRight size={15} /></button></div>
      </Modal>
    </section>
  )
}
