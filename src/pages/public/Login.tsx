import { useState, type FormEvent } from 'react'
import { DEMO } from '../../config'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, UserRound, Building2, ShieldCheck } from 'lucide-react'
import { AuthShell } from '../../layouts/AuthShell'
import { Field } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/States'
import { homeFor, useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../data/seed'
import { myHospitalId } from '../../services/core'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function Login() {
  useDocumentTitle('Sign in')
  const { signIn } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const go = async (e?: string, p?: string) => {
    setError(null); setLoading(true)
    try {
      const u = await signIn(e ?? email, p ?? password)
      toast('success', `Welcome back, ${u.name.split(' ')[0]}`)
      const next = params.get('next')
      const home = homeFor(u.role, myHospitalId())
      nav(next && (u.role === 'patient' ? !next.startsWith('/hospital') && !next.startsWith('/admin') : next.startsWith(home)) ? next : home, { replace: true })
    } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); if (!email || !password) { setError('Enter your email and password.'); return } go() }

  return (
    <AuthShell title="Sign in" subtitle={<>New to Medic Hub? <Link to="/signup" className="font-semibold text-brand-700 hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <div className="relative">
          <Field label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-[30px] grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-[13.5px] font-medium text-brand-700 hover:underline">Forgot password?</Link></div>
        {error && <p role="alert" className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>{loading && <Spinner />} Sign in</button>
      </form>
      {DEMO && <div className="mt-8">
        <p className="eyebrow text-center">Or use a demo account</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([['patient', UserRound], ['hospital', Building2], ['admin', ShieldCheck]] as const).map(([k, I]) => (
            <button key={k} type="button" disabled={loading} onClick={() => { setEmail(DEMO_ACCOUNTS[k].email); setPassword(DEMO_PASSWORD); go(DEMO_ACCOUNTS[k].email, DEMO_PASSWORD) }}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-[12.5px] font-semibold text-ink shadow-soft ring-1 ring-black/5 transition hover:-translate-y-0.5">
              <I size={18} className="text-brand-700" />{DEMO_ACCOUNTS[k].label.split(' ')[0]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[12.5px] text-slate-500">This is the demo: accounts you create are kept in this browser only.</p>
      </div>}
    </AuthShell>
  )
}
