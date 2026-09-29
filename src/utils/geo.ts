export interface LatLng { lat: number; lng: number }
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
export function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 20) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}
export function directionsUrl(lat: number, lng: number, from?: LatLng | null) {
  const o = from ? `&origin=${from.lat},${from.lng}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${o}&travelmode=driving`
}
