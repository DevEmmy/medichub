import { cn } from '../../utils/cn'
import { PHOTOS } from '../../data/photos'

const EXTERIORS = [PHOTOS.ext1, PHOTOS.ext2, PHOTOS.ext3]
const idx = (seed: string | number) => { const str = String(seed); let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h }
const ORDER = ['h_lagooncrest','h_luth','h_fmcebutemetta','h_noh_igbobi','h_lekkimind','h_nationalabuja','h_fmcjabi','h_uath','h_uch','h_upth','h_ubth','h_unth','h_akth','h_abuth','h_uith','h_fmcabeokuta','h_juth','h_tankehills','h_ughellivale']
const pos = (seed: string | number) => { const k = ORDER.indexOf(String(seed)); return k >= 0 ? k : idx(seed) }
export function exteriorFor(seed: string | number) { return EXTERIORS[pos(seed) % EXTERIORS.length] }
export function galleryFor(seed: string | number, cover?: string) {
  const i = pos(seed) % 4
  const interiors = [
    { src: PHOTOS.reception, label: 'Reception & waiting area' },
    { src: PHOTOS.ward, label: 'Patient ward' },
    { src: PHOTOS.emergency, label: 'Emergency treatment bays' },
    { src: PHOTOS.lab, label: 'Laboratory' },
  ]
  const rotated = [...interiors.slice(i), ...interiors.slice(0, i)]
  return [{ src: cover ?? exteriorFor(seed), label: 'Main building' }, ...rotated]
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
  return (
    <div className={cn('group/cover relative overflow-hidden bg-ink', className)}>
      <img src={cover ?? exteriorFor(seed ?? hue)} alt="" loading="lazy" decoding="async"
        className={cn('absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover/cover:scale-[1.06]', !still && 'motion-safe:animate-[kenburns_18s_ease-in-out_infinite_alternate]')} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/10" aria-hidden />
      {children}
    </div>
  )
}
