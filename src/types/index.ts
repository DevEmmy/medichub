export type Role = 'patient' | 'hospital' | 'admin' | 'doctor'

export interface User {
  id: string
  email: string
  passwordHash: string
  role: Role
  name: string
  phone?: string
  /** Set when the user clicked the link in their confirmation email. */
  emailVerifiedAt?: string
  /** Account created from a phone (USSD/SMS) rather than the website. */
  viaPhone?: boolean
  createdAt: string
}
export type PublicUser = Omit<User, 'passwordHash'>

export interface PatientProfile {
  userId: string
  city?: string
  dateOfBirth?: string
  gender?: string
  onboarded: boolean
}

export type Verification = 'draft' | 'pending' | 'under_review' | 'verified' | 'needs_attention' | 'rejected'
export type HospitalType = 'Teaching' | 'Federal Medical Centre' | 'General' | 'Specialist' | 'Private' | 'Mission' | 'Primary Care'

export interface DayHours { day: number; open: string; close: string; closed: boolean }

export interface Hospital {
  id: string
  slug: string
  name: string
  type: HospitalType
  tagline: string
  description: string
  address: string
  area: string
  city: string
  state: string
  lat: number
  lng: number
  phone: string
  emergencyPhone: string
  email: string
  website?: string
  socials: { label: string; url: string }[]
  hue: number
  logo?: string
  cover?: string
  /** Hospital-uploaded gallery (exterior, reception, wards…) */
  photos?: { src: string; label: string }[]
  is24h: boolean
  hours: DayHours[]
  facilities: string[]
  specialties: string[]
  verification: Verification
  verificationNote?: string
  registration: { cacNumber: string; licenseNumber: string; licensingBody: string; yearEstablished: string; bedCount: number }
  admin: { name: string; title: string; email: string; phone: string }
  autoConfirm: boolean
  /** Listed from public records of federal health institutions; not onboarded, status is demo data */
  publicRecord?: boolean
  /** Who runs it (shown as a badge for listings from public records) */
  ownership?: 'Federal' | 'State' | 'Private'
  /** Freemium: every hospital gets Basic; Premium unlocks analytics + automations */
  plan?: 'basic' | 'premium'
  planTrialEndsAt?: string
  automations?: Automations
  /** Verified bank account on file: patients pay online and money settles to the hospital */
  payoutsEnabled?: boolean
  ownerUserId: string
  submittedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Automations { patientReminders: boolean; lowBedAlert: boolean; weeklyReport: boolean }

export interface Review {
  id: string
  hospitalId: string
  patientId: string
  /** First name + initial, never the full name */
  authorName: string
  bookingId: string
  rating: number
  tags: string[]
  comment: string
  createdAt: string
  reply?: { body: string; at: string }
}

export interface HospitalStaff { id: string; hospitalId: string; userId: string; role: 'owner' | 'staff' }

export interface Department { id: string; hospitalId: string; name: string; head?: string; phone?: string; status: EmergencyLevel }
export interface Service {
  id: string
  hospitalId: string
  name: string
  category: string
  departmentId?: string
  durationMins: number
  fee?: number
  bookable: boolean
  active: boolean
}
export type TeamRole = 'Doctor' | 'Nurse' | 'Front desk' | 'Admin' | 'Lab' | 'Pharmacy' | 'Billing' | 'Other'
/** What each team member is emailed about. */
export interface TeamAlerts { newBooking: boolean; paid: boolean; cancelled: boolean; rescheduled: boolean; dailySchedule: boolean }
/** A person at the hospital who receives booking emails (they don't need a Medic Hub login). */
export interface TeamMember {
  id: string; hospitalId: string; name: string; role: TeamRole; email: string; phone?: string
  /** Only bookings for this department (empty = every booking). */
  departmentId?: string
  alerts: TeamAlerts; active: boolean; lastDigestOn?: string; createdAt: string
}
export type EmailKind = 'doctor_assigned' | 'new_booking' | 'paid' | 'cancelled' | 'rescheduled' | 'daily_schedule' | 'test' | 'patient_confirmation' | 'patient_update'
export interface EmailLog {
  id: string; hospitalId: string; bookingId?: string; toEmail: string; toName?: string
  audience: 'team' | 'patient'; kind: EmailKind; subject: string; body: string
  status: 'queued' | 'sent' | 'failed' | 'simulated'; error?: string; createdAt: string
}

export interface EmailVerification { token: string; userId: string; expiresAt: string; used: boolean }

export interface Doctor {
  id: string; hospitalId: string; name: string; specialty: string; departmentId?: string; available: boolean
  /** Where appointment alerts go (Gmail or any address). The doctor signs up with this email to get their own dashboard. */
  email?: string; phone?: string
  /** The doctor's Medic Hub account, once they sign up with the email above */
  userId?: string
}

export type EmergencyLevel = 'open' | 'busy' | 'closed'
export type Availability = 'available' | 'limited' | 'unavailable'
export type OverallCapacity = 'available' | 'moderate' | 'high' | 'full'
export type EmergencyCapacity = 'available' | 'limited' | 'full'

export interface HospitalStatus {
  hospitalId: string
  emergency: EmergencyLevel
  oxygen: Availability
  pharmacy: Availability
  laboratory: Availability
  ambulance: Availability
  maternity: Availability
  theatre: Availability
  bloodBank: Availability
  updatedAt: string
  /** When the last "please update" reminder went to the hospital */
  lastReminderAt?: string
}
export type ResourceKey = 'oxygen' | 'pharmacy' | 'laboratory' | 'ambulance' | 'maternity' | 'theatre' | 'bloodBank'

export interface HospitalCapacity {
  hospitalId: string
  overall: OverallCapacity
  emergency: EmergencyCapacity
  bedsTotal: number
  bedsAvailable: number
  icuAvailable: number
  updatedAt: string
}

export interface Slot { id: string; hospitalId: string; serviceId: string; date: string; time: string; capacity: number; booked: number }

export type BookingStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show'
export interface Booking {
  id: string
  ref: string
  token: string
  patientId: string
  patientName: string
  patientPhone?: string
  hospitalId: string
  serviceId: string
  slotId: string
  date: string
  time: string
  reason?: string
  status: BookingStatus
  createdAt: string
  updatedAt: string
  /** Automation: day-before reminder already sent */
  remindedAt?: string
  /** The doctor who will see the patient */
  doctorId?: string
  doctorName?: string
  /** Payment: fee in naira when the service has a price */
  amount?: number
  paymentStatus?: PaymentStatus
  paymentRef?: string
  paidAt?: string
  /** No online payment: the patient pays at the hospital */
  payAtHospital?: boolean
  /** How the booking was made: website, USSD menu or SMS */
  channel?: 'web' | 'ussd' | 'sms'
}

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed'
export interface Payment {
  id: string
  reference: string
  bookingId: string
  hospitalId: string
  patientId: string
  /** Amount in kobo (₦1 = 100 kobo), as payment gateways expect */
  amountKobo: number
  currency: 'NGN'
  status: 'initialized' | 'success' | 'failed' | 'abandoned' | 'refunded'
  provider: 'paystack' | 'test'
  channel?: string
  gatewayResponse?: string
  createdAt: string
  paidAt?: string
  refundedAt?: string
}
/** The hospital's verified settlement account. Only staff of that hospital (and reviewers) can read it. */
export interface HospitalPayout {
  hospitalId: string
  bankCode: string
  bankName: string
  accountLast4: string
  accountName: string
  subaccountCode: string
  provider: 'paystack' | 'test'
  verifiedAt: string
}
export interface BookingEvent { id: string; bookingId: string; status: BookingStatus; at: string; by: 'patient' | 'hospital' | 'system'; note?: string }

export interface HealthProfile {
  userId: string
  bloodGroup: string
  genotype: string
  allergies: string[]
  conditions: string[]
  medications: { name: string; dose: string }[]
  heightCm?: number
  weightKg?: number
  notes: string
  updatedAt: string
}
export type HealthEventType = 'appointment' | 'visit' | 'vaccination' | 'lab' | 'medication' | 'profile'
export interface HealthEvent { id: string; userId: string; type: HealthEventType; title: string; detail?: string; date: string; place?: string }

export interface EmergencyContact { id: string; userId: string; name: string; relationship: string; phone: string; primary: boolean }

export type NotificationType = 'booking' | 'status' | 'verification' | 'profile' | 'announcement' | 'system'
export interface Notification { id: string; userId: string; type: NotificationType; title: string; body: string; link?: string; read: boolean; createdAt: string }

export type AnnouncementSeverity = 'info' | 'warning' | 'critical'
export interface Announcement { id: string; hospitalId: string; title: string; body: string; severity: AnnouncementSeverity; active: boolean; createdAt: string }

export interface HospitalDocument { id: string; hospitalId: string; name: string; kind: string; size: number; fileId?: string; uploadedAt: string; status: 'submitted' | 'accepted' | 'needs_attention' }

export interface PasswordReset { token: string; userId: string; expiresAt: string; used: boolean }

export interface Session { userId: string; createdAt: string }

// ------- Static content -------
export interface FirstAidVideo {
  id: string
  title: string
  description: string
  emergencyType: string
  youtubeId?: string
  sourceUrl: string
  sourceOrg: string
  durationLabel: string
  safetyNote: string
  hue: number
}
export interface EmergencyGuide {
  slug: string
  title: string
  short: string
  icon: string
  severity: 'critical' | 'serious'
  call112When: string
  doNow: string[]
  dont: string[]
  videoIds: string[]
  keywords: string[]
}
export interface HealthResource { slug: string; title: string; summary: string; icon: string; videoIds: string[]; doNow: string[]; dont: string[]; call112When: string }
export interface Meal {
  id: string
  name: string
  local?: string
  serving: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Drink'
  diet: string[]
  note: string
  hue: number
}
export interface Exercise { id: string; name: string; category: 'Walking' | 'Stretching' | 'Mobility' | 'Strength' | 'Cardio'; level: 'Beginner' | 'Intermediate'; minutes: number; summary: string; steps: string[] }
