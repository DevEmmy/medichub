import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Phone, Smartphone } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { QRCode } from '../ui/QRCode'
import { isFramed, isMobileUA } from '../../utils/env'

const PUBLIC_URL = 'https://devemmy.github.io/medichub/'
const pretty = (n: string) => n.replace(/^\+234(\d{3})(\d{3})(\d+)$/, '+234 $1 $2 $3')

/**
 * Every `tel:` link in the app goes through here.
 * - Phone browser: opens the dialler directly (normal link behaviour).
 * - Inside an embedded viewer (where dialling is blocked) or on a computer: shows the number big,
 *   with Call, Copy, and a QR code a phone can scan to dial.
 */
export function CallSheetHost() {
  const [num, setNum] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="tel:"]') as HTMLAnchorElement | null
      if (!a) return
      const n = a.getAttribute('href')!.slice(4)
      if (isMobileUA && !isFramed) return // the phone dials
      e.preventDefault()
      if (isFramed && isMobileUA) { try { window.open(`tel:${n}`, '_blank') } catch { /* blocked */ } }
      setCopied(false); setNum(n)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  const copy = async () => { try { await navigator.clipboard.writeText(num ?? ''); setCopied(true) } catch { /* ignore */ } }
  return (
    <Modal open={!!num} onClose={() => setNum(null)} title="Call this number" size="sm">
      {num && (
        <div className="text-center" data-testid="call-sheet">
          <p className="select-all font-display text-[30px] font-bold tracking-wide text-ink tabular">{pretty(num)}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a href={`tel:${num}`} onClick={(e) => { e.stopPropagation(); if (isFramed) { e.preventDefault(); try { window.open(`tel:${num}`, '_blank') } catch { /* blocked */ } } }} className="btn btn-danger"><Phone size={17} /> Call now</a>
            <button onClick={copy} className="btn btn-secondary"><Copy size={16} /> {copied ? 'Copied' : 'Copy number'}</button>
          </div>
          {!isMobileUA && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-white p-3 ring-1 ring-line"><QRCode value={`tel:${num}`} size={150} /></div>
              <p className="flex items-center gap-1.5 text-[13px] text-slate-600"><Smartphone size={14} /> Scan with your phone camera to dial.</p>
            </div>
          )}
          {isFramed && <a href={PUBLIC_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 underline"><ExternalLink size={14} /> Open Medic Hub in your browser for one-tap calling</a>}
        </div>
      )}
    </Modal>
  )
}
