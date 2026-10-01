import { cn } from '../../utils/cn'
import { useState } from 'react'
import { PHOTOS } from '../../data/photos'
import { commonsSrc, realPhotosFor } from '../../data/realPhotos'
import { DEMO } from '../../config'

const EXTERIORS = [PHOTOS.ext1, PHOTOS.ext2, PHOTOS.ext3]
const idx = (seed: string | number) => { const str = String(seed); let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h }
const ORDER = ['h_lagooncrest','h_luth','h_fmcebutemetta','h_noh_igbobi','h_lekkimind','h_nationalabuja','h_fmcjabi','h_uath','h_uch','h_upth','h_ubth','h_unth','h_akth','h_abuth','h_uith','h_fmcabeokuta','h_juth','h_tankehills','h_ughellivale']
const pos = (seed: string | number) => { const k = ORDER.indexOf(String(seed)); return k >= 0 ? k : idx(seed) }
export function exteriorFor(seed: string | number) { return EXTERIORS[pos(seed) % EXTERIORS.length] }
export type GalleryPhoto = { src: string; label: string; fallback?: string; credit?: string }
export function galleryFor(seed: string | number, cover?: string, photos?: { src: string; label: string }[]): GalleryPhoto[] {
  const realPublic = realPhotosFor(String(seed)).map((p) => ({ src: commonsSrc(p.file), label: p.caption, fallback: DEMO ? exteriorFor(seed) : undefined, credit: p.file }))
  if (!DEMO || photos?.length) {
    // Real hospitals: their own photos, or real photos from public sources; never stock images
    const own: GalleryPhoto[] = photos?.length ? photos : realPublic
    return cover && !own.some((p) => p.src === cover) ? [{ src: cover, label: 'Main building' }, ...own] : own
  }
  const i = pos(seed) % 4
  const interiors = [
    { src: PHOTOS.reception, label: 'Reception & waiting area' },
    { src: PHOTOS.ward, label: 'Patient ward' },
    { src: PHOTOS.emergency, label: 'Emergency treatment bays' },
    { src: PHOTOS.lab, label: 'Laboratory' },
  ]
  const rotated = [...interiors.slice(i), ...interiors.slice(0, i)]
  if (cover) return [{ src: cover, label: 'Main building' }, ...rotated]
  const real = realPhotosFor(String(seed)).map((p) => ({ src: commonsSrc(p.file), label: p.caption, fallback: exteriorFor(seed), credit: p.file }))
  return real.length ? [...real, ...rotated] : [{ src: exteriorFor(seed), label: 'Main building' }, ...rotated]
}

export function HospitalAvatar({ name, hue, logo, size = 44, className }: { name: string; hue: number; logo?: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('')
  if (logo) return <img src={logo} alt="" width={size} height={size} className={cn('shrink-0 rounded-xl object-cover ring-1 ring-black/5', className)} style={{ width: size, height: size }} />
  return (
    <div aria-hidden className={cn('grid shrink-0 place-items-center rounded-xl font-display font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${hue} 55% 30%), hsl(${hue + 20} 45% 18%))` }}>
      {initials}
    </div>
  )
}

/** Exterior photo of the facility with a slow drift, so listings feel alive. Uses the hospital's own upload when present. */
export function HospitalCover({ hue, seed, cover, className, children, still }: { hue: number; seed?: string; cover?: string; className?: string; children?: React.ReactNode; still?: boolean }) {
  const [failed, setFailed] = useState(false)
  const real = !cover && !failed ? realPhotosFor(seed)[0] : undefined
  const src = cover ?? (real ? commonsSrc(real.file, 960) : DEMO ? exteriorFor(seed ?? hue) : null)
  if (!src) {
    return (
      <div className={cn('relative overflow-hidden', className)} style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${hue + 25} 40% 16%))` }}>
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.12]"><defs><pattern id={`p${hue}`} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M11 6h6v5h5v6h-5v5h-6v-5H6v-6h5z" fill="white" /></pattern></defs><rect width="100%" height="100%" fill={`url(#p${hue})`} /></svg>
        {children}
      </div>
    )
  }
  return (
    <div className={cn('group/cover relative overflow-hidden bg-ink', className)}>
      <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
        className={cn('absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover/cover:scale-[1.06]', !still && 'motion-safe:animate-[kenburns_18s_ease-in-out_infinite_alternate]')} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/10" aria-hidden />
      {children}
    </div>
  )
}
