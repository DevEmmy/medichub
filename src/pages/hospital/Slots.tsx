import { useMemo, useState } from 'react'
import { CalendarOff, CalendarPlus, Plus } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { db } from '../../lib/store'
import { addSlotTime, closeDay, updateSlot } from '../../services/hospitals'
import { Stepper } from '../../components/ui/Stepper'
import { SelectField } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/States'
import { Pill } from '../../components/ui/StatusPill'
import { useToast } from '../../contexts/ToastContext'
import { addDays, fmtTime, parseDate, today } from '../../utils/date'
import { cn } from '../../utils/cn'

export default function Slots() {
  useDocumentTitle('Appointment slots')
  const { h, hospitalId } = useMyHospital()
  const { toast } = useToast()
  const bookable = h?.services.filter((s) => s.bookable && s.active) ?? []
  const [serviceId, setServiceId] = useState<string>('')
  const sid = serviceId || bookable[0]?.id || ''
  const [date, setDate] = useState(today())
  const [newTime, setNewTime] = useState('17:00')
  const [confirmClose, setConfirmClose] = useState(false)
  const { data: slots = [] } = useLive(() => db.select('hospital_slots').filter((s) => s.hospitalId === hospitalId && s.serviceId === sid), ['hospital_slots'], [sid, hospitalId])
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today(), i)), [])
  const daySlots = slots.filter((s) => s.date === date).sort((a, b) => a.time.localeCompare(b.time))
  const totals = daySlots.reduce((a, s) => ({ cap: a.cap + s.capacity, booked: a.booked + s.booked }), { cap: 0, booked: 0 })
  if (!h) return null
  if (!bookable.length) return <EmptyState icon={<CalendarPlus size={22} />} title="No bookable services" body="Turn on online booking for a service in your hospital profile to create appointment slots." />

  const upd = async (id: string, cap: number) => { try { await updateSlot(h.id, id, cap) } catch (e) { toast('error', 'Could not update slot', (e as Error).message) } }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="text-[28px] font-semibold">Appointment slots</h1><p className="mt-1 text-[14px] text-slate-600">Set how many patients you can see at each time. Patients see the remaining places live.</p></div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-end">
        <SelectField label="Service" value={sid} onChange={(e) => setServiceId(e.target.value)}>{bookable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectField>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Date">
          {days.map((d) => { const dd = parseDate(d), n = slots.filter((s) => s.date === d), left = n.reduce((a, s) => a + s.capacity - s.booked, 0); return (
            <button key={d} role="tab" aria-selected={date === d} onClick={() => { setDate(d); setConfirmClose(false) }} className={cn('flex min-w-[64px] shrink-0 flex-col items-center rounded-xl px-2 py-2 ring-1', date === d ? 'bg-ink text-white ring-ink' : 'bg-white ring-line')}>
              <span className="text-[11px] opacity-70">{d === today() ? 'Today' : dd.toLocaleDateString('en-NG', { weekday: 'short' })}</span><span className="font-display text-[18px] font-semibold tabular">{dd.getDate()}</span><span className={cn('text-[10.5px]', date === d ? 'text-white/70' : 'text-slate-500')}>{n.length ? `${left} left` : 'Closed'}</span>
            </button>) })}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <p className="text-[14px] font-semibold text-ink">{parseDate(date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <span className="text-[13px] text-slate-500 tabular">{totals.booked} booked of {totals.cap}</span>
          <div className="ml-auto flex items-center gap-2">
            {daySlots.length > 0 && (confirmClose
              ? <><span className="text-[13px] text-slate-600">Stop new bookings this day?</span><button onClick={() => setConfirmClose(false)} className="btn btn-ghost btn-sm">No</button><button onClick={async () => { await closeDay(h.id, sid, date); setConfirmClose(false); toast('success', 'Day closed to new bookings', 'Existing bookings are kept.') }} className="btn btn-danger btn-sm">Yes, close</button></>
              : <button onClick={() => setConfirmClose(true)} className="btn btn-ghost btn-sm text-danger-700"><CalendarOff size={15} /> Close day</button>)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead className="bg-canvas text-[12px] text-slate-500"><tr><th className="px-5 py-2.5 font-medium">Time</th><th className="px-3 py-2.5 font-medium">Capacity</th><th className="px-3 py-2.5 font-medium">Booked</th><th className="px-3 py-2.5 font-medium">Availability</th></tr></thead>
            <tbody className="divide-y divide-line">
              {daySlots.map((s) => { const left = s.capacity - s.booked; return (
                <tr key={s.id}>
                  <td className="px-5 py-2.5 font-semibold text-ink tabular">{fmtTime(s.time)}</td>
                  <td className="px-3 py-2.5"><Stepper label={`capacity at ${fmtTime(s.time)}`} value={s.capacity} min={s.booked} max={50} onChange={(v) => upd(s.id, v)} /></td>
                  <td className="px-3 py-2.5 tabular text-slate-700">{s.booked}</td>
                  <td className="px-3 py-2.5">{left <= 0 ? <Pill tone="bad" size="sm">Full</Pill> : <Pill tone={left <= 1 ? 'warn' : 'good'} size="sm">{left} {left === 1 ? 'slot' : 'slots'}</Pill>}</td>
                </tr>) })}
              {daySlots.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No times on this day. Add one below.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
          <label className="space-y-1"><span className="block text-[12px] font-medium text-slate-600">Add a time</span><input type="time" value={newTime} step={900} onChange={(e) => setNewTime(e.target.value)} className="input h-10 min-h-0 w-36" /></label>
          <button onClick={async () => { try { await addSlotTime(h.id, sid, date, newTime, 3); toast('success', `Added ${fmtTime(newTime)}`, '3 places. Adjust capacity as needed.') } catch (e) { toast('error', 'Could not add time', (e as Error).message) } }} className="btn btn-primary btn-sm h-10"><Plus size={15} /> Add time</button>
        </div>
      </section>
    </div>
  )
}
