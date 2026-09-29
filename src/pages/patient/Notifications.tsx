import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useLive } from '../../hooks/useLive'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { markRead, myNotifications } from '../../services/notifications'
import { NOTIF_ICON } from '../../components/navigation/NotificationBell'
import { EmptyState } from '../../components/ui/States'
import { relTime } from '../../utils/date'
import { cn } from '../../utils/cn'

export default function Notifications() {
  useDocumentTitle('Notifications')
  const { data = [] } = useLive(myNotifications, ['notifications'])
  const nav = useNavigate()
  return (
    <div className="container-app max-w-2xl py-8">
      <div className="flex items-end justify-between"><h1 className="text-[30px] font-semibold">Notifications</h1>{data.some((n) => !n.read) && <button onClick={() => markRead()} className="btn btn-ghost btn-sm">Mark all read</button>}</div>
      {data.length === 0 ? <EmptyState className="mt-6" icon={<Bell size={22} />} title="Nothing yet" body="Booking updates and hospital news will appear here." /> : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          {data.map((n) => { const I = NOTIF_ICON[n.type]; return (
            <li key={n.id}><button onClick={() => { markRead(n.id); if (n.link) nav(n.link) }} className={cn('flex w-full gap-3 px-4 py-4 text-left hover:bg-canvas', !n.read && 'bg-brand-50/40')}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mist text-slate-600"><I size={17} /></span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-[14.5px] font-semibold text-ink">{n.title}</span>{!n.read && <span className="h-2 w-2 rounded-full bg-coral-500" aria-label="Unread" />}</span><span className="mt-0.5 block text-[13.5px] text-slate-600">{n.body}</span><span className="mt-1 block text-[12px] text-slate-400">{relTime(n.createdAt)}</span></span>
            </button></li>
          ) })}
        </ul>
      )}
    </div>
  )
}
