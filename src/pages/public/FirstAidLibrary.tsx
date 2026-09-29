import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { FIRST_AID_VIDEOS, EMERGENCY_GUIDES, HEALTH_RESOURCES } from '../../data/firstAid'
import { VideoCard, VideoPlayer } from '../../components/emergency/VideoCard'
import { Modal } from '../../components/ui/Modal'
import { DynIcon } from '../../components/ui/Icon'
import { EmptyState } from '../../components/ui/States'
import { SafetyLine } from '../../components/emergency/Call112'
import { PageTransition } from '../../layouts/PageTransition'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import type { FirstAidVideo } from '../../types'

export default function FirstAidLibrary() {
  useDocumentTitle('First aid')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<FirstAidVideo | null>(null)
  const vids = useMemo(() => FIRST_AID_VIDEOS.filter((v) => (v.title + v.description + v.emergencyType).toLowerCase().includes(q.toLowerCase())), [q])
  const guides = useMemo(() => [...EMERGENCY_GUIDES.map((g) => ({ slug: g.slug, title: g.title, icon: g.icon, sub: g.short, base: '/emergency/' })), ...HEALTH_RESOURCES.map((r) => ({ slug: r.slug, title: r.title, icon: r.icon, sub: r.summary, base: '/first-aid/' }))]
    .filter((g) => (g.title + g.sub).toLowerCase().includes(q.toLowerCase())), [q])
  return (
    <PageTransition className="container-app py-8">
      <p className="eyebrow">First aid</p>
      <h1 className="mt-2 text-[34px] font-semibold leading-tight sm:text-[42px]">Learn what to do before help arrives</h1>
      <SafetyLine className="mt-3 max-w-2xl" />
      <label className="relative mt-6 block max-w-xl">
        <span className="sr-only">Search first aid</span>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: bleeding, burns, choking…" className="input h-12 rounded-2xl pl-11" />
      </label>

      <section className="mt-10" aria-labelledby="v-h">
        <div className="flex items-end justify-between"><h2 id="v-h" className="text-[22px] font-semibold">Video library</h2><p className="text-[13px] text-slate-500">{vids.length} videos from recognised first-aid organisations</p></div>
        {vids.length === 0 ? <EmptyState className="mt-4" icon={<Search size={22} />} title="No videos match" body="Try a different word, like “bleeding” or “CPR”." /> : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vids.map((v) => <VideoCard key={v.id} v={v} onOpen={() => setOpen(v)} />)}</div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="g-h">
        <h2 id="g-h" className="text-[22px] font-semibold">Step-by-step guides</h2>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.slug}><Link to={g.base + g.slug} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-black/5 transition hover:-translate-y-0.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger-50 text-danger-600"><DynIcon name={g.icon} size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{g.title}</span><span className="block truncate text-[13px] text-slate-500">{g.sub}</span></span><ArrowRight size={17} className="text-slate-400" />
            </Link></li>
          ))}
        </ul>
      </section>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title} size="lg">{open && <><VideoPlayer v={open} /><p className="mt-4 text-[14.5px] leading-relaxed text-slate-600">{open.description}</p></>}</Modal>
    </PageTransition>
  )
}
