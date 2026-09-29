import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, Hospital, ArrowRight, TriangleAlert, Play } from 'lucide-react'
import { EmergencyShell } from '../../layouts/EmergencyShell'
import { Call112Button } from '../../components/emergency/Call112'
import { VideoPlayer } from '../../components/emergency/VideoCard'
import { DynIcon } from '../../components/ui/Icon'
import { EmptyState } from '../../components/ui/States'
import { EMERGENCY_GUIDES, HEALTH_RESOURCES, videoById } from '../../data/firstAid'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'

export default function FirstAidGuide({ embedded = false }: { embedded?: boolean }) {
  const { slug = '' } = useParams()
  const g = EMERGENCY_GUIDES.find((x) => x.slug === slug) ?? HEALTH_RESOURCES.find((x) => x.slug === slug)
  useDocumentTitle(g?.title ?? 'First aid')
  const videos = (g?.videoIds ?? []).map(videoById).filter(Boolean) as NonNullable<ReturnType<typeof videoById>>[]
  const [active, setActive] = useState(0)

  const body = !g ? (
    <EmptyState icon={<TriangleAlert size={22} />} title="Guide not found" body="This first-aid guide isn't available. If someone is in danger, call 112 now." action={<Link to="/emergency" className="btn btn-danger">Go to emergency</Link>} />
  ) : (
    <article>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-danger-50 text-danger-600"><DynIcon name={g.icon} size={24} /></span>
        <div><h1 className="text-[30px] font-semibold leading-tight sm:text-[36px]">{g.title}</h1>{'short' in g && <p className="text-[15px] text-slate-600">{g.short}</p>}</div>
      </div>

      <div className="mt-5"><Call112Button size="md" /></div>
      <p className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-[14.5px] font-medium leading-relaxed text-danger-900 ring-1 ring-danger-100">{g.call112When}</p>

      {videos.length > 0 && (
        <section aria-labelledby="vid-h" className="mt-8">
          <h2 id="vid-h" className="eyebrow">Video</h2>
          <div className="mt-3"><VideoPlayer key={videos[active].id} v={videos[active]} /></div>
          {videos.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
              {videos.map((v, i) => (
                <button key={v.id} onClick={() => setActive(i)} aria-pressed={i === active} className={cn('chip shrink-0', i === active && 'chip-on')}><Play size={13} /> {v.title}</button>
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="do-h" className="mt-8">
        <h2 id="do-h" className="text-[24px] font-semibold">Do this now</h2>
        <ol className="mt-4 space-y-3">
          {g.doNow.map((s, i) => (
            <li key={i} className="flex gap-4 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-black/5 sm:p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink font-display text-[18px] font-bold text-white tabular">{i + 1}</span>
              <p className="pt-1.5 text-[18px] font-medium leading-snug text-ink sm:text-[19px]">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="dont-h" className="mt-8">
        <h2 id="dont-h" className="flex items-center gap-2 text-[24px] font-semibold"><Ban size={22} className="text-danger-600" /> Don't</h2>
        <ul className="mt-4 space-y-2.5">
          {g.dont.map((s, i) => <li key={i} className="flex gap-3 rounded-2xl bg-danger-50 px-4 py-3.5 text-[16.5px] font-medium leading-snug text-danger-900 ring-1 ring-danger-100"><Ban size={19} className="mt-0.5 shrink-0 text-danger-600" />{s}</li>)}
        </ul>
      </section>

      <section aria-labelledby="care-h" className="mt-8 grid gap-3 sm:grid-cols-2">
        <h2 id="care-h" className="sr-only">Get help</h2>
        <Link to="/find?emergency=1" className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-ink px-5 text-white"><Hospital size={20} /><span className="flex-1 text-[16px] font-semibold">Find care nearby</span><ArrowRight size={18} /></Link>
        <Link to="/triage" className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-5 text-ink shadow-soft ring-1 ring-black/5"><span className="flex-1 text-[16px] font-semibold">Check how urgent it is</span><ArrowRight size={18} /></Link>
      </section>
      <p className="mt-8 text-[13px] leading-relaxed text-slate-500">This guide gives general first-aid steps based on British Red Cross guidance and is not a substitute for trained help. If someone is in immediate danger, call 112 now.</p>
    </article>
  )

  if (embedded) return <div className="container-app max-w-3xl py-8">{body}</div>
  return <EmergencyShell back="/emergency">{body}</EmergencyShell>
}
