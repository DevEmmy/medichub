import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Siren, Activity, CalendarCheck, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { PageTransition } from './PageTransition'

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1fr_minmax(0,540px)_1fr] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-white xl:flex xl:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_20%,rgba(63,168,129,.35),transparent_70%),radial-gradient(40%_40%_at_90%_90%,rgba(228,103,74,.18),transparent_70%)]" aria-hidden />
        <div className="relative"><Logo light /></div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-[38px] font-semibold leading-tight text-white">Know where to go. Know what's there.</h2>
          <ul className="mt-8 space-y-4 text-[15px] text-white/75">
            <li className="flex gap-3"><Activity size={19} className="mt-0.5 text-brand-300" /> Live emergency, capacity and oxygen status from hospitals.</li>
            <li className="flex gap-3"><CalendarCheck size={19} className="mt-0.5 text-brand-300" /> Book a slot and get a QR pass in seconds.</li>
            <li className="flex gap-3"><ShieldCheck size={19} className="mt-0.5 text-brand-300" /> Your health information stays private to you.</li>
          </ul>
        </div>
        <p className="relative mt-10 flex items-center gap-2 text-[13px] text-white/50"><Siren size={15} /> In an emergency, call 112. You don't need an account.</p>
      </aside>
      <div className="flex min-h-[100dvh] flex-col px-4 py-6 sm:px-8 lg:col-start-2 xl:col-start-2">
        <div className="flex items-center justify-between xl:hidden"><Logo /><Link to="/emergency" className="inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-3 py-2 text-[13px] font-semibold text-danger-700"><Siren size={15} /> Emergency</Link></div>
        <PageTransition className="mx-auto my-auto w-full max-w-[420px] py-10">
          <h1 className="text-[30px] font-semibold leading-tight">{title}</h1>
          {subtitle && <div className="mt-2 text-[15px] text-slate-600">{subtitle}</div>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-[14px] text-slate-600">{footer}</div>}
        </PageTransition>
      </div>
    </div>
  )
}
