import { useState } from 'react'
import { BadgeCheck, MessageSquareReply } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLive } from '../../hooks/useLive'
import { useToast } from '../../contexts/ToastContext'
import { ratingSummary, replyToReview, reviewsFor } from '../../services/reviews'
import { Stars } from '../../components/ui/Stars'
import { relTime } from '../../utils/date'
import type { Review } from '../../types'

function ReplyBox({ hospitalId, r }: { hospitalId: string; r: Review }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (r.reply) return <div className="mt-3 rounded-xl bg-brand-50/70 p-3"><p className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-800"><MessageSquareReply size={13} /> Your reply · {relTime(r.reply.at)}</p><p className="mt-1 text-[13.5px] text-slate-700">{r.reply.body}</p></div>
  if (!open) return <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm mt-3"><MessageSquareReply size={14} /> Reply publicly</button>
  return (
    <div className="mt-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} placeholder="Thank the patient, or say what you're changing." className="w-full rounded-xl border border-line px-3 py-2 text-[14px]" />
      <div className="mt-2 flex gap-2"><button className="btn btn-primary btn-sm" onClick={async () => { try { await replyToReview(hospitalId, r.id, text); toast('success', 'Reply posted') } catch (e) { toast('error', 'Could not reply', (e as Error).message) } }}>Post reply</button><button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </div>
  )
}

export default function HospitalReviews() {
  useDocumentTitle('Ratings')
  const { hospitalId } = useMyHospital()
  const { data: reviews = [] } = useLive(() => (hospitalId ? reviewsFor(hospitalId) : []), ['hospital_reviews'], [hospitalId])
  const { data: sum } = useLive(() => (hospitalId ? ratingSummary(hospitalId) : null), ['hospital_reviews'], [hospitalId])
  if (!hospitalId) return null
  const unanswered = reviews.filter((r) => !r.reply).length
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="text-[28px] font-semibold">Ratings & reviews</h1><p className="mt-1 text-[14px] text-slate-600">Every rating comes from a patient who checked in for a booked visit. Replying is free on every plan.</p></div>
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-[12.5px] font-medium text-slate-500">Average</p><p className="mt-1 font-display text-[28px] font-semibold tabular">{sum?.count ? sum.avg.toFixed(1) : '—'}</p>{sum?.count ? <Stars value={sum.avg} size={13} /> : null}</div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-[12.5px] font-medium text-slate-500">Ratings</p><p className="mt-1 font-display text-[28px] font-semibold tabular">{sum?.count ?? 0}</p></div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-[12.5px] font-medium text-slate-500">Awaiting reply</p><p className="mt-1 font-display text-[28px] font-semibold tabular">{unanswered}</p></div>
      </section>
      {reviews.length === 0 ? <p className="rounded-2xl bg-white p-5 text-[14px] text-slate-600 ring-1 ring-line">No ratings yet. Patients can rate after they check in for a visit.</p> : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2"><p className="text-[14px] font-semibold">{r.authorName} <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-700"><BadgeCheck size={12} /> Verified visit</span></p><span className="text-[12px] text-slate-500">{relTime(r.createdAt)}</span></div>
              <Stars value={r.rating} className="mt-1" />
              {r.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded-md bg-canvas px-2 py-0.5 text-[11.5px] font-medium text-slate-600 ring-1 ring-line">{t}</span>)}</div>}
              {r.comment && <p className="mt-2 text-[14px] text-slate-700">{r.comment}</p>}
              <ReplyBox hospitalId={hospitalId} r={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
