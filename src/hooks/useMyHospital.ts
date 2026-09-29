import { useAuth } from '../contexts/AuthContext'
import { useLive } from './useLive'
import { getHospitalView } from '../services/hospitals'

export const HOSPITAL_TABLES = ['hospitals', 'hospital_status', 'hospital_capacity', 'hospital_services', 'hospital_departments', 'hospital_doctors', 'hospital_announcements', 'hospital_slots'] as const

export function useMyHospital() {
  const { hospitalId } = useAuth()
  const { data } = useLive(() => (hospitalId ? getHospitalView(hospitalId) : null), [...HOSPITAL_TABLES], [hospitalId])
  return { h: data ?? null, hospitalId: hospitalId! }
}
