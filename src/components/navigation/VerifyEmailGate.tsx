import { useState, type ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { MailCheck, RefreshCw, LogOut, Siren } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { resendVerification } from '../../services/auth'
import { needsEmailConfirm } from '../../services/core'
import { syncTables } from '../../lib/rpc'
import { BACKEND } from '../../config'
import { Logo } from '../ui/Logo'

// Pages anyone can always open: confirming the email itself, and emergency help (never locked).
const OPEN = [/^\/verify-email\//, /^\/reset-password\//, /^\/emergency/, /^\/first-aid/, /^\/login/, /^\/signup/]

/** Until the account's email is confirmed, the app shows only this screen (emergency help stays open). */
export function VerifyEmailGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const { toast } = useToast()
  const [busy, setBusy] = useState<'resend' | 'check' | null>(null)
  if (!BACKEND || !needsEmailConfirm(user) || OPEN.some((r) => r.test(pathname))) return <>{children}</>
  const resend = async () => {
    setBusy('resend')
    try { await resendVerification(); toast('success', 'Email sent', `Check ${user!.email}, including spam.`) }
    catch (e) { toast('error', 'Could not send', (e as Error).message) } finally { setBusy(null) }
  }
  const check = async () => {
    setBusy('check')
    try { await syncTables(['users']) } catch { /* offline */ } finally { setBusy(null) }
  }
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-canvas px-4 py-10" data-testid="verify-gate">
      <main className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-soft ring-1 ring-black/5">
        <div className="flex justify-center"><Logo /></div>
        <span className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700"><MailCheck size={30} /></span>
        <h1 className="mt-5 font-display text-[26px] font-bold text-ink">Confirm your email</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">We sent a link to <strong className="break-all text-ink">{user!.email}</strong>. Open it to start using Medic Hub. This page opens by itself once you've confirmed.</p>
        <p className="mt-2 text-[13px] text-slate-500">Can't find it? Check your spam or promotions folder.</p>
        <div className="mt-6 grid gap-2">
          <button onClick={check} disabled={!!busy} className="btn btn-primary"><RefreshCw size={16} className={busy === 'check' ? 'animate-spin' : ''} /> I've confirmed it</button>
          <button onClick={resend} disabled={!!busy} className="btn btn-secondary">{busy === 'resend' ? 'Sending…' : 'Send the email again'}</button>
          <button onClick={signOut} className="btn btn-ghost"><LogOut size={16} /> Use a different email</button>
        </div>
        <Link to="/emergency" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-bold text-danger-700 underline"><Siren size={16} /> Emergency? Get help now</Link>
      </main>
    </div>
  )
}
