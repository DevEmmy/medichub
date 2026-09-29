import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { homeFor, useAuth } from '../../contexts/AuthContext'
import type { Role } from '../../types'

export function RequireRole({ roles, children, needsHospital }: { roles: Role[]; children: ReactNode; needsHospital?: boolean }) {
  const { user, hospitalId } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role, hospitalId)} replace />
  if (needsHospital && !hospitalId) return <Navigate to="/hospital/onboarding" replace />
  return <>{children}</>
}
