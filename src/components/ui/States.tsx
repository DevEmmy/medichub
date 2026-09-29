import type { ReactNode } from 'react'
import { CircleAlert, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '../../utils/cn'

export function EmptyState({ icon, title, body, action, className }: { icon: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mist text-slate-500">{icon}</div>
      <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-slate-600">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', body, onRetry, offline }: { title?: string; body?: string; onRetry?: () => void; offline?: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl bg-danger-50/60 px-6 py-10 text-center ring-1 ring-danger-100">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-danger-600">{offline ? <WifiOff size={22} /> : <CircleAlert size={22} />}</div>
      <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[14px] text-slate-600">{body}</p>}
      {onRetry && <button onClick={onRetry} className="btn btn-secondary btn-sm mt-5"><RefreshCw size={15} /> Try again</button>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) { return <div className={cn('skeleton', className)} aria-hidden /> }

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <Skeleton className="h-28 rounded-none" />
      <div className="space-y-3 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /><div className="flex gap-2"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-6 w-24 rounded-full" /></div><Skeleton className="h-11 w-full rounded-xl" /></div>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <svg className={cn('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
}
