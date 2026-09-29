import { useEffect, useRef, useState } from 'react'
import { db, type TableName } from '../lib/store'

/**
 * Subscribe a selector to one or more tables. Re-runs whenever those tables change
 * in this tab or any other tab (realtime). Errors (e.g. access denied) are returned, not thrown.
 */
export function useLive<T>(select: () => T, tables: TableName[], deps: unknown[] = []): { data: T | undefined; error: Error | null; remoteTick: number } {
  const run = () => { try { return { data: select(), error: null as Error | null } } catch (e) { return { data: undefined, error: e as Error } } }
  const [state, setState] = useState(run)
  const [remoteTick, setRemoteTick] = useState(0)
  const selRef = useRef(select)
  selRef.current = select
  const key = tables.join(',')
  useEffect(() => {
    setState(run())
    return db.subscribe((changed, remote) => {
      if (changed.some((t) => tables.includes(t))) {
        try { setState({ data: selRef.current(), error: null }) } catch (e) { setState({ data: undefined, error: e as Error }) }
        if (remote) setRemoteTick((x) => x + 1)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps])
  return { ...state, remoteTick }
}

/** Brief skeleton on first mount so loading states are visible and layout doesn't jump. */
export function useFirstLoad(ms = 380) {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), ms); return () => clearTimeout(t) }, [ms])
  return ready
}
