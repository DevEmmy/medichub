import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Info, Salad, Dumbbell, Clock, ChevronDown } from 'lucide-react'
import { MEALS, EXERCISES, WELLNESS_DISCLAIMER } from '../../data/wellness'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'
import type { Meal, Exercise } from '../../types'

export function MealCard({ m }: { m: Meal }) {
  const total = m.protein * 4 + m.carbs * 4 + m.fat * 9 || 1
  const parts = [['Protein', m.protein * 4 / total, 'bg-brand-600'], ['Carbs', m.carbs * 4 / total, 'bg-amber-500'], ['Fat', m.fat * 9 / total, 'bg-coral-500']] as const
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card flex flex-col overflow-hidden">
      <div className="relative h-20" style={{ background: `radial-gradient(90% 120% at 90% 0%, hsl(${m.hue} 75% 70% / .7), transparent 60%), linear-gradient(135deg, hsl(${m.hue} 45% 90%), hsl(${m.hue + 20} 40% 82%))` }}>
        <span className="absolute left-4 top-3 rounded-full bg-white/80 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink backdrop-blur">{m.mealType}</span>
        <span className="absolute bottom-3 right-4 font-display text-[26px] font-semibold text-ink tabular">{m.calories}<span className="ml-1 text-[12px] font-medium text-slate-600">kcal</span></span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-semibold leading-tight">{m.name}</h3>
        <p className="text-[12.5px] text-slate-500">{m.local ? `${m.local} · ` : ''}{m.serving}</p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-mist" aria-hidden>{parts.map(([l, v, c]) => <span key={l} className={c} style={{ width: `${v * 100}%` }} />)}</div>
        <dl className="mt-3 grid grid-cols-4 gap-1 text-center">
          {[['Protein', m.protein], ['Carbs', m.carbs], ['Fat', m.fat], ['Fibre', m.fiber]].map(([k, v]) => <div key={k as string} className="rounded-lg bg-canvas py-1.5"><dt className="text-[10.5px] text-slate-500">{k}</dt><dd className="text-[13.5px] font-semibold text-ink tabular">{v}g</dd></div>)}
        </dl>
        <p className="mt-3 flex-1 text-[13px] leading-relaxed text-slate-600">{m.note}</p>
        <div className="mt-3 flex flex-wrap gap-1">{m.diet.map((d) => <span key={d} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand-800">{d}</span>)}</div>
      </div>
    </motion.article>
  )
}

function ExerciseCard({ e }: { e: Exercise }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.article layout className="card p-4">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Dumbbell size={19} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-ink">{e.name}</span><span className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500"><span>{e.category}</span><span>·</span><span>{e.level}</span><span>·</span><span className="inline-flex items-center gap-1"><Clock size={12} />{e.minutes} min</span></span></span>
        <ChevronDown size={18} className={cn('mt-1 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      <p className="mt-3 text-[14px] text-slate-600">{e.summary}</p>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-2">{e.steps.map((s, i) => <li key={i} className="flex gap-3 text-[14px] text-slate-700"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mist text-[12px] font-bold text-ink tabular">{i + 1}</span>{s}</li>)}</div>
          </motion.ol>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

const MEAL_TYPES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'] as const
const DIETS = ['High protein', 'High fibre', 'Heart-friendly', 'Low carb', 'Light', 'Plant protein']
const CATS = ['All', 'Walking', 'Stretching', 'Mobility', 'Strength', 'Cardio'] as const

export default function Wellness() {
  useDocumentTitle('Wellness')
  const [tab, setTab] = useState<'nutrition' | 'exercise'>('nutrition')
  const [mt, setMt] = useState<(typeof MEAL_TYPES)[number]>('All')
  const [diet, setDiet] = useState<string | null>(null)
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const meals = useMemo(() => MEALS.filter((m) => (mt === 'All' || m.mealType === mt) && (!diet || m.diet.includes(diet))), [mt, diet])
  const ex = EXERCISES.filter((e) => cat === 'All' || e.category === cat)
  return (
    <div className="container-app py-8">
      <p className="eyebrow">Wellness</p>
      <h1 className="mt-2 text-[34px] font-semibold leading-tight sm:text-[42px]">Everyday habits, Nigerian kitchen</h1>
      <p className="mt-3 flex max-w-2xl gap-2 rounded-2xl bg-white px-4 py-3 text-[13.5px] leading-relaxed text-slate-600 shadow-soft ring-1 ring-black/5"><Info size={17} className="mt-0.5 shrink-0 text-brand-700" />{WELLNESS_DISCLAIMER}</p>

      <div className="mt-6 inline-flex rounded-2xl bg-white p-1 shadow-soft ring-1 ring-black/5" role="tablist">
        {([['nutrition', 'Nutrition', Salad], ['exercise', 'Exercise', Dumbbell]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold', tab === k ? 'text-white' : 'text-slate-600')}>
            {tab === k && <motion.span layoutId="wtab" className="absolute inset-0 -z-0 rounded-xl bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative flex items-center gap-2"><I size={16} />{l}</span>
          </button>
        ))}
      </div>

      {tab === 'nutrition' ? (
        <section className="mt-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">{MEAL_TYPES.map((t) => <button key={t} onClick={() => setMt(t)} aria-pressed={mt === t} className={cn('chip shrink-0', mt === t && 'chip-on')}>{t}</button>)}</div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">{DIETS.map((d) => <button key={d} onClick={() => setDiet(diet === d ? null : d)} aria-pressed={diet === d} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 transition', diet === d ? 'bg-brand-600 text-white ring-brand-600' : 'bg-brand-50 text-brand-800 ring-brand-100')}>{d}</button>)}</div>
          <p className="mt-3 text-[12.5px] text-slate-500">Approximate values per typical serving. Recipes and portions vary.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><AnimatePresence mode="popLayout">{meals.map((m) => <MealCard key={m.id} m={m} />)}</AnimatePresence></div>
          {meals.length === 0 && <p className="py-10 text-center text-slate-500">No meals match these filters.</p>}
        </section>
      ) : (
        <section className="mt-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">{CATS.map((t) => <button key={t} onClick={() => setCat(t)} aria-pressed={cat === t} className={cn('chip shrink-0', cat === t && 'chip-on')}>{t}</button>)}</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{ex.map((e) => <ExerciseCard key={e.id} e={e} />)}</div>
          <p className="mt-6 text-[13px] text-slate-500">Stop and seek medical help if you feel chest pain, severe breathlessness, dizziness or faintness during exercise.</p>
        </section>
      )}
    </div>
  )
}
