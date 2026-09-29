import { Bed, Bone, Brain, Droplet, Droplets, Flame, Hand, HeartPulse, ShieldAlert, Skull, Sun, Wind, Zap, type LucideIcon } from 'lucide-react'
const MAP: Record<string, LucideIcon> = { Bed, Bone, Brain, Droplet, Droplets, Flame, Hand, HeartPulse, ShieldAlert, Skull, Sun, Wind, Zap }
export function DynIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const I = MAP[name] ?? HeartPulse
  return <I size={size} className={className} aria-hidden />
}
