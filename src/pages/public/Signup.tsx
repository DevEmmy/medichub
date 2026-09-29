import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Building2, Check, UserRound } from 'lucide-react'
import { AuthShell } from '../../layouts/AuthShell'
import { Field } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { validatePassword } from '../../services/auth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'

type R = 'patient' | 'hospital'

export default function Signup() {
  useDocumentTitle('Create account')
  const [params] = useSearchParams()
  const [role, setRole] = useState<R | null>((params.get('role') as R) || null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = role === 'hospital' ? 'Enter your full name.' : 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errs.email = 'Enter a valid email address.'
    const pw = validatePassword(form.password); if (pw) errs.password = pw
    setErrors(errs); setError(null)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await signUp({ ...form, role: role! })
      toast('success', 'Account created', role === 'hospital' ? 'Next, tell us about your facility.' : 'Welcome to Medic Hub.')
      nav(role === 'hospital' ? '/hospital/onboarding' : '/app', { replace: true })
    } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }
  const pwStrength = form.password ? Math.min(3, (form.password.length >= 8 ? 1 : 0) + (/\d/.test(form.password) ? 1 : 0) + (/[^a-zA-Z0-9]/.test(form.password) || form.password.length >= 12 ? 1 : 0)) : 0

  return (
    <AuthShell title={role ? (role === 'patient' ? 'Create your account' : 'Register your facility') : 'What are you?'}
      subtitle={role ? <button onClick={() => setRole(null)} className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-ink"><ArrowLeft size={15} /> Change account type</button> : 'Choose the account that fits you.'}
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></>}>
      <AnimatePresence mode="wait">
        {!role ? (
          <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-3" role="radiogroup" aria-label="Account type">
            {([['patient', UserRound, "I'm a Patient", 'Find hospitals, book appointments and keep your health information ready.'], ['hospital', Building2, "I'm a Hospital", 'Publish live availability, manage bookings and reach patients nearby.']] as const).map(([k, I, t, d]) => (
              <button key={k} role="radio" aria-checked={false} onClick={() => setRole(k)} className="group flex items-start gap-4 rounded-2xl bg-white p-5 text-left shadow-soft ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-brand-300">
                <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', k === 'patient' ? 'bg-brand-50 text-brand-700' : 'bg-ink text-white')}><I size={22} /></span>
                <span><span className="block font-display text-[18px] font-semibold text-ink">{t}</span><span className="mt-1 block text-[14px] leading-relaxed text-slate-600">{d}</span></span>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.form key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} onSubmit={submit} className="space-y-4" noValidate>
            <Field label={role === 'hospital' ? 'Your full name' : 'Full name'} value={form.name} onChange={set('name')} autoComplete="name" error={errors.name} hint={role === 'hospital' ? 'You will be the administrator for your facility.' : undefined} />
            <Field label={role === 'hospital' ? 'Work email' : 'Email'} type="email" value={form.email} onChange={set('email')} autoComplete="email" error={errors.email} />
            <Field label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+234 803 000 0000" />
            <div>
              <Field label="Password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" error={errors.password} hint="At least 8 characters with a number." />
              <div className="mt-2 flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full transition', i < pwStrength ? (pwStrength === 3 ? 'bg-brand-500' : 'bg-amber-500') : 'bg-line')} />)}</div>
            </div>
            {error && <p role="alert" className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
            <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Spinner /> : <Check size={17} />} Create account</button>
            <p className="text-center text-[12.5px] leading-relaxed text-slate-500">Your health information is private. Hospitals only see what you share when you book.</p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
