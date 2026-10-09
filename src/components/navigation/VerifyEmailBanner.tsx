import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailWarning } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { resendVerification } from '../../services/auth'
import { useToast } from '../../contexts/ToastContext'

const DEMO_KEY = 'medichub.demoVerify'
export const rememberDemoVerify = (token?: string) => { try { if (token) sessionStorage.setItem(DEMO_KEY, token) } catch { /* ignore */ } }

/** Reminds signed-in users to confirm their email, with a resend button. */
export function VerifyEmailBanner() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState<string | null>(() => { try { return sessionStorage.getItem(DEMO_KEY) } catch { return null } })
  if (!user || user.emailVerifiedAt || user.viaPhone || user.role === 'admin') return null
  const resend = async () => {
    setBusy(true)
    try { const r = await resendVerification(); if (r.demoVerifyToken) { rememberDemoVerify(r.demoVerifyToken); setDemo(r.demoVerifyToken) } toast('success', 'Confirmation email sent', `Check ${user.email}, including the spam folder.`) }
    catch (e) { toast('error', 'Could not send', (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="border-b border-amber-200 bg-amber-50" data-testid="verify-banner">
      <div className="container-app flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-[13.5px] text-amber-900">
        <MailWarning size={17} className="shrink-0" />
        <span className="min-w-0 flex-1">Confirm your email: we sent a link to <b className="break-all">{user.email}</b>.</span>
        {demo ? <Link to={`/verify-email/${demo}`} className="font-bold underline" data-testid="demo-verify">Demo inbox: open the link</Link> : null}
        <button onClick={resend} disabled={busy} className="font-bold underline disabled:opacity-60">{busy ? 'Sending…' : 'Resend'}</button>
      </div>
    </div>
  )
}
