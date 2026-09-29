import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { AuthShell } from '../../layouts/AuthShell'
import { Field } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/States'
import { requestPasswordReset } from '../../services/auth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function ForgotPassword() {
  useDocumentTitle('Reset password')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<{ sent: boolean; token: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    try { const r = await requestPasswordReset(email); setState({ sent: true, token: r.token }) } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }
  return (
    <AuthShell title="Reset your password" subtitle="Enter the email you signed up with and we'll send a reset link." footer={<Link to="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>}>
      {state?.sent ? (
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-black/5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><MailCheck size={21} /></span>
          <p className="mt-4 font-display text-[18px] font-semibold">Check your inbox</p>
          <p className="mt-1 text-[14px] leading-relaxed text-slate-600">If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 30 minutes.</p>
          {state.token && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3.5 text-[13px] text-amber-700 ring-1 ring-amber-100">
              <p className="font-semibold">Demo inbox</p>
              <p className="mt-1">Email delivery isn't connected in this demo, so here is the secure link that would be emailed:</p>
              <Link to={`/reset-password/${state.token}`} className="btn btn-primary btn-sm mt-3">Open reset link</Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" error={error} />
          <button className="btn btn-primary w-full" disabled={loading}>{loading && <Spinner />} Send reset link</button>
        </form>
      )}
    </AuthShell>
  )
}
