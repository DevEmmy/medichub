import { useEffect, useState } from 'react'
import QR from 'qrcode'

export function QRCode({ value, size = 200, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState<string>('')
  useEffect(() => {
    let alive = true
    QR.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0A1F1A', light: '#00000000' } })
      .then((s) => alive && setSvg(s)).catch(() => alive && setSvg(''))
    return () => { alive = false }
  }, [value])
  return (
    <div className={className} style={{ width: size, height: size }} role="img" aria-label={`QR code for booking ${value.split(':')[1] ?? ''}`}
      dangerouslySetInnerHTML={svg ? { __html: svg.replace('<svg', `<svg width="${size}" height="${size}"`) } : undefined} />
  )
}

export async function qrDataUrl(value: string, size = 480) {
  return QR.toDataURL(value, { width: size, margin: 1, color: { dark: '#0A1F1A', light: '#FFFFFF' } })
}
