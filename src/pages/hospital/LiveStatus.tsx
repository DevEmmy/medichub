import { FreshnessPanel } from '../../components/hospital-admin/FreshnessPanel'
import { Link } from 'react-router-dom'
import { BedDouble, ExternalLink, HeartPulse } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { StatusControls, RESOURCES, EM_OPTS } from '../../components/hospital-admin/StatusControls'
import { Stepper } from '../../components/ui/Stepper'
import { Segmented } from '../../components/ui/Segmented'
import { setCapacity, saveDepartment } from '../../services/hospitals'
import { useToast } from '../../contexts/ToastContext'

export default function LiveStatus() {
  useDocumentTitle('Live status')
  const { h } = useMyHospital()
  const { toast } = useToast()
  if (!h) return null
  const cap = async (patch: Parameters<typeof setCapacity>[1]) => { try { await setCapacity(h.id, patch) } catch (e) { toast('error', 'Update failed', (e as Error).message) } }
  const occ = h.capacity.bedsTotal ? Math.round(((h.capacity.bedsTotal - h.capacity.bedsAvailable) / h.capacity.bedsTotal) * 100) : 0
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold">Live status & capacity</h1><p className="mt-1 text-[14px] text-slate-600">What you set here is what patients see on your profile and in search, instantly.</p></div>
        <a href={`#/hospitals/${h.id}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm"><ExternalLink size={15} /> Open patient view</a>
      </div>
      <FreshnessPanel h={h} detailed />
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line"><h2 className="text-[17px] font-semibold">Emergency & services</h2><StatusControls h={h} resources={RESOURCES} showEcap /></section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-line" aria-labelledby="beds-h">
        <h2 id="beds-h" className="flex items-center gap-2 text-[17px] font-semibold"><BedDouble size={18} /> Beds</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-canvas p-4"><p className="text-[12.5px] font-medium text-slate-500">Available beds</p><div className="mt-2"><Stepper label="available beds" value={h.capacity.bedsAvailable} max={h.capacity.bedsTotal} onChange={(v) => cap({ bedsAvailable: v })} /></div></div>
          <div className="rounded-xl bg-canvas p-4"><p className="text-[12.5px] font-medium text-slate-500">Total beds</p><div className="mt-2"><Stepper label="total beds" value={h.capacity.bedsTotal} min={h.capacity.bedsAvailable} onChange={(v) => cap({ bedsTotal: v })} /></div></div>
          <div className="rounded-xl bg-canvas p-4"><p className="text-[12.5px] font-medium text-slate-500">ICU beds free</p><div className="mt-2"><Stepper label="ICU beds free" value={h.capacity.icuAvailable} max={50} onChange={(v) => cap({ icuAvailable: v })} /></div></div>
        </div>
        <div className="mt-4"><div className="flex justify-between text-[12.5px] text-slate-600"><span>Occupancy</span><span className="font-semibold text-ink tabular">{occ}%</span></div><div className="mt-1.5 h-2 rounded-full bg-mist"><div className={`h-full rounded-full transition-all ${occ > 90 ? 'bg-danger-500' : occ > 70 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${occ}%` }} /></div></div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-line" aria-labelledby="dep-h">
        <div className="flex items-center justify-between"><h2 id="dep-h" className="flex items-center gap-2 text-[17px] font-semibold"><HeartPulse size={18} /> Department status</h2><Link to="/hospital/profile?tab=departments" className="text-[13px] font-semibold text-brand-700">Manage departments</Link></div>
        <ul className="mt-2 divide-y divide-line">
          {h.departments.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"><span className="text-[14px] font-semibold text-ink sm:w-56">{d.name}</span>
              <div className="flex-1 sm:max-w-sm"><Segmented size="sm" label={`${d.name} status`} value={d.status} options={EM_OPTS} onChange={async (v) => { await saveDepartment(h.id, { ...d, status: v }); toast('success', `${d.name}: ${v}`) }} /></div></li>
          ))}
        </ul>
      </section>
    </div>
  )
}
