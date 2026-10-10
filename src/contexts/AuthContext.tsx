import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { db } from '../lib/store'
import { currentUser, toPublic, myHospitalId } from '../services/core'
import * as auth from '../services/auth'
import type { PublicUser, Role } from '../types'

interface AuthState {
  user: PublicUser | null
  hospitalId: string | null
  signIn: (email: string, password: string) => Promise<PublicUser>
  signUp: typeof auth.signUp
  signOut: () => void
  refresh: () => void
}
const Ctx = createContext<AuthState | null>(null)

function snapshot() {
  const u = currentUser()
  return { user: u ? toPublic(u) : null, hospitalId: myHospitalId() }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(snapshot)
  const refresh = useCallback(() => setState(snapshot()), [])
  useEffect(() => db.subscribe((tables) => { if (tables.includes('users') || tables.includes('hospital_staff')) refresh() }), [refresh])
  const value: AuthState = {
    ...state,
    refresh,
    signIn: async (e, p) => { const u = await auth.signIn(e, p); refresh(); return u },
    signUp: async (i) => { const u = await auth.signUp(i); refresh(); return u },
    signOut: () => { auth.signOut(); refresh() },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside provider')
  return c
}

export function homeFor(role?: Role | null, hospitalId?: string | null) {
  if (role === 'hospital') return hospitalId ? '/hospital' : '/hospital/onboarding'
  if (role === 'admin') return '/admin'
  if (role === 'doctor') return '/doctor'
  if (role === 'patient') return '/app'
  return '/'
}
