import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CircleAlert, MailCheck } from 'lucide-react'
import { AuthShell } from '../../layouts/AuthShell'
import { Spinner } from '../../components/ui/States'
import { verifyEmail } from '../../services/auth'
import { useAuth, homeFor } from '../../contexts/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function VerifyEmail() {
  useDocumentTitle('Confirm your email')
  const { token = '' } = useParams()
  const { user, hospitalId, refresh } = useAuth()
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null)
  useEffect(() => {
    verifyEmail(token).then((r) => { setState({ ok: true, message: `${r.email} is confirmed. Thanks, ${r.name.split(' ')[0]}.` }); refresh() }, (e) => setState({ ok: false, message: (e as Error).message }))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthShell title="Confirm your email" subtitle="One last step to secure your account.">
      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-black/5" data-testid="verify-result" data-ok={state?.ok ? '1' : '0'}>
        {!state ? <p className="flex items-center gap-2 text-slate-600"><Spinner /> Checking your link…</p> : (
          <>
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${state.ok ? 'bg-brand-50 text-brand-700' : 'bg-danger-50 text-danger-700'}`}>{state.ok ? <MailCheck size={21} /> : <CircleAlert size={21} />}</span>
            <p className="mt-4 font-display text-[18px] font-semibold">{state.ok ? 'Email confirmed' : 'That link didn’t work'}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-slate-600">{state.message}</p>
            <Link to={user ? homeFor(user.role, hospitalId) : '/login'} className="btn btn-primary mt-4 w-full">{user ? 'Continue' : 'Sign in'}</Link>
          </>
        )}
      </div>
    </AuthShell>
  )
}
