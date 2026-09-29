import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthShell } from '../../layouts/AuthShell'
import { Field } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/States'
import { resetPassword } from '../../services/auth'
import { useToast } from '../../contexts/ToastContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function ResetPassword() {
  useDocumentTitle('Choose a new password')
  const { token = '' } = useParams()
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const nav = useNavigate()
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (pw !== pw2) { setError('The passwords do not match.'); return }
    setLoading(true)
    try { await resetPassword(token, pw); toast('success', 'Password updated', 'Sign in with your new password.'); nav('/login', { replace: true }) } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }
  return (
    <AuthShell title="Choose a new password" footer={<Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">Request a new link</Link>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" hint="At least 8 characters with a number." />
        <Field label="Confirm new password" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        {error && <p role="alert" className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>{loading && <Spinner />} Update password</button>
      </form>
    </AuthShell>
  )
}
