import { Printer } from 'lucide-react'
import { useMyHospital } from '../../hooks/useMyHospital'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { QRCode } from '../../components/ui/QRCode'
import { Logo } from '../../components/ui/Logo'

export function hospitalQrUrl(id: string) {
  const base = `${location.origin}${location.pathname}`
  return `${base}#/hospitals/${id}?src=qr`
}

export default function QrPoster() {
  useDocumentTitle('QR poster')
  const { h } = useMyHospital()
  if (!h) return null
  const url = hospitalQrUrl(h.id)
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold">Entrance QR poster</h1><p className="mt-1 text-[14px] text-slate-600">Print and place at your gate, reception and emergency entrance. Patients scan it to see your live status, book, and rate their visit.</p></div>
        <button onClick={() => window.print()} className="btn btn-primary btn-sm"><Printer size={15} /> Print poster</button>
      </div>
      <section className="print-area mx-auto flex max-w-[520px] flex-col items-center rounded-3xl bg-white p-8 text-center ring-1 ring-line">
        <Logo />
        <h2 className="mt-6 font-display text-[28px] font-semibold leading-tight text-ink">{h.name}</h2>
        <p className="mt-1 text-[15px] text-slate-600">Scan for live status, bookings and emergency line</p>
        <div className="mt-6 rounded-2xl bg-white p-3 ring-1 ring-line"><QRCode value={url} size={280} /></div>
        <p className="mt-4 break-all font-mono text-[11px] text-slate-500">{url}</p>
        <p className="mt-6 rounded-xl bg-danger-50 px-4 py-3 text-[15px] font-semibold text-danger-700">Emergency? Go straight to the emergency entrance{h.emergencyPhone ? ` or call ${h.emergencyPhone}` : ''}.</p>
      </section>
    </div>
  )
}
