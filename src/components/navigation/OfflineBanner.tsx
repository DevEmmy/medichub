import { WifiOff } from 'lucide-react'
import { useOnline } from '../../hooks/useOnline'
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-[13px] font-medium text-amber-700">
      <WifiOff size={15} /> You're offline. Emergency guides still work. Call 112 in an emergency.
    </div>
  )
}
