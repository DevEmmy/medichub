import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, Bell, ShieldPlus, Languages } from 'lucide-react'
import { LanguagePicker } from '../../components/navigation/LanguagePicker'
import { useT } from '../../i18n/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { updateAccount } from '../../services/auth'
import { myPatientProfile, savePatientProfile } from '../../services/health'
import { Field, SelectField } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/States'
import { CITIES } from '../../data/locations'

export default function Profile() {
  useDocumentTitle('Profile')
  const { user, signOut, refresh } = useAuth()
  const { data: pp } = useLive(myPatientProfile, ['patient_profiles'])
  const { toast } = useToast()
  const nav = useNavigate()
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', city: pp?.city ?? '', dateOfBirth: pp?.dateOfBirth ?? '', gender: pp?.gender ?? '' })
  const [busy, setBusy] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const { langName } = useT()
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!f.name.trim()) { setErr('Enter your name.'); return }
    setBusy(true); setErr(null)
    try { await updateAccount({ name: f.name, phone: f.phone }); await savePatientProfile({ city: f.city, dateOfBirth: f.dateOfBirth, gender: f.gender, onboarded: true }); refresh(); toast('success', 'Your profile was updated') } catch (e) { toast('error', 'Could not save', (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="container-app max-w-2xl py-8">
      <h1 className="text-[30px] font-semibold">Profile & settings</h1>
      <section className="card mt-6 space-y-4 p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold">Personal details</h2>
        <Field label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={err} autoComplete="name" />
        <Field label="Email" value={user?.email ?? ''} disabled hint="Contact support to change your sign-in email." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
          <SelectField label="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}><option value="">Select</option>{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</SelectField>
          <Field label="Date of birth" type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} />
          <SelectField label="Sex" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Prefer not to say</option><option>Female</option><option>Male</option></SelectField>
        </div>
        <button onClick={save} disabled={busy} className="btn btn-primary">{busy && <Spinner />} Save changes</button>
      </section>
      <section className="card mt-4 divide-y divide-line">
        <Link to="/app/health" className="flex items-center gap-3 p-4 hover:bg-canvas"><ShieldPlus size={18} className="text-slate-500" /><span className="flex-1 text-[15px] font-medium">Health Vault & emergency contacts</span></Link>
        <button onClick={() => setLangOpen(true)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-canvas"><Languages size={18} className="text-slate-500" /><span className="flex-1 text-[15px] font-medium">Language</span><span className="text-[14px] text-slate-500">{langName}</span></button>
        <Link to="/app/notifications" className="flex items-center gap-3 p-4 hover:bg-canvas"><Bell size={18} className="text-slate-500" /><span className="flex-1 text-[15px] font-medium">Notifications</span></Link>
        <Link to="/forgot-password" className="flex items-center gap-3 p-4 hover:bg-canvas"><KeyRound size={18} className="text-slate-500" /><span className="flex-1 text-[15px] font-medium">Change password</span></Link>
        <button onClick={() => { signOut(); nav('/'); toast('info', 'Signed out') }} className="flex w-full items-center gap-3 p-4 text-left text-danger-700 hover:bg-danger-50"><LogOut size={18} /><span className="flex-1 text-[15px] font-medium">Sign out</span></button>
      </section>
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  )
}
