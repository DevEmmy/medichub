import { BadgeCheck } from 'lucide-react'
import { Pill } from '../ui/StatusPill'
import type { Verification } from '../../types'

export const VERIFICATION_META: Record<Verification, { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' | 'info' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'warn' },
  under_review: { label: 'Under review', tone: 'info' },
  verified: { label: 'Verified', tone: 'good' },
  needs_attention: { label: 'Needs attention', tone: 'warn' },
  rejected: { label: 'Rejected', tone: 'bad' },
}
export function VerificationPill({ v, size }: { v: Verification; size?: 'sm' | 'md' }) {
  const m = VERIFICATION_META[v]
  return <Pill tone={m.tone} size={size}>{m.label}</Pill>
}
export function VerifiedBadge({ className = '', size = 16 }: { className?: string; size?: number }) {
  return <BadgeCheck size={size} className={`shrink-0 fill-brand-600 text-white ${className}`} aria-label="Verified by Medic Hub" role="img" />
}
