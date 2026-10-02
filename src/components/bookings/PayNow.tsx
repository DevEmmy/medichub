import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { startPayment, naira, HOLD_MINUTES } from '../../services/payments'
import { useToast } from '../../contexts/ToastContext'
import { Spinner } from '../ui/States'
import type { Booking } from '../../types'

/** Resume payment for a booking that is still awaiting payment. */
export function PayNow({ b, className }: { b: Pick<Booking, 'id' | 'amount' | 'createdAt'>; className?: string }) {
  const nav = useNavigate()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const left = Math.max(0, HOLD_MINUTES - Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 60000))
  return (
    <div className={className}>
      <button disabled={busy} onClick={async (e) => { e.preventDefault(); e.stopPropagation(); setBusy(true); try { const r = await startPayment(b.id); if (r.authorizationUrl.startsWith('#')) nav(r.authorizationUrl.slice(1)); else window.location.assign(r.authorizationUrl) } catch (err) { toast('error', 'Could not start payment', (err as Error).message); setBusy(false) } }}
        className="btn btn-brand w-full" data-testid="pay-now">{busy ? <Spinner /> : <Lock size={16} />} Pay {naira(b.amount ?? 0)} to confirm</button>
      <p className="mt-1.5 text-center text-[12px] text-amber-700">Slot held for {left} more minute{left === 1 ? '' : 's'}.</p>
    </div>
  )
}
