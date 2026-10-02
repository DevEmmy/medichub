import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX, Loader2 } from 'lucide-react'
import { confirmPayment } from '../../services/payments'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

/** Where the payment page sends the patient back. We confirm the payment with the gateway before showing success. */
export default function PaymentVerify() {
  useDocumentTitle('Confirming payment')
  const [sp] = useSearchParams()
  const reference = sp.get('reference') ?? sp.get('trxref') ?? ''
  const [state, setState] = useState<{ status: 'checking' | 'paid' | 'failed' | 'pending'; bookingId?: string; message?: string }>({ status: 'checking' })
  useEffect(() => {
    let tries = 0, alive = true
    const run = async () => {
      try {
        const r = await confirmPayment(reference)
        if (!alive) return
        if (r.status === 'pending' && tries++ < 5) { setState(r); setTimeout(run, 2500); return }
        setState(r)
      } catch (e) { if (alive) setState({ status: 'failed', message: (e as Error).message }) }
    }
    if (reference) void run(); else setState({ status: 'failed', message: 'Missing payment reference.' })
    return () => { alive = false }
  }, [reference])
  return (
    <div className="mx-auto max-w-md py-14 text-center" data-testid="payment-verify" data-status={state.status}>
      {state.status === 'checking' || state.status === 'pending' ? (
        <><Loader2 size={44} className="mx-auto animate-spin text-brand-600" /><h1 className="mt-4 text-[24px] font-semibold">Confirming your payment…</h1><p className="mt-2 text-[14px] text-slate-600">We're checking with the bank. This takes a few seconds. Don't close this page.</p></>
      ) : state.status === 'paid' ? (
        <><CircleCheck size={52} className="mx-auto text-brand-600" /><h1 className="mt-4 text-[26px] font-semibold">Payment confirmed</h1><p className="mt-2 text-[14px] text-slate-600">Your booking is secured. Show your QR pass at the front desk.</p>
          <Link to={state.bookingId ? `/app/bookings/${state.bookingId}` : '/app/bookings'} className="btn btn-brand mt-6 h-12 w-full">View my booking pass</Link></>
      ) : (
        <><CircleX size={52} className="mx-auto text-danger-600" /><h1 className="mt-4 text-[26px] font-semibold">Payment not completed</h1><p className="mt-2 text-[14px] text-slate-600">{state.message ?? 'No money was taken.'}</p>
          <Link to="/app/bookings" className="btn btn-primary mt-6 h-12 w-full">Go to my bookings</Link></>
      )}
      <p className="mt-6 text-[11.5px] text-slate-400">Reference: {reference}</p>
    </div>
  )
}
