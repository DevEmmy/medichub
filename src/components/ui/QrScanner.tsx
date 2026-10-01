import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, ImageUp, X } from 'lucide-react'

// Works on every modern browser: uses the native BarcodeDetector where available (fast, Android
// Chrome), otherwise decodes camera frames with jsQR (iPhone Safari, Firefox, desktop).
// "Scan from a photo" covers devices without a camera or when camera permission is blocked.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Detector = { detect: (src: any) => Promise<{ rawValue: string }[]> }
function nativeDetector(): Detector | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (window as any).BarcodeDetector
    return BD ? new BD({ formats: ['qr_code'] }) : null
  } catch { return null }
}

function decodeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): string | null {
  const img = ctx.getImageData(0, 0, w, h)
  const r = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' })
  return r?.data ?? null
}

export async function decodeImageFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    // Try a few sizes: phone photos are huge, screenshots can be tiny. Add a white margin (quiet zone).
    for (const target of [1000, 700, 1400]) {
      const scale = target / Math.max(img.width, img.height)
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale), pad = Math.round(target * 0.08)
      const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.imageSmoothingEnabled = scale < 1
      ctx.drawImage(img, pad, pad, w, h)
      const text = decodeCanvas(ctx, c.width, c.height)
      if (text) return text
    }
    return null
  } finally { URL.revokeObjectURL(url) }
}

export function QrScanner({ onCode, onClose, hint = 'Point the camera at the QR code' }: { onCode: (text: string) => void; onClose?: () => void; hint?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [photoErr, setPhotoErr] = useState<string | null>(null)
  const done = useRef(false)
  const emit = (t: string) => { if (done.current) return; done.current = true; try { navigator.vibrate?.(60) } catch { /* ignore */ } onCode(t) }

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, alive = true
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('This browser cannot open the camera. Scan from a photo instead.'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
        const v = video.current
        if (!v || !alive) return
        v.srcObject = stream; v.setAttribute('playsinline', 'true'); await v.play()
        const det = nativeDetector()
        let last = 0
        const tick = async (t: number) => {
          if (!alive || done.current) return
          if (t - last > 120 && v.readyState >= 2) {
            last = t
            try {
              if (det) { const r = await det.detect(v); if (r[0]?.rawValue) return emit(r[0].rawValue) }
              else if (ctx) {
                const w = Math.min(640, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w)
                canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h)
                const text = decodeCanvas(ctx, w, h); if (text) return emit(text)
              }
            } catch { /* keep scanning */ }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (e) {
        const name = (e as Error).name
        setErr(name === 'NotAllowedError' ? 'Camera permission was blocked. Allow camera access in your browser settings, or scan from a photo.' : 'No camera available. Scan from a photo instead.')
      }
    })()
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fromPhoto = async (f?: File) => {
    if (!f) return
    setPhotoErr(null)
    const text = await decodeImageFile(f).catch(() => null)
    if (text) emit(text); else setPhotoErr('No QR code found in that photo. Try a closer, sharper picture.')
  }

  return (
    <div className="space-y-2" data-testid="qr-scanner">
      <div className="relative overflow-hidden rounded-2xl bg-ink">
        {err ? <p className="flex aspect-video items-center justify-center p-6 text-center text-[14px] text-white/80"><Camera size={18} className="mr-2 shrink-0" />{err}</p> : (
          <>
            <video ref={video} className="aspect-video w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden>
              <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-brand-400" />
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[13px] font-medium text-white">{hint}</p>
          </>
        )}
        {onClose && <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white" aria-label="Close scanner"><X size={18} /></button>}
      </div>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { fromPhoto(e.target.files?.[0]); e.target.value = '' }} data-testid="qr-photo-input" />
      <button type="button" onClick={() => file.current?.click()} className="btn btn-secondary btn-sm w-full"><ImageUp size={15} /> Scan from a photo</button>
      {photoErr && <p role="alert" className="text-[13px] font-medium text-danger-700">{photoErr}</p>}
    </div>
  )
}
