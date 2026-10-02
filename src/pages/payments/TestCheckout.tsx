import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CreditCard, FlaskConical, Lock } from 'lucide-react'
import { completeTestPayment, testTransaction } from '../../services/testGateway'
import { naira } from '../../services/payments'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

/** Demo only: stands in for Paystack's hosted checkout. No real card, no real money. */
export default function TestCheckout() {
  useDocumentTitle('Test checkout')
  const { reference = '' } = useParams()
  const nav = useNavigate()
  const tx = testTransaction(reference)
  const [busy, setBusy] = useState(false)
  if (!tx) return <p className="py-16 text-center text-slate-600">This checkout has expired.</p>
  const finish = (ok: boolean) => { setBusy(true); setTimeout(() => { completeTestPayment(reference, ok); nav(`/payment/verify?reference=${encodeURIComponent(reference)}`, { replace: true }) }, 900) }
  return (
    <div className="mx-auto max-w-md py-6" data-testid="test-checkout">
      <p className="flex items-center justify-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-amber-800"><FlaskConical size={15} /> Test mode · no real money is charged</p>
      <section className="mt-4 rounded-3xl bg-white p-6 ring-1 ring-line">
        <p className="text-[13px] text-slate-500">Paying</p>
        <p className="text-[17px] font-semibold">{tx.hospital}</p>
        <p className="mt-3 font-display text-[36px] font-bold tabular">{naira(tx.amountKobo / 100)}</p>
        <p className="text-[12.5px] text-slate-500">{tx.email} · Ref {reference}</p>
        <div className="mt-5 space-y-2 rounded-2xl bg-canvas p-4 text-[14px]">
          <p className="flex items-center gap-2 font-semibold"><CreditCard size={16} /> Test card</p>
          <p className="font-mono tracking-wider">4084 0840 8408 4081</p>
          <p className="font-mono text-slate-600">Expiry 12/30 · CVV 408</p>
        </div>
        <button disabled={busy} onClick={() => finish(true)} className="btn btn-brand mt-5 h-14 w-full text-[16px]" data-testid="test-pay"><Lock size={17} /> {busy ? 'Processing…' : `Pay ${naira(tx.amountKobo / 100)}`}</button>
        <button disabled={busy} onClick={() => finish(false)} className="btn btn-ghost mt-2 w-full">Simulate a declined card</button>
      </section>
      <p className="mt-3 text-center text-[12px] text-slate-500">In the live app this page is Paystack's secure checkout (card, bank transfer or USSD).</p>
    </div>
  )
}
