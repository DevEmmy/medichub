import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, FileText, Search, ShieldCheck, TriangleAlert, XCircle, Building2, ExternalLink } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { reviewHospital, verificationQueue } from '../../services/hospitals'
import { VerificationPill } from '../../components/hospital-admin/VerificationPill'
import { HospitalAvatar } from '../../components/ui/HospitalAvatar'
import { EmptyState, Spinner } from '../../components/ui/States'
import { TextArea } from '../../components/ui/Field'
import { useToast } from '../../contexts/ToastContext'
import { fmtBytes } from '../../utils/image'
import { relTime } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { Verification } from '../../types'

const TABS: { k: string; l: string; match: Verification[] }[] = [
  { k: 'queue', l: 'Needs review', match: ['pending', 'under_review'] },
  { k: 'attention', l: 'Waiting on facility', match: ['needs_attention'] },
  { k: 'verified', l: 'Verified', match: ['verified'] },
  { k: 'rejected', l: 'Rejected', match: ['rejected'] },
]

export default function Review() {
  useDocumentTitle('Verification review')
  const { data: all = [] } = useLive(verificationQueue, ['hospitals', 'hospital_documents'])
  const { toast } = useToast()
  const [tab, setTab] = useState('queue')
  const [sel, setSel] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const list = all.filter((h) => TABS.find((t) => t.k === tab)!.match.includes(h.verification) && (h.name + h.city).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
  const h = all.find((x) => x.id === sel) ?? list[0]
  const decide = async (v: Verification) => {
    if (!h) return
    setBusy(v)
    try { await reviewHospital(h.id, v, note); toast('success', v === 'verified' ? `${h.name} verified` : v === 'under_review' ? 'Review started' : 'Decision sent', v === 'verified' ? 'The facility is now listed for patients.' : 'The facility has been notified.'); setNote('') } catch (e) { toast('error', 'Could not update', (e as Error).message) } finally { setBusy(null) }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold">Hospital verification</h1><p className="mt-1 text-[14px] text-slate-600">Only verified facilities are listed publicly and receive the verified badge.</p></div>
        <div className="grid grid-cols-3 gap-2 text-center">{[['In queue', all.filter((x) => ['pending', 'under_review'].includes(x.verification)).length], ['Verified', all.filter((x) => x.verification === 'verified').length], ['Waiting', all.filter((x) => x.verification === 'needs_attention').length]].map(([l, v]) => <div key={l} className="rounded-xl bg-white px-4 py-2 ring-1 ring-line"><p className="font-display text-[20px] font-semibold text-ink tabular">{v}</p><p className="text-[11.5px] text-slate-500">{l}</p></div>)}</div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-line scrollbar-none">{TABS.map((t) => <button key={t.k} onClick={() => { setTab(t.k); setSel(null) }} className={cn('whitespace-nowrap rounded-lg px-3.5 py-2 text-[13.5px] font-semibold', tab === t.k ? 'bg-ink text-white' : 'text-slate-600')}>{t.l} <span className="opacity-60 tabular">{all.filter((x) => t.match.includes(x.verification)).length}</span></button>)}</div>
        <label className="relative flex-1"><span className="sr-only">Search facilities</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search facilities" className="input h-11 pl-10" /></label>
      </div>
      {list.length === 0 ? <EmptyState icon={<ShieldCheck size={22} />} title="Nothing here" body="No facilities in this state right now." /> : (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <ul className="space-y-2">
            {list.map((x) => (
              <li key={x.id}><button onClick={() => { setSel(x.id); setNote('') }} className={cn('flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 transition', h?.id === x.id ? 'ring-2 ring-brand-500' : 'ring-line hover:ring-slate-300')}>
                <HospitalAvatar name={x.name} hue={x.hue} logo={x.logo} size={40} />
                <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-ink">{x.name}</p><p className="text-[12px] text-slate-500">{x.city} · {x.submittedAt ? `submitted ${relTime(x.submittedAt)}` : 'seeded'}</p></div>
                <VerificationPill v={x.verification} size="sm" />
              </button></li>
            ))}
          </ul>
          <AnimatePresence mode="wait">
            {h && (
              <motion.section key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-white ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-4 border-b border-line p-5">
                  <HospitalAvatar name={h.name} hue={h.hue} logo={h.logo} size={52} />
                  <div className="min-w-0 flex-1"><p className="font-display text-[20px] font-semibold text-ink">{h.name}</p><p className="text-[13px] text-slate-500">{h.type} · {h.address}, {h.city}, {h.state}</p></div>
                  <VerificationPill v={h.verification} />
                  <a href={`#/hospitals/${h.id}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm"><ExternalLink size={14} /> Profile</a>
                </div>
                <div className="grid gap-5 p-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-700">Registration</h3>
                    <dl className="mt-2 space-y-2 text-[14px]">{[['CAC number', h.registration.cacNumber], ['Operating licence', h.registration.licenseNumber], ['Licensing body', h.registration.licensingBody], ['Established', h.registration.yearEstablished], ['Beds', h.registration.bedCount]].map(([k, v]) => <div key={k as string} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-ink">{v || '—'}</dd></div>)}</dl>
                    <h3 className="mt-5 text-[13px] font-semibold text-slate-700">Administrator</h3>
                    <p className="mt-1 text-[14px] text-ink">{h.admin.name}, {h.admin.title}</p><p className="text-[13px] text-slate-500">{h.admin.email} · {h.admin.phone}</p>
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-700">Documents</h3>
                    <ul className="mt-2 space-y-2">{h.documents.map((d) => <li key={d.id} className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5"><FileText size={16} className="text-slate-400" /><span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{d.name}</span><span className="text-[11.5px] text-slate-500">{fmtBytes(d.size)}</span></li>)}
                      {h.documents.length === 0 && <li className="text-[13px] text-slate-500">No documents uploaded.</li>}</ul>
                    <h3 className="mt-5 text-[13px] font-semibold text-slate-700">Services</h3>
                    <p className="mt-1 text-[13.5px] text-slate-600">{h.specialties.join(', ')}</p>
                  </div>
                </div>
                {h.verificationNote && <p className="mx-5 mb-4 rounded-xl bg-amber-50 p-3 text-[13.5px] text-amber-800">Last note: {h.verificationNote}</p>}
                <div className="space-y-3 border-t border-line bg-canvas/50 p-5">
                  <TextArea label="Note to facility" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required when asking for changes or rejecting." rows={2} />
                  <div className="flex flex-wrap gap-2">
                    {h.verification === 'pending' && <button disabled={!!busy} onClick={() => decide('under_review')} className="btn btn-secondary btn-sm">{busy === 'under_review' ? <Spinner /> : <Building2 size={15} />} Start review</button>}
                    {h.verification !== 'verified' && <button disabled={!!busy} onClick={() => decide('verified')} className="btn btn-brand btn-sm">{busy === 'verified' ? <Spinner /> : <BadgeCheck size={15} />} Approve & verify</button>}
                    <button disabled={!!busy} onClick={() => decide('needs_attention')} className="btn btn-secondary btn-sm">{busy === 'needs_attention' ? <Spinner /> : <TriangleAlert size={15} />} Request changes</button>
                    <button disabled={!!busy} onClick={() => decide('rejected')} className="btn btn-sm bg-danger-50 text-danger-700 ring-1 ring-danger-100 hover:bg-danger-100">{busy === 'rejected' ? <Spinner /> : <XCircle size={15} />} {h.verification === 'verified' ? 'Suspend' : 'Reject'}</button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
