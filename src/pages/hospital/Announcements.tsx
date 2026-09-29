import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Info, Megaphone, Siren, Trash2, TriangleAlert, Eye, EyeOff } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { db } from '../../lib/store'
import { deleteAnnouncement, publishAnnouncement, setAnnouncementActive } from '../../services/hospitals'
import { Field, TextArea } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { EmptyState, Spinner } from '../../components/ui/States'
import { useToast } from '../../contexts/ToastContext'
import { relTime } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { AnnouncementSeverity } from '../../types'

const TEMPLATES = ['Emergency department currently experiencing high demand.', 'Radiology services unavailable today.', 'Clinic closing at 4 PM.', 'Additional appointment slots opened.']
const SEV = { info: { icon: Info, cls: 'bg-white ring-line', ic: 'bg-brand-50 text-brand-700' }, warning: { icon: TriangleAlert, cls: 'bg-amber-50 ring-amber-100', ic: 'bg-white text-amber-700' }, critical: { icon: Siren, cls: 'bg-danger-50 ring-danger-100', ic: 'bg-white text-danger-600' } }

export default function Announcements() {
  useDocumentTitle('Announcements')
  const { hospitalId } = useMyHospital()
  const { data: list = [] } = useLive(() => db.select('hospital_announcements').filter((a) => a.hospitalId === hospitalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), ['hospital_announcements'], [hospitalId])
  const { toast } = useToast()
  const [f, setF] = useState({ title: '', body: '', severity: 'info' as AnnouncementSeverity })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const publish = async () => {
    setBusy(true); setErr(null)
    try { await publishAnnouncement(hospitalId, f); toast('success', 'Announcement published', 'It now appears on your public profile.'); setF({ title: '', body: '', severity: 'info' }) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const Prev = SEV[f.severity]
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div><h1 className="text-[28px] font-semibold">Announcements</h1><p className="mt-1 text-[14px] text-slate-600">Tell patients about delays, closures or new slots. Patients with upcoming bookings are notified.</p></div>
        <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-line">
          <div className="flex flex-wrap gap-1.5">{TEMPLATES.map((t) => <button key={t} onClick={() => setF({ ...f, title: t, severity: /demand|unavailable/.test(t) ? 'warning' : 'info' })} className="rounded-full bg-canvas px-3 py-1.5 text-[12.5px] font-medium text-slate-700 ring-1 ring-line hover:bg-mist">{t}</button>)}</div>
          <Field label="Headline" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={100} error={err} />
          <TextArea label="Details (optional)" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={400} />
          <div><p className="mb-1.5 text-[13px] font-medium text-slate-700">Importance</p><Segmented label="Importance" value={f.severity} onChange={(v) => setF({ ...f, severity: v })} options={[{ value: 'info', label: 'Info', tone: 'good' }, { value: 'warning', label: 'Warning', tone: 'warn' }, { value: 'critical', label: 'Critical', tone: 'bad' }]} /></div>
          {f.title && <div className={cn('flex gap-3 rounded-2xl p-4 ring-1', Prev.cls)}><span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', Prev.ic)}><Prev.icon size={17} /></span><div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preview</p><p className="text-[14.5px] font-semibold text-ink">{f.title}</p>{f.body && <p className="text-[13.5px] text-slate-600">{f.body}</p>}</div></div>}
          <button onClick={publish} disabled={busy || !f.title.trim()} className="btn btn-primary w-full">{busy ? <Spinner /> : <Megaphone size={16} />} Publish announcement</button>
        </section>
      </div>
      <section>
        <h2 className="text-[17px] font-semibold lg:mt-[52px]">Published</h2>
        {list.length === 0 ? <EmptyState className="mt-3" icon={<Megaphone size={22} />} title="No announcements yet" /> : (
          <ul className="mt-3 space-y-2.5">
            <AnimatePresence initial={false}>
              {list.map((a) => { const s = SEV[a.severity]; return (
                <motion.li key={a.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: a.active ? 1 : 0.55, y: 0 }} exit={{ opacity: 0, height: 0 }} className={cn('flex gap-3 rounded-2xl p-4 ring-1', s.cls)}>
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', s.ic)}><s.icon size={17} /></span>
                  <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold text-ink">{a.title}</p>{a.body && <p className="text-[13px] text-slate-600">{a.body}</p>}<p className="mt-1 text-[11.5px] text-slate-500">{a.active ? 'Live' : 'Hidden'} · {relTime(a.createdAt)}</p></div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setAnnouncementActive(hospitalId, a.id, !a.active)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white" aria-label={a.active ? 'Hide from profile' : 'Show on profile'}>{a.active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button onClick={async () => { await deleteAnnouncement(hospitalId, a.id); toast('success', 'Announcement deleted') }} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white" aria-label="Delete announcement"><Trash2 size={16} /></button>
                  </div>
                </motion.li>
              ) })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  )
}
