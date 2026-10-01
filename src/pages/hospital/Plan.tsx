import { useState } from 'react'
import { Check, Crown, ShieldCheck, Sparkles } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../contexts/ToastContext'
import { BASIC_FEATURES, downgradeToBasic, isPremium, PREMIUM_FEATURES, PREMIUM_PRICE_NGN, startPremiumTrial, TRIAL_DAYS, trialDaysLeft } from '../../services/plans'
import { cn } from '../../utils/cn'

const naira = (n: number) => '₦' + n.toLocaleString('en-NG')

export default function Plan() {
  useDocumentTitle('Plan')
  const { h } = useMyHospital()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  if (!h) return null
  const premium = isPremium(h)
  const left = trialDaysLeft(h)
  const upgrade = async () => { setBusy(true); try { await startPremiumTrial(h.id); toast('success', 'Premium is on', `${TRIAL_DAYS}-day free trial started. Analytics and automations are unlocked.`) } catch (e) { toast('error', 'Could not upgrade', (e as Error).message) } finally { setBusy(false) } }
  const downgrade = async () => { setBusy(true); try { await downgradeToBasic(h.id); toast('success', 'Back on Basic', 'All core features stay on.') } finally { setBusy(false) } }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><h1 className="text-[28px] font-semibold">Plan</h1><p className="mt-1 text-[14px] text-slate-600">Everything patients rely on is free. Premium adds data analysis and automation that save your staff time.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className={cn('rounded-3xl bg-white p-6 ring-1', !premium ? 'ring-2 ring-brand-500' : 'ring-line')}>
          <div className="flex items-center justify-between"><h2 className="text-[20px] font-semibold">Basic</h2>{!premium && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700">Current plan</span>}</div>
          <p className="mt-1 font-display text-[32px] font-semibold">Free <span className="text-[14px] font-medium text-slate-500">forever</span></p>
          <ul className="mt-4 space-y-2">{BASIC_FEATURES.map((f) => <li key={f} className="flex gap-2 text-[14px] text-slate-700"><Check size={17} className="mt-0.5 shrink-0 text-brand-600" />{f}</li>)}</ul>
          {premium && <button onClick={downgrade} disabled={busy} className="btn btn-secondary btn-sm mt-5">Switch to Basic</button>}
        </section>
        <section className={cn('relative overflow-hidden rounded-3xl bg-ink p-6 text-white', premium && 'ring-2 ring-amber-400')}>
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-[20px] font-semibold"><Crown size={20} className="text-amber-300" /> Premium</h2>{premium && <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[12px] font-semibold text-amber-200">{left !== null ? `Trial · ${left} days left` : 'Current plan'}</span>}</div>
          <p className="mt-1 font-display text-[32px] font-semibold">{naira(PREMIUM_PRICE_NGN)} <span className="text-[14px] font-medium text-white/60">per facility / month</span></p>
          <p className="text-[13px] text-white/60">Everything in Basic, plus:</p>
          <ul className="mt-4 space-y-3">{PREMIUM_FEATURES.map((f) => <li key={f.key} className="flex gap-2 text-[14px]"><Sparkles size={16} className="mt-0.5 shrink-0 text-amber-300" /><span><strong className="block text-white">{f.title}</strong><span className="text-white/70">{f.body}</span></span></li>)}</ul>
          {!premium && <button onClick={upgrade} disabled={busy} className="btn mt-5 w-full bg-amber-400 text-ink hover:bg-amber-300" data-testid="start-trial">{busy ? 'Starting…' : `Start ${TRIAL_DAYS}-day free trial`}</button>}
          <p className="mt-3 text-[12px] text-white/50">No card needed for the trial. Before it ends, the Medic Hub team contacts you to set up billing; if you don't continue, you return to Basic automatically.</p>
        </section>
      </div>
      <p className="flex gap-2 rounded-2xl bg-white p-4 text-[13.5px] text-slate-700 ring-1 ring-line"><ShieldCheck size={18} className="shrink-0 text-brand-600" />Paying never changes where you appear in search or in emergency results. Patients see hospitals by distance, status and availability only.</p>
    </div>
  )
}
