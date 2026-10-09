import { Link } from 'react-router-dom'
import { ArrowRight, BookOpenCheck, Hospital, Phone, Stethoscope, Droplet, Contact, Smartphone } from 'lucide-react'
import { EmergencyShell } from '../../layouts/EmergencyShell'
import { NearestEmergency } from '../../components/emergency/NearestEmergency'
import { DynIcon } from '../../components/ui/Icon'
import { EMERGENCY_GUIDES } from '../../data/firstAid'
import { useAuth } from '../../contexts/AuthContext'
import { useLive } from '../../hooks/useLive'
import { myContacts, myHealthProfile } from '../../services/health'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useT } from '../../i18n/LanguageContext'
import type { Key } from '../../i18n/strings'
import { Bot } from 'lucide-react'
import { USSD_CODE } from '../../config'

function Snapshot() {
  const { data: hp } = useLive(myHealthProfile, ['health_profiles'])
  const { data: contacts = [] } = useLive(myContacts, ['emergency_contacts'])
  const primary = contacts.find((c) => c.primary) ?? contacts[0]
  if (!hp) return null
  const cells = [['Blood group', hp.bloodGroup || '—'], ['Genotype', hp.genotype || '—'], ['Allergies', hp.allergies.join(', ') || 'None recorded'], ['Conditions', hp.conditions.join(', ') || 'None recorded']]
  return (
    <section aria-labelledby="snap-h" className="mt-8 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-black/5">
      <div className="flex items-center justify-between"><h2 id="snap-h" className="flex items-center gap-2 text-[17px] font-semibold"><Droplet size={18} className="text-danger-600" /> Emergency snapshot</h2><Link to="/app/health" className="text-[13px] font-semibold text-brand-700">Edit</Link></div>
      <p className="mt-1 text-[13px] text-slate-500">Show this to responders or hospital staff.</p>
      <dl className="mt-4 grid grid-cols-2 gap-2.5">
        {cells.map(([k, v]) => <div key={k} className="rounded-2xl bg-canvas p-3.5"><dt className="text-[12px] font-medium text-slate-500">{k}</dt><dd className="mt-0.5 font-display text-[19px] font-semibold leading-tight text-ink">{v}</dd></div>)}
      </dl>
      {primary && (
        <a href={`tel:${primary.phone.replace(/\s/g, '')}`} className="mt-3 flex min-h-[60px] items-center gap-3 rounded-2xl bg-ink px-4 text-white">
          <Contact size={20} /><span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Call {primary.name}</span><span className="block text-[12.5px] text-white/60">{primary.relationship} · <span className="select-all">{primary.phone}</span></span></span><Phone size={18} />
        </a>
      )}
    </section>
  )
}

export default function Emergency() {
  useDocumentTitle('Emergency')
  const { user } = useAuth()
  const { t } = useT()
  return (
    <EmergencyShell>
      <h1 className="sr-only">Emergency</h1>
      <NearestEmergency />
      <p className="mx-auto mt-3 max-w-xl text-center text-[13px] leading-relaxed text-slate-600">{t('em.safety')}</p>

      <Link to="/find?emergency=1" className="mt-6 flex min-h-[72px] items-center gap-4 rounded-3xl bg-ink px-5 text-white shadow-lift transition active:scale-[0.99]">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Hospital size={22} /></span>
        <span className="flex-1"><span className="block font-display text-[19px] font-semibold">{t('em.findHospitals')}</span><span className="block text-[13px] text-white/60">{t('em.findSub')}</span></span>
        <ArrowRight size={20} />
      </Link>

      <section aria-labelledby="what-h" className="mt-10">
        <h2 id="what-h" className="text-[24px] font-semibold">{t('em.what')}</h2>
        <p className="mt-1 text-[14px] text-slate-600">{t('em.tap')}</p>
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {EMERGENCY_GUIDES.map((g) => (
            <li key={g.slug}>
              <Link to={`/emergency/${g.slug}`} className="flex h-full min-h-[104px] flex-col justify-between gap-3 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-danger-200 active:scale-[0.98]">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-danger-50 text-danger-600"><DynIcon name={g.icon} /></span>
                <span className="font-display text-[16.5px] font-semibold leading-tight text-ink">{t(('g.' + g.slug) as Key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
        <Link to="/triage" className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-4 shadow-soft ring-1 ring-black/5"><Stethoscope size={20} className="text-brand-700" /><span className="flex-1 text-[15px] font-semibold">{t('em.notSure')}</span><ArrowRight size={18} className="text-slate-400" /></Link>
        <Link to="/first-aid" className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-4 shadow-soft ring-1 ring-black/5"><BookOpenCheck size={20} className="text-brand-700" /><span className="flex-1 text-[15px] font-semibold">{t('em.library')}</span><ArrowRight size={18} className="text-slate-400" /></Link>
        <Link to="/assistant" className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-4 shadow-soft ring-1 ring-black/5 sm:col-span-2"><Bot size={20} className="text-brand-700" /><span className="flex-1 text-[15px] font-semibold">{t('em.askAi')}</span><ArrowRight size={18} className="text-slate-400" /></Link>
        <Link to="/phone" className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-4 shadow-soft ring-1 ring-black/5 sm:col-span-2"><Smartphone size={20} className="text-brand-700" /><span className="flex-1 text-[15px] font-semibold">No smartphone or data? Dial {USSD_CODE}</span><ArrowRight size={18} className="text-slate-400" /></Link>
      </div>
      {user?.role === 'patient' && <Snapshot />}
    </EmergencyShell>
  )
}
