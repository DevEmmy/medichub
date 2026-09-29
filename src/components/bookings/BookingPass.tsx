import { motion } from 'framer-motion'
import { Download, Printer, CalendarCheck, Navigation } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BookingView } from '../../services/bookings'
import { qrPayload } from '../../services/bookings'
import { QRCode, qrDataUrl } from '../ui/QRCode'
import { BookingStatusPill } from '../ui/StatusPill'
import { fmtDate, fmtTime } from '../../utils/date'
import { isFramed } from '../../utils/env'
import { directionsUrl } from '../../utils/geo'

async function downloadPass(b: BookingView) {
  const W = 720, H = 1180, c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')!
  const round = (px: number, py: number, w: number, h: number, r: number) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath() }
  x.fillStyle = '#F7F8F5'; x.fillRect(0, 0, W, H)
  x.fillStyle = '#fff'; round(40, 40, W - 80, H - 80, 36); x.fill()
  x.fillStyle = '#0A1F1A'; round(40, 40, W - 80, 380, 36); x.fill(); x.fillRect(40, 380, W - 80, 40)
  x.fillStyle = '#A7DCC5'; x.font = '600 22px Inter, sans-serif'; x.fillText('MEDIC HUB', 84, 104); x.textAlign = 'right'; x.fillText('BOOKING PASS', W - 84, 104); x.textAlign = 'left'
  x.fillStyle = '#fff'; x.font = '600 44px Outfit, Inter, sans-serif'; x.fillText(b.serviceName, 84, 200)
  x.font = '400 26px Inter, sans-serif'; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(b.hospitalName, 84, 250); x.fillText(`${b.hospitalArea}, ${b.hospitalCity}`, 84, 290)
  x.fillStyle = '#fff'; x.font = '600 34px Inter, sans-serif'; x.fillText(`${fmtDate(b.date)} · ${fmtTime(b.time)}`, 84, 370)
  const rows: [string, string][] = [['Patient', b.patientName], ['Department', b.departmentName ?? '—'], ['Reference', b.ref], ['Status', b.status.replace('_', ' ')]]
  rows.forEach(([k, v], i) => { const px = 84 + (i % 2) * 290, py = 490 + Math.floor(i / 2) * 100; x.fillStyle = '#6B7A76'; x.font = '500 20px Inter'; x.fillText(k, px, py); x.fillStyle = '#0A1F1A'; x.font = '600 28px Inter'; x.fillText(v, px, py + 38) })
  const img = new Image(); img.src = await qrDataUrl(qrPayload(b), 360)
  await new Promise((r) => { img.onload = r })
  x.drawImage(img, (W - 340) / 2, 720, 340, 340)
  x.fillStyle = '#52625E'; x.font = '500 20px Inter'; x.textAlign = 'center'; x.fillText('Show this code at the front desk', W / 2, 1100)
  const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `${b.ref}.png`; a.click()
}

export function BookingPass({ b, animate = false, compactActions = false }: { b: BookingView; animate?: boolean; compactActions?: boolean }) {
  return (
    <div>
      <motion.div className="print-area mx-auto w-full max-w-[400px]" initial={animate ? { opacity: 0, y: 40, rotateX: 18, scale: 0.94 } : false} animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 170, damping: 20, delay: animate ? 0.15 : 0 }} style={{ transformPerspective: 900 }}>
        <div className="overflow-hidden rounded-[28px] bg-white shadow-lift ring-1 ring-black/5">
          <div className="relative bg-ink px-6 pb-6 pt-5 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_100%_0%,rgba(63,168,129,.35),transparent_60%)]" aria-hidden />
            <div className="relative flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200"><span>Medic Hub</span><span>Booking pass</span></div>
            <p className="relative mt-5 font-display text-[24px] font-semibold leading-tight">{b.serviceName}</p>
            <p className="relative mt-1 text-[14px] text-white/70">{b.hospitalName}</p>
            <div className="relative mt-5 grid grid-cols-2 gap-3">
              <div><p className="text-[11px] uppercase tracking-wider text-white/50">Date</p><p className="mt-0.5 font-display text-[19px] font-semibold">{fmtDate(b.date)}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-white/50">Time</p><p className="mt-0.5 font-display text-[19px] font-semibold tabular">{fmtTime(b.time)}</p></div>
            </div>
          </div>
          <div className="relative h-6 bg-white" aria-hidden>
            <span className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-canvas" /><span className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-canvas" />
            <span className="absolute inset-x-6 top-3 border-t-2 border-dashed border-line" />
          </div>
          <div className="px-6 pb-6">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3.5">
              <div><dt className="text-[11.5px] text-slate-500">Patient</dt><dd className="text-[14.5px] font-semibold text-ink">{b.patientName}</dd></div>
              <div><dt className="text-[11.5px] text-slate-500">Department</dt><dd className="text-[14.5px] font-semibold text-ink">{b.departmentName ?? '—'}</dd></div>
              <div><dt className="text-[11.5px] text-slate-500">Location</dt><dd className="text-[14.5px] font-semibold text-ink">{b.hospitalArea}, {b.hospitalCity}</dd></div>
              <div><dt className="text-[11.5px] text-slate-500">Status</dt><dd className="mt-0.5"><BookingStatusPill status={b.status} size="sm" /></dd></div>
            </dl>
            <div className="mt-5 flex flex-col items-center rounded-2xl bg-canvas p-5">
              <motion.div initial={animate ? { opacity: 0, scale: 0.6 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ delay: animate ? 0.55 : 0, type: 'spring', stiffness: 260, damping: 18 }} className="rounded-xl bg-white p-3 shadow-soft">
                <QRCode value={qrPayload(b)} size={168} />
              </motion.div>
              <p className="mt-3 text-[11.5px] uppercase tracking-wider text-slate-500">Booking reference</p>
              <p className="select-all font-mono text-[22px] font-bold tracking-[0.12em] text-ink">{b.ref}</p>
            </div>
            <p className="mt-3 text-center text-[12px] text-slate-500">{b.demo ? 'Demo booking: this hospital is not on Medic Hub yet, so it has not received this booking.' : 'Show this code at the front desk. Arrive 15 minutes early.'}</p>
          </div>
        </div>
      </motion.div>
      <div className="no-print mx-auto mt-4 flex max-w-[400px] flex-wrap justify-center gap-2">
        {!compactActions && <Link to="/app/bookings" className="btn btn-secondary btn-sm"><CalendarCheck size={15} /> My bookings</Link>}
        <a href={directionsUrl(b.hospitalLat, b.hospitalLng)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Navigation size={15} /> Directions</a>
        {!isFramed && <button onClick={() => window.print()} className="btn btn-secondary btn-sm"><Printer size={15} /> Print pass</button>}
        {!isFramed && <button onClick={() => downloadPass(b)} className="btn btn-secondary btn-sm"><Download size={15} /> Download</button>}
      </div>
      {isFramed && <p className="no-print mt-2 text-center text-[12px] text-slate-500">Print and download are available when Medic Hub runs in its own tab. Your pass is always in My Bookings.</p>}
    </div>
  )
}
