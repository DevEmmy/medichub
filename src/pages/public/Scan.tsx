import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QrCode, TriangleAlert } from 'lucide-react'
import { QrScanner } from '../../components/ui/QrScanner'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { db } from '../../lib/store'

/** Patients scan the Medic Hub poster at a hospital entrance to open its live status, book or rate. */
export function parseHospitalQr(text: string): string | null {
  const m = text.match(/\/hospitals\/([a-z0-9_-]+)/i) ?? text.match(/^MEDICHUB-H:([a-z0-9_-]+)/i)
  return m ? m[1] : null
}

export default function Scan() {
  useDocumentTitle('Scan a QR code')
  const nav = useNavigate()
  const [msg, setMsg] = useState<string | null>(null)
  const [key, setKey] = useState(0)
  const handle = (text: string) => {
    const pass = text.match(/\/pass\/(MED-[A-Z0-9]{6})\?t=([A-Za-z0-9]+)/i)
    if (pass) { nav(`/pass/${pass[1].toUpperCase()}?t=${pass[2]}`); return }
    if (text.toUpperCase().startsWith('MEDICHUB:')) { const p = text.split(':'); nav(`/pass/${(p[1] || '').toUpperCase()}?t=${p[2] ?? ''}`); return }
    const id = parseHospitalQr(text)
    if (id && db.select('hospitals').some((h) => h.id === id)) { nav(`/hospitals/${id}?src=qr`); return }
    setMsg(id ? 'This hospital is not on Medic Hub yet.' : 'This QR code is not a Medic Hub code.')
    setKey((k) => k + 1)
  }
  return (
    <div className="mx-auto max-w-lg py-4">
      <h1 className="flex items-center gap-2 text-[26px] font-semibold"><QrCode size={24} /> Scan a QR code</h1>
      <p className="mt-1 text-[14px] text-slate-600">Scan a hospital's Medic Hub poster to see its live status and book, or scan a booking pass to check that it's genuine and see its details.</p>
      <div className="mt-4"><QrScanner key={key} hint="Point at a Medic Hub QR code" onCode={handle} /></div>
      {msg && <p role="alert" className="mt-3 flex gap-2 rounded-2xl bg-amber-50 p-3 text-[14px] font-medium text-amber-800 ring-1 ring-amber-100"><TriangleAlert size={18} className="shrink-0" />{msg}</p>}
      <p className="mt-4 text-[13px] text-slate-500">No code nearby? <Link to="/find" className="font-semibold text-brand-700 underline">Search hospitals</Link></p>
    </div>
  )
}
