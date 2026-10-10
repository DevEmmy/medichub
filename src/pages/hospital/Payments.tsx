import { useEffect, useState } from 'react'
import { BadgeCheck, Banknote, Landmark, ShieldCheck } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useLive } from '../../hooks/useLive'
import { useToast } from '../../contexts/ToastContext'
import { db } from '../../lib/store'
import { disablePayouts, hospitalPayments, listBanks, naira, paymentsAvailable, savePayoutAccount, verifyBankAccount } from '../../services/payments'
import { Spinner } from '../../components/ui/States'
import { fmtDate } from '../../utils/date'
import { cn } from '../../utils/cn'

const STATUS: Record<string, string> = { success: 'bg-brand-50 text-brand-700', initialized: 'bg-slate-100 text-slate-600', failed: 'bg-danger-50 text-danger-700', abandoned: 'bg-slate-100 text-slate-500', refunded: 'bg-amber-50 text-amber-700' }
const LABEL: Record<string, string> = { success: 'Paid', initialized: 'Started', failed: 'Failed', abandoned: 'Abandoned', refunded: 'Refunded' }

function AccountForm({ hospitalId, onDone }: { hospitalId: string; onDone: () => void }) {
  const { toast } = useToast()
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([])
  const [bank, setBank] = useState('')
  const [acct, setAcct] = useState('')
  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState<'verify' | 'save' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { listBanks().then(setBanks).catch((e) => setErr((e as Error).message)) }, [])
  useEffect(() => { setName(null); setErr(null) }, [bank, acct])
  const verify = async () => { setBusy('verify'); setErr(null); try { setName((await verifyBankAccount(hospitalId, bank, acct)).accountName) } catch (e) { setErr((e as Error).message) } finally { setBusy(null) } }
  const save = async () => { setBusy('save'); try { const r = await savePayoutAccount(hospitalId, bank, acct); toast('success', 'Payment account verified', `${r.bankName} ••••${r.accountLast4}`); onDone() } catch (e) { setErr((e as Error).message) } finally { setBusy(null) } }
  return (
    <div className="space-y-3" data-testid="payout-form">
      <label className="block"><span className="text-[13px] font-medium text-slate-700">Bank</span>
        <select value={bank} onChange={(e) => setBank(e.target.value)} className="input mt-1" aria-label="Bank"><option value="">Choose your bank</option>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select></label>
      <label className="block"><span className="text-[13px] font-medium text-slate-700">Account number (NUBAN)</span>
        <input value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="0123456789" className="input mt-1 font-mono tracking-wider" aria-label="Account number" /></label>
      {name && <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[14px] font-semibold text-brand-800" data-testid="resolved-name"><BadgeCheck size={17} /> {name}</p>}
      {err && <p role="alert" className="rounded-xl bg-danger-50 px-3 py-2.5 text-[13.5px] font-medium text-danger-700">{err}</p>}
      {!name ? <button onClick={verify} disabled={!bank || acct.length !== 10 || !!busy} className="btn btn-primary w-full">{busy === 'verify' ? <Spinner /> : null} Verify account</button>
        : <button onClick={save} disabled={!!busy} className="btn btn-brand w-full">{busy === 'save' ? <Spinner /> : <ShieldCheck size={16} />} This is our account. Save and start receiving payments</button>}
      <p className="text-[12px] text-slate-500">We confirm the account name with your bank before saving. Payments settle directly to this account; Medic Hub never holds your money. (In this demo, payments are simulated.) Only the last four digits are stored.</p>
    </div>
  )
}

export default function Payments() {
  useDocumentTitle('Payments')
  const { h, hospitalId } = useMyHospital()
  const { toast } = useToast()
  const { data: payout } = useLive(() => db.select('hospital_payouts').find((p) => p.hospitalId === hospitalId) ?? null, ['hospital_payouts'], [hospitalId])
  const { data: txs = [] } = useLive(() => (hospitalId ? hospitalPayments(hospitalId) : []), ['payments'], [hospitalId])
  const [editing, setEditing] = useState(false)
  if (!h || !hospitalId) return null
  const paid = txs.filter((t) => t.status === 'success')
  const total = paid.reduce((a, t) => a + t.amountKobo, 0) / 100
  const refunded = txs.filter((t) => t.status === 'refunded').reduce((a, t) => a + t.amountKobo, 0) / 100
  const bookings = db.select('bookings')
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div><h1 className="text-[28px] font-semibold">Payments</h1><p className="mt-1 text-[14px] text-slate-600">Patients pay for appointments when they book. Money goes straight to your bank account.</p></div>
      {!paymentsAvailable() && <p className="rounded-2xl bg-amber-50 p-4 text-[14px] text-amber-800 ring-1 ring-amber-100">Online payment is not switched on for this Medic Hub server yet. Patients pay at the hospital for now.</p>}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Landmark size={18} /> Settlement account</h2>
        {h.verification !== 'verified' ? <p className="mt-2 text-[14px] text-slate-600">You can add a bank account once your hospital is verified.</p>
          : payout && !editing ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-[16px] font-semibold">{payout.accountName}</p>
                <p className="text-[14px] text-slate-600">{payout.bankName} ••••{payout.accountLast4} · verified {fmtDate(payout.verifiedAt.slice(0, 10))}{payout.provider === 'test' ? ' · test mode' : ''}</p>
                <p className={cn('mt-1 text-[13px] font-semibold', h.payoutsEnabled ? 'text-brand-700' : 'text-slate-500')}>{h.payoutsEnabled ? 'Online payments are ON' : 'Online payments are paused: patients pay at the hospital'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">Change account</button>
                {h.payoutsEnabled && <button onClick={async () => { await disablePayouts(hospitalId); toast('info', 'Online payments paused') }} className="btn btn-ghost btn-sm">Pause</button>}
              </div>
            </div>
          ) : paymentsAvailable() ? <div className="mt-3 max-w-md"><AccountForm hospitalId={hospitalId} onDone={() => setEditing(false)} /></div> : null}
        <p className="mt-3 text-[12.5px] text-slate-500">Patients only pay online for services that have a fee. Set fees under Hospital profile › Services.</p>
      </section>
      <section className="grid grid-cols-3 gap-3">
        {[['Received', naira(total)], ['Paid bookings', String(paid.length)], ['Refunded', naira(refunded)]].map(([k, v]) => <div key={k} className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-[12.5px] font-medium text-slate-500">{k}</p><p className="mt-1 font-display text-[24px] font-semibold tabular">{v}</p></div>)}
      </section>
      <section className="rounded-2xl bg-white ring-1 ring-line">
        <h2 className="flex items-center gap-2 p-5 pb-3 text-[17px] font-semibold"><Banknote size={18} /> Transactions</h2>
        {txs.length === 0 ? <p className="px-5 pb-5 text-[14px] text-slate-500">No payments yet.</p> : (
          <ul className="divide-y divide-line">
            {txs.map((t) => { const b = bookings.find((x) => x.id === t.bookingId); return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{b?.patientName ?? 'Patient'} · {b?.ref}</p><p className="truncate text-[12.5px] text-slate-500">{fmtDate((t.paidAt ?? t.createdAt).slice(0, 10))} · {t.reference}{t.channel ? ` · ${t.channel}` : ''}</p></div>
                <span className="font-semibold tabular">{naira(t.amountKobo / 100)}</span>
                <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', STATUS[t.status])}>{LABEL[t.status]}</span>
              </li>
            ) })}
          </ul>
        )}
      </section>
    </div>
  )
}
