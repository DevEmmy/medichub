import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useUserLocation } from '../../contexts/LocationContext'
import { ALL_PLACES } from '../../data/locations'
import { Spinner } from '../ui/States'
import { Modal } from '../ui/Modal'

export function LocationPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { requestGps, setManual, geoState } = useUserLocation()
  const [q, setQ] = useState('')
  const list = ALL_PLACES.filter((p) => (p.name + ' ' + p.city + ' ' + p.state).toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open={open} onClose={onClose} title="Where are you?" size="sm">
      <button onClick={async () => { if (await requestGps()) onClose() }} className="flex w-full items-center gap-3 rounded-2xl bg-brand-50 p-4 text-left ring-1 ring-brand-100 hover:bg-brand-100">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700">{geoState === 'asking' ? <Spinner /> : <LocateFixed size={19} />}</span>
        <span><span className="block text-[15px] font-semibold text-ink">Use my current location</span><span className="block text-[13px] text-slate-600">Your browser will ask for permission.</span></span>
      </button>
      {geoState === 'denied' && <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-700">Location access is off. Choose your city or area below instead.</p>}
      {geoState === 'unavailable' && <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-700">We couldn't get your location. Choose your city or area below.</p>}
      <label className="relative mt-4 block">
        <span className="sr-only">Search cities and areas</span>
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Lagos, Ikeja, Abuja…" className="input pl-10" />
      </label>
      <ul className="mt-3 max-h-72 overflow-y-auto">
        {list.map((p) => (
          <li key={p.name}><button onClick={() => { setManual({ lat: p.lat, lng: p.lng, label: p.name === p.city ? p.city : `${p.name}, ${p.city}` }); onClose() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-canvas">
            <MapPin size={16} className="text-slate-400" /><span className="text-[14.5px] font-medium text-ink">{p.name}</span><span className="ml-auto text-[12.5px] text-slate-500">{p.name === p.city ? p.state : p.city}</span>
          </button></li>
        ))}
        {list.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-slate-500">No match. Try a nearby city.</li>}
      </ul>
    </Modal>
  )
}

export function LocationBar() {
  const { location, requestGps, geoState, clear } = useUserLocation()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  return (
    <>
      <AnimatePresence initial={false}>
        {!location && !dismissed ? (
          <motion.div key="prompt" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-4 rounded-3xl bg-ink p-5 text-white sm:flex-row sm:items-center">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10"><LocateFixed size={22} /></span>
              <div className="flex-1"><p className="font-display text-[18px] font-semibold">Find care near you</p><p className="mt-0.5 text-[14px] text-white/70">Allow location access to discover nearby healthcare facilities. We only use it on this device.</p>
                {geoState === 'denied' && <p className="mt-1 text-[13px] text-amber-100">Location is blocked. Choose your city instead.</p>}
                {geoState === 'unavailable' && <p className="mt-1 text-[13px] text-amber-100">Location unavailable here. Choose your city instead.</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => requestGps().then((ok) => { if (!ok) setOpen(true) })} className="btn bg-white text-ink hover:bg-brand-50">{geoState === 'asking' ? <Spinner /> : <LocateFixed size={16} />} Allow location</button>
                <button onClick={() => setOpen(true)} className="btn bg-white/10 text-white hover:bg-white/15">Choose city</button>
                <button onClick={() => setDismissed(true)} className="grid h-11 w-11 place-items-center rounded-xl text-white/60 hover:bg-white/10" aria-label="Dismiss"><X size={18} /></button>
              </div>
            </div>
          </motion.div>
        ) : location ? (
          <motion.div key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-2 text-[14px] text-slate-600">
            <MapPin size={16} className="text-brand-600" /> Showing distances from <strong className="font-semibold text-ink">{location.label}</strong>
            <button onClick={() => setOpen(true)} className="rounded-lg px-2 py-1 font-semibold text-brand-700 hover:bg-brand-50">Change</button>
            <button onClick={clear} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-mist">Clear</button>
          </motion.div>
        ) : (
          <motion.button key="set" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-[14px] font-semibold text-brand-700"><MapPin size={16} /> Set your location for distances</motion.button>
        )}
      </AnimatePresence>
      <LocationPicker open={open} onClose={() => setOpen(false)} />
    </>
  )
}
