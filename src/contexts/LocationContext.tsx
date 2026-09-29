import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { LatLng } from '../utils/geo'

export type LocSource = 'gps' | 'manual'
export interface UserLocation extends LatLng { label: string; source: LocSource }
type GeoState = 'idle' | 'asking' | 'denied' | 'unavailable'
interface LocApi {
  location: UserLocation | null
  geoState: GeoState
  requestGps: () => Promise<boolean>
  setManual: (loc: Omit<UserLocation, 'source'>) => void
  clear: () => void
}
const KEY = 'medichub.location'
const Ctx = createContext<LocApi | null>(null)

function load(): UserLocation | null {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function save(l: UserLocation | null) { try { if (l) localStorage.setItem(KEY, JSON.stringify(l)); else localStorage.removeItem(KEY) } catch { /* ignore */ } }

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation | null>(load)
  const [geoState, setGeo] = useState<GeoState>('idle')
  const set = (l: UserLocation | null) => { setLocation(l); save(l) }
  const requestGps = useCallback(() => new Promise<boolean>((resolve) => {
    if (!('geolocation' in navigator)) { setGeo('unavailable'); return resolve(false) }
    setGeo('asking')
    const timer = setTimeout(() => { setGeo('unavailable'); resolve(false) }, 12000)
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(timer); set({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'Your current location', source: 'gps' }); setGeo('idle'); resolve(true) },
        (err) => { clearTimeout(timer); setGeo(err.code === 1 ? 'denied' : 'unavailable'); resolve(false) },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      )
    } catch { clearTimeout(timer); setGeo('unavailable'); resolve(false) }
  }), [])
  return (
    <Ctx.Provider value={{ location, geoState, requestGps, setManual: (l) => { set({ ...l, source: 'manual' }); setGeo('idle') }, clear: () => set(null) }}>
      {children}
    </Ctx.Provider>
  )
}
export function useUserLocation() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useUserLocation outside provider')
  return c
}
