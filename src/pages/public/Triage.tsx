import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CalendarPlus, Hospital, RotateCcw, Siren, Clock, CircleCheck, Info } from 'lucide-react'
import { Call112Button } from '../../components/emergency/Call112'
import { TRIAGE_DISCLAIMER } from '../../data/firstAid'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'

interface Q { id: string; text: string; help?: string; level: 'emergency' | 'urgent' }
const QUESTIONS: Q[] = [
  { id: 'breathing', text: 'Are you having difficulty breathing?', help: 'Struggling for breath, unable to speak in full sentences, or lips turning blue.', level: 'emergency' },
  { id: 'chest', text: 'Are you experiencing severe chest pain?', help: 'Crushing, tight or heavy pain, or pain spreading to the arm, jaw or back.', level: 'emergency' },
  { id: 'conscious', text: 'Is the person unconscious or difficult to wake?', level: 'emergency' },
  { id: 'bleeding', text: 'Is there severe bleeding that won\'t stop?', level: 'emergency' },
  { id: 'stroke', text: 'Any sudden face drooping, arm weakness or slurred speech?', level: 'emergency' },
  { id: 'seizure', text: 'Has there been a seizure lasting more than 5 minutes?', level: 'emergency' },
  { id: 'fever', text: 'A high fever for more than 2 days, or a fever in a baby under 3 months?', level: 'urgent' },
  { id: 'vomit', text: 'Vomiting or diarrhoea and unable to keep fluids down?', level: 'urgent' },
  { id: 'pain', text: 'Pain that is getting worse or stopping you from normal activities?', level: 'urgent' },
  { id: 'pregnant', text: 'Are you pregnant with bleeding, severe headache or reduced baby movements?', level: 'urgent' },
]
type Outcome = 'emergency' | 'urgent' | 'routine'

export default function Triage() {
  useDocumentTitle('Check symptoms')
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [dir, setDir] = useState(1)
  const q = QUESTIONS[i]

  const answer = (yes: boolean) => {
    const next = { ...answers, [q.id]: yes }
    setAnswers(next); setDir(1)
    if (yes && q.level === 'emergency') return setOutcome('emergency')
    if (i + 1 < QUESTIONS.length) return setI(i + 1)
    setOutcome(QUESTIONS.some((x) => x.level === 'urgent' && next[x.id]) ? 'urgent' : 'routine')
  }
  const restart = () => { setI(0); setAnswers({}); setOutcome(null) }
  const back = () => { if (outcome) { setOutcome(null); return } setDir(-1); setI(Math.max(0, i - 1)) }

  return (
    <div className="container-app max-w-2xl py-8">
      <p className="eyebrow">Symptom check</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight sm:text-[38px]">Let's help you decide what to do next.</h1>
      <p className="mt-3 flex gap-2 rounded-2xl bg-white px-4 py-3 text-[13.5px] leading-relaxed text-slate-600 shadow-soft ring-1 ring-black/5"><Info size={17} className="mt-0.5 shrink-0 text-brand-700" />{TRIAGE_DISCLAIMER}</p>

      {!outcome && (
        <div className="mt-8">
          <div className="flex items-center justify-between text-[13px] font-medium text-slate-500">
            <span>Question {i + 1} of {QUESTIONS.length}</span>
            {i > 0 && <button onClick={back} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white hover:text-ink"><ArrowLeft size={14} /> Back</button>}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={i + 1} aria-label="Progress">
            <motion.div className="h-full rounded-full bg-brand-600" animate={{ width: `${((i + 1) / QUESTIONS.length) * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
          </div>
          <div className="relative mt-6 min-h-[260px]">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={q.id} custom={dir} initial={{ opacity: 0, x: 24 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 * dir }} transition={{ duration: 0.22 }} className="card p-6 sm:p-8">
                <p className={cn('text-[12px] font-semibold', q.level === 'emergency' ? 'text-danger-600' : 'text-amber-700')}>{q.level === 'emergency' ? 'Danger sign check' : 'Urgency check'}</p>
                <h2 className="mt-2 text-[24px] font-semibold leading-snug sm:text-[27px]" aria-live="polite">{q.text}</h2>
                {q.help && <p className="mt-2 text-[15px] text-slate-600">{q.help}</p>}
                <div className="mt-7 grid grid-cols-2 gap-3">
                  <button onClick={() => answer(true)} className="btn h-16 rounded-2xl bg-ink text-[18px] text-white hover:bg-ink-800">Yes</button>
                  <button onClick={() => answer(false)} className="btn btn-secondary h-16 rounded-2xl text-[18px]">No</button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {outcome && (
        <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="mt-8" role="status" aria-live="assertive">
          {outcome === 'emergency' && (
            <div className="rounded-[28px] bg-danger-600 p-6 text-white shadow-lift sm:p-8">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-bold"><Siren size={15} /> EMERGENCY</p>
              <h2 className="mt-4 text-[30px] font-semibold leading-tight text-white">Get emergency care now.</h2>
              <p className="mt-2 text-[15px] text-white/85">Your answer suggests a possible emergency. Don't wait to see if it gets better.</p>
              <div className="mt-6 rounded-3xl bg-white p-2"><Call112Button size="md" /></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link to="/find?emergency=1" className="btn h-14 bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25"><Hospital size={18} /> Nearest emergency care</Link>
                <Link to="/emergency" className="btn h-14 bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25">First-aid steps</Link>
              </div>
            </div>
          )}
          {outcome === 'urgent' && (
            <div className="rounded-[28px] bg-amber-50 p-6 ring-1 ring-amber-100 sm:p-8">
              <p className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1 text-[13px] font-bold text-white"><Clock size={15} /> URGENT</p>
              <h2 className="mt-4 text-[28px] font-semibold leading-tight">Seek medical attention promptly.</h2>
              <p className="mt-2 text-[15px] text-slate-700">Try to see a doctor today. If things get worse, or you notice any danger signs, call the nearest hospital emergency unit.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Link to="/find?open=1" className="btn btn-primary h-14"><Hospital size={18} /> Find a hospital open now</Link>
                <Link to="/find?appt=1" className="btn btn-secondary h-14"><CalendarPlus size={18} /> Book the earliest slot</Link>
              </div>
            </div>
          )}
          {outcome === 'routine' && (
            <div className="rounded-[28px] bg-brand-50 p-6 ring-1 ring-brand-100 sm:p-8">
              <p className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3 py-1 text-[13px] font-bold text-white"><CircleCheck size={15} /> ROUTINE</p>
              <h2 className="mt-4 text-[28px] font-semibold leading-tight">Consider booking a healthcare appointment.</h2>
              <p className="mt-2 text-[15px] text-slate-700">No danger signs from your answers. A routine appointment is a good next step if you're still concerned.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Link to="/find?appt=1" className="btn btn-primary h-14"><CalendarPlus size={18} /> Book an appointment</Link>
                <Link to="/wellness" className="btn btn-secondary h-14">Wellness tips</Link>
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={back} className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> Change my last answer</button>
            <button onClick={restart} className="btn btn-ghost btn-sm"><RotateCcw size={15} /> Start again</button>
          </div>
          <p className="mt-4 text-[13px] text-slate-500">{TRIAGE_DISCLAIMER}</p>
        </motion.div>
      )}
    </div>
  )
}
