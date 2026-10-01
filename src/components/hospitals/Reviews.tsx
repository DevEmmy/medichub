import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, MessageSquareReply, Star } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { rateableVisits, ratingSummary, REVIEW_TAGS, reviewsFor, submitReview } from '../../services/reviews'
import { Stars, StarInput } from '../ui/Stars'
import { fmtDate, relTime } from '../../utils/date'
import { cn } from '../../utils/cn'

function RateForm({ hospitalId }: { hospitalId: string }) {
  const { data: visits = [] } = useLive(() => rateableVisits(hospitalId), ['bookings', 'hospital_reviews'], [hospitalId])
  const { toast } = useToast()
  const [bookingId, setBookingId] = useState('')
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  if (!visits.length) return null
  const bid = bookingId || visits[0].id
  const send = async () => {
    if (!rating) return toast('error', 'Choose a star rating')
    setBusy(true)
    try { await submitReview(bid, { rating, tags, comment }); toast('success', 'Thanks for rating your visit', 'It helps other patients choose.'); setRating(0); setTags([]); setComment('') }
    catch (e) { toast('error', 'Could not post rating', (e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <div className="mt-4 rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-100" data-testid="rate-form">
      <p className="text-[15px] font-semibold text-ink">How was your visit?</p>
      {visits.length > 1 ? (
        <select value={bid} onChange={(e) => setBookingId(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px]">
          {visits.map((v) => <option key={v.id} value={v.id}>{v.serviceName} · {fmtDate(v.date)}</option>)}
        </select>
      ) : <p className="mt-0.5 text-[13px] text-slate-600">{visits[0].serviceName} · {fmtDate(visits[0].date)}</p>}
      <div className="mt-3"><StarInput value={rating} onChange={setRating} /></div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REVIEW_TAGS.map((t) => { const on = tags.includes(t); return (
          <button key={t} type="button" aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t].slice(0, 4))}
            className={cn('rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 transition', on ? 'bg-ink text-white ring-ink' : 'bg-white text-slate-700 ring-line hover:ring-slate-300')}>{t}</button>
        ) })}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={3} placeholder="Anything other patients should know? (optional)" className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px]" />
      <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[11.5px] text-slate-500">Shown with your first name and initial only.</p><button onClick={send} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Posting…' : 'Post rating'}</button></div>
    </div>
  )
}

export function ReviewsSection({ hospitalId, publicRecord }: { hospitalId: string; publicRecord?: boolean }) {
  const { user } = useAuth()
  const { data: reviews = [] } = useLive(() => reviewsFor(hospitalId), ['hospital_reviews'], [hospitalId])
  const { data: sum } = useLive(() => ratingSummary(hospitalId), ['hospital_reviews'], [hospitalId])
  const [all, setAll] = useState(false)
  const shown = all ? reviews : reviews.slice(0, 3)
  return (
    <section aria-labelledby="rv-h" data-testid="reviews">
      <h2 id="rv-h" className="text-[20px] font-semibold">Ratings & reviews</h2>
      <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        {sum && sum.count > 0 ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="text-center sm:w-36"><p className="font-display text-[44px] font-semibold leading-none text-ink tabular">{sum.avg.toFixed(1)}</p><Stars value={sum.avg} size={16} className="mt-1.5" /><p className="mt-1 text-[12px] text-slate-500">{sum.count} verified {sum.count === 1 ? 'visit' : 'visits'}</p></div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => { const c = sum.dist[n - 1]; return (
                <div key={n} className="flex items-center gap-2 text-[12px] text-slate-600"><span className="w-3 tabular">{n}</span><Star size={11} className="fill-amber-400 text-amber-400" /><div className="h-2 flex-1 rounded-full bg-mist"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(c / sum.count) * 100}%` }} /></div><span className="w-6 text-right tabular">{c}</span></div>
              ) })}
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-slate-600">No ratings yet. {publicRecord ? 'Ratings open to patients who book and attend a visit through Medic Hub.' : 'Be the first after your visit.'}</p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-500"><BadgeCheck size={14} className="text-brand-600" /> Only patients who checked in for a booked visit can rate. Ratings never change emergency results.</p>
        {user?.role === 'patient' ? <RateForm hospitalId={hospitalId} /> : !user && <p className="mt-3 text-[13px] text-slate-600"><Link to="/login" className="font-semibold text-brand-700 underline">Sign in</Link> to rate a visit you've had here.</p>}
      </div>
      {shown.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {shown.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2"><p className="text-[14px] font-semibold text-ink">{r.authorName} <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-700"><BadgeCheck size={12} /> Verified visit</span></p><span className="text-[12px] text-slate-500">{relTime(r.createdAt)}</span></div>
              <Stars value={r.rating} size={14} className="mt-1" />
              {r.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded-md bg-canvas px-2 py-0.5 text-[11.5px] font-medium text-slate-600 ring-1 ring-line">{t}</span>)}</div>}
              {r.comment && <p className="mt-2 text-[14px] leading-relaxed text-slate-700">{r.comment}</p>}
              {r.reply && <div className="mt-3 rounded-xl bg-brand-50/70 p-3"><p className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-800"><MessageSquareReply size={13} /> Reply from the hospital</p><p className="mt-1 text-[13.5px] text-slate-700">{r.reply.body}</p></div>}
            </li>
          ))}
        </ul>
      )}
      {reviews.length > 3 && <button onClick={() => setAll(!all)} className="btn btn-secondary btn-sm mt-3">{all ? 'Show fewer' : `Show all ${reviews.length} reviews`}</button>}
    </section>
  )
}
