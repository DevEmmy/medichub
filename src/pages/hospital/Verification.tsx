import { useState } from 'react'
import { uploadFile } from '../../lib/files'
import { BadgeCheck, CircleDashed, FileText, Upload, CircleCheck, TriangleAlert, XCircle, Search } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { db } from '../../lib/store'
import { resubmitVerification } from '../../services/hospitals'
import { VerificationPill } from '../../components/hospital-admin/VerificationPill'
import { Spinner } from '../../components/ui/States'
import { useToast } from '../../contexts/ToastContext'
import { fmtBytes } from '../../utils/image'
import { relTime } from '../../utils/date'
import { cn } from '../../utils/cn'
import type { Verification as V } from '../../types'

const STAGES: { v: V[]; label: string; icon: typeof CircleCheck }[] = [
  { v: ['pending', 'under_review', 'verified', 'needs_attention', 'rejected'], label: 'Submitted', icon: FileText },
  { v: ['under_review', 'verified', 'needs_attention', 'rejected'], label: 'Under review', icon: Search },
  { v: ['verified'], label: 'Verified', icon: BadgeCheck },
]

export default function Verification() {
  useDocumentTitle('Verification')
  const { h, hospitalId } = useMyHospital()
  const { data: docs = [] } = useLive(() => db.select('hospital_documents').filter((d) => d.hospitalId === hospitalId), ['hospital_documents'], [hospitalId])
  const { toast } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  if (!h) return null
  const needs = h.verification === 'needs_attention' || h.verification === 'rejected'
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-[28px] font-semibold">Verification</h1><VerificationPill v={h.verification} /></div>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <ol className="flex items-center gap-2">
          {STAGES.map((s, i) => { const done = s.v.includes(h.verification); return (
            <li key={s.label} className="flex flex-1 items-center gap-2">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', done ? 'bg-brand-600 text-white' : 'bg-mist text-slate-400')}>{done ? <s.icon size={18} /> : <CircleDashed size={18} />}</span>
              <span className={cn('text-[13.5px] font-semibold', done ? 'text-ink' : 'text-slate-400')}>{s.label}</span>
              {i < STAGES.length - 1 && <span className={cn('h-0.5 flex-1 rounded-full', STAGES[i + 1].v.includes(h.verification) ? 'bg-brand-600' : 'bg-line')} />}
            </li>) })}
        </ol>
        <div className="mt-5 rounded-xl bg-canvas p-4 text-[14px] text-slate-700">
          {h.verification === 'verified' && <p className="flex gap-2"><CircleCheck size={18} className="text-brand-600" /> Your facility is verified and listed. Patients see the Medic Hub verified badge.</p>}
          {h.verification === 'pending' && <p>We received your documents{h.submittedAt ? ` ${relTime(h.submittedAt)}` : ''}. A reviewer will pick them up soon, usually within 2 working days.</p>}
          {h.verification === 'under_review' && <p>A reviewer is checking your registration and licences now.</p>}
          {h.verification === 'needs_attention' && <p className="flex gap-2 text-amber-800"><TriangleAlert size={18} /> <span><strong>We need a little more.</strong> {h.verificationNote}</span></p>}
          {h.verification === 'rejected' && <p className="flex gap-2 text-danger-700"><XCircle size={18} /> <span><strong>Not approved.</strong> {h.verificationNote}</span></p>}
        </div>
      </section>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <h2 className="text-[17px] font-semibold">Registration</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">{[['CAC number', h.registration.cacNumber], ['Operating licence', h.registration.licenseNumber], ['Licensing body', h.registration.licensingBody], ['Established', h.registration.yearEstablished], ['Administrator', `${h.admin.name}, ${h.admin.title}`], ['Beds', String(h.registration.bedCount)]].map(([k, v]) => <div key={k}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="text-[14.5px] font-semibold text-ink">{v}</dd></div>)}</dl>
      </section>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <h2 className="text-[17px] font-semibold">Documents</h2>
        <ul className="mt-3 divide-y divide-line">
          {docs.map((d) => <li key={d.id} className="flex items-center gap-3 py-2.5"><FileText size={18} className="text-slate-400" /><span className="flex-1 text-[14px] text-ink">{d.name}</span><span className="text-[12px] text-slate-500">{fmtBytes(d.size)}</span><span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-semibold', d.status === 'accepted' ? 'bg-brand-50 text-brand-700' : d.status === 'needs_attention' ? 'bg-amber-50 text-amber-700' : 'bg-mist text-slate-600')}>{d.status === 'accepted' ? 'Accepted' : d.status === 'needs_attention' ? 'Needs attention' : 'Submitted'}</span></li>)}
          {docs.length === 0 && <li className="py-4 text-[14px] text-slate-500">No documents on file yet.</li>}
        </ul>
        {needs && (
          <div className="mt-4 space-y-3 rounded-xl bg-canvas p-4">
            <label className="btn btn-secondary btn-sm cursor-pointer"><Upload size={15} /> Add documents<input type="file" multiple accept=".pdf,image/*" className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} /></label>
            {files.map((f) => <p key={f.name} className="text-[13px] text-slate-700">{f.name} · {fmtBytes(f.size)}</p>)}
            <button disabled={!files.length || busy} onClick={async () => { setBusy(true); try { const docs = await Promise.all(files.map(async (f) => ({ name: f.name, kind: f.type || 'document', size: f.size, fileId: await uploadFile(f) }))); await resubmitVerification(hospitalId, docs); setFiles([]); toast('success', 'Your verification documents were submitted') } catch (e) { toast('error', 'Upload failed', (e as Error).message) } finally { setBusy(false) } }} className="btn btn-primary btn-sm">{busy && <Spinner />} Resubmit for review</button>
          </div>
        )}
      </section>
    </div>
  )
}
