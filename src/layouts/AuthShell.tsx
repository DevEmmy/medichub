import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Siren, Activity, CalendarCheck, ShieldCheck, ArrowLeft } from 'lucide-react'
import { SCENES } from '../data/scenes'
import { Logo } from '../components/ui/Logo'
import { PageTransition } from './PageTransition'

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1fr_minmax(0,540px)_1fr] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-white xl:flex xl:flex-col">
        <img src={SCENES.doctorMother} alt="" className="absolute inset-0 h-full w-full object-cover motion-safe:animate-[kenburns_24s_ease-in-out_infinite_alternate]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" aria-hidden />
        <div className="absolute inset-0 adire opacity-50" aria-hidden />
        <div className="relative"><Logo light /></div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-[46px] font-extrabold leading-[1] tracking-[-0.02em] text-white">The right hospital, <span className="text-lime-400">right now.</span></h2>
          <ul className="mt-8 space-y-4 text-[15px] text-white/75">
            <li className="flex gap-3"><Activity size={19} className="mt-0.5 text-lime-300" /> Live emergency, capacity and oxygen status from hospitals.</li>
            <li className="flex gap-3"><CalendarCheck size={19} className="mt-0.5 text-lime-300" /> Book a slot and get a QR pass in seconds.</li>
            <li className="flex gap-3"><ShieldCheck size={19} className="mt-0.5 text-lime-300" /> Your health information stays private to you.</li>
          </ul>
        </div>
        <p className="relative mt-10 flex items-center gap-2 text-[13px] text-white/50"><Siren size={15} /> In an emergency, call the nearest hospital emergency unit. You don't need an account.</p>
      </aside>
      <div className="flex min-h-[100dvh] flex-col px-4 py-6 sm:px-8 lg:col-start-2 xl:col-start-2">
        <div className="flex items-center gap-2"><Link to="/" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-white hover:text-ink xl:inline-flex"><ArrowLeft size={15} /> Back to home</Link></div>
        <div className="flex items-center justify-between xl:hidden"><Logo /><Link to="/emergency" className="inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-3 py-2 text-[13px] font-semibold text-danger-700"><Siren size={15} /> Emergency</Link></div>
        <PageTransition className="mx-auto my-auto w-full max-w-[420px] py-10">
          <h1 className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em]">{title}</h1>
          {subtitle && <div className="mt-2 text-[15px] text-slate-600">{subtitle}</div>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-[14px] text-slate-600">{footer}</div>}
        </PageTransition>
      </div>
    </div>
  )
}
