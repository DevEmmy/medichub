import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/** The free server sleeps when nobody uses it. If a request is slow, say why instead of leaving people guessing. */
export function ServerWaking() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const on = (e: Event) => setSlow((e as CustomEvent<boolean>).detail)
    window.addEventListener('medichub:slow', on)
    return () => window.removeEventListener('medichub:slow', on)
  }, [])
  if (!slow) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-3" data-no-read>
      <p className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white shadow-lift">
        <Loader2 size={15} className="animate-spin text-lime-300" /> Waking up the server, this can take up to a minute the first time…
      </p>
    </div>
  )
}
