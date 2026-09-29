import { useState } from 'react'
import { ExternalLink, Play, ShieldCheck } from 'lucide-react'
import type { FirstAidVideo } from '../../types'
import { isFramed } from '../../utils/env'
import { cn } from '../../utils/cn'

function Thumb({ v, big }: { v: FirstAidVideo; big?: boolean }) {
  return (
    <div className="absolute inset-0" style={{ background: `radial-gradient(80% 100% at 80% 0%, hsl(${v.hue} 70% 55% / .5), transparent 60%), linear-gradient(140deg, hsl(${v.hue} 35% 22%), #0A1F1A)` }}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden><defs><pattern id={'t' + v.id} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" /></pattern></defs><rect width="100%" height="100%" fill={`url(#t${v.id})`} /></svg>
      <div className={cn('absolute left-4 right-16 font-display font-semibold leading-tight text-white/95', big ? 'bottom-5 text-[22px] sm:text-[26px]' : 'bottom-3.5 text-[15px]')}>{v.title}</div>
      <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">{v.sourceOrg}</span>
    </div>
  )
}

/** Plays the organisation's own video (YouTube privacy-enhanced embed). Where embedding is blocked, links to the source. */
export function VideoPlayer({ v }: { v: FirstAidVideo }) {
  const [playing, setPlaying] = useState(false)
  const canEmbed = !!v.youtubeId && !isFramed
  const watchUrl = v.youtubeId ? `https://www.youtube.com/watch?v=${v.youtubeId}` : v.sourceUrl
  return (
    <figure className="overflow-hidden rounded-3xl bg-ink shadow-lift">
      <div className="relative aspect-video w-full">
        {playing && canEmbed ? (
          <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&rel=0`} title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <>
            <Thumb v={v} big />
            {canEmbed ? (
              <button onClick={() => setPlaying(true)} className="absolute inset-0 grid place-items-center" aria-label={`Play video: ${v.title}`}>
                <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-ink shadow-lift transition hover:scale-105"><Play size={32} className="ml-1" fill="currentColor" /></span>
              </button>
            ) : (
              <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 grid place-items-center" aria-label={`Watch on ${v.youtubeId ? 'YouTube' : v.sourceOrg}: ${v.title} (opens in a new tab)`}>
                <span className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-ink shadow-lift"><Play size={18} fill="currentColor" /> Watch on {v.youtubeId ? 'YouTube' : v.sourceOrg}</span>
              </a>
            )}
          </>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 text-[12.5px] text-slate-600">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-600" /> Source: {v.sourceOrg} · {v.safetyNote}</span>
        <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">Open source <ExternalLink size={13} /></a>
      </figcaption>
    </figure>
  )
}

export function VideoCard({ v, onOpen }: { v: FirstAidVideo; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group card flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-video w-full"><Thumb v={v} />
        <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow transition group-hover:scale-110"><Play size={17} className="ml-0.5" fill="currentColor" /></span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[13.5px] leading-snug text-slate-600">{v.description}</p>
        <p className="mt-3 text-[12px] font-medium text-slate-500">{v.durationLabel} · {v.sourceOrg}</p>
      </div>
    </button>
  )
}
