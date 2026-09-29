import { useState } from 'react'
import { Activity, Baby, Droplets, FlaskConical, Pill as PillIcon, Scissors, Siren, Truck, Wind } from 'lucide-react'
import { Segmented, type SegOption } from '../ui/Segmented'
import { useToast } from '../../contexts/ToastContext'
import { setCapacity, setEmergency, setResource, type HospitalView } from '../../services/hospitals'
import type { Availability, EmergencyCapacity, EmergencyLevel, OverallCapacity, ResourceKey } from '../../types'
import { relTime } from '../../utils/date'

export const EM_OPTS: SegOption<EmergencyLevel>[] = [{ value: 'open', label: 'Open', tone: 'good' }, { value: 'busy', label: 'Busy', tone: 'warn' }, { value: 'closed', label: 'Closed', tone: 'bad' }]
export const AV_OPTS: SegOption<Availability>[] = [{ value: 'available', label: 'Available', tone: 'good' }, { value: 'limited', label: 'Limited', tone: 'warn' }, { value: 'unavailable', label: 'None', tone: 'neutral' }]
export const CAP_OPTS: SegOption<OverallCapacity>[] = [{ value: 'available', label: 'Available', tone: 'good' }, { value: 'moderate', label: 'Moderate', tone: 'warn' }, { value: 'high', label: 'High', tone: 'warn' }, { value: 'full', label: 'Full', tone: 'bad' }]
export const ECAP_OPTS: SegOption<EmergencyCapacity>[] = [{ value: 'available', label: 'Available', tone: 'good' }, { value: 'limited', label: 'Limited', tone: 'warn' }, { value: 'full', label: 'Full', tone: 'bad' }]
export const RESOURCES: { key: ResourceKey; label: string; icon: typeof Wind }[] = [
  { key: 'oxygen', label: 'Oxygen', icon: Wind }, { key: 'pharmacy', label: 'Pharmacy', icon: PillIcon }, { key: 'laboratory', label: 'Laboratory', icon: FlaskConical }, { key: 'ambulance', label: 'Ambulance', icon: Truck },
  { key: 'maternity', label: 'Maternity', icon: Baby }, { key: 'theatre', label: 'Theatre', icon: Scissors }, { key: 'bloodBank', label: 'Blood bank', icon: Droplets },
]

function Row({ icon: Icon, label, children, sub }: { icon: typeof Wind; label: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center gap-2.5 sm:w-48"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mist text-slate-600"><Icon size={16} /></span><div className="min-w-0"><p className="text-[14px] font-semibold text-ink">{label}</p>{sub && <p className="text-[11.5px] text-slate-500">{sub}</p>}</div></div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/** One-tap operational controls. Every change is pushed to patients in realtime. */
export function StatusControls({ h, resources = RESOURCES.slice(0, 4), showEcap = false }: { h: HospitalView; resources?: typeof RESOURCES; showEcap?: boolean }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, fn: () => Promise<void>, msg: string) => {
    setBusy(key)
    try { await fn(); toast('success', 'Live status updated', `Patients now see: ${msg}`) } catch (e) { toast('error', 'Update failed', (e as Error).message) } finally { setBusy(null) }
  }
  return (
    <div className="divide-y divide-line">
      <Row icon={Siren} label="Emergency department" sub={`Updated ${relTime(h.status.updatedAt)}`}>
        <Segmented label="Emergency department status" value={h.status.emergency} options={EM_OPTS} disabled={busy === 'em'} onChange={(v) => run('em', () => setEmergency(h.id, v), `Emergency ${v}`)} />
      </Row>
      <Row icon={Activity} label="Overall capacity" sub={`Updated ${relTime(h.capacity.updatedAt)}`}>
        <Segmented label="Overall capacity" value={h.capacity.overall} options={CAP_OPTS} disabled={busy === 'cap'} onChange={(v) => run('cap', () => setCapacity(h.id, { overall: v }), `Capacity ${v}`)} />
      </Row>
      {showEcap && (
        <Row icon={Siren} label="Emergency capacity">
          <Segmented label="Emergency capacity" value={h.capacity.emergency} options={ECAP_OPTS} disabled={busy === 'ecap'} onChange={(v) => run('ecap', () => setCapacity(h.id, { emergency: v }), `Emergency capacity ${v}`)} />
        </Row>
      )}
      {resources.map((r) => (
        <Row key={r.key} icon={r.icon} label={r.label}>
          <Segmented label={`${r.label} availability`} value={h.status[r.key]} options={AV_OPTS} disabled={busy === r.key} onChange={(v) => run(r.key, () => setResource(h.id, r.key, v), `${r.label} ${v}`)} />
        </Row>
      ))}
    </div>
  )
}
