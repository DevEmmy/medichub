// Photography used across the app (AI-generated illustrative scenes of Nigerian healthcare).
import doctorMother from '../assets/photos/doctor-mother.webp'
import qrCheckin from '../assets/photos/qr-checkin.webp'
import nurseWard from '../assets/photos/nurse-ward.webp'
import emergencyEntrance from '../assets/photos/emergency-entrance.webp'
import bpCheck from '../assets/photos/bp-check.webp'
import antenatal from '../assets/photos/antenatal.webp'
import lagosPhone from '../assets/photos/lagos-phone.webp'
import pharmacy from '../assets/photos/pharmacy.webp'

export const SCENES = { doctorMother, qrCheckin, nurseWard, emergencyEntrance, bpCheck, antenatal, lagosPhone, pharmacy }

export const HERO_SLIDES = [
  { src: doctorMother, caption: 'Child health clinic', place: 'Book a paediatric visit' },
  { src: antenatal, caption: 'Antenatal scan', place: 'Find ultrasound near you' },
  { src: bpCheck, caption: 'Blood pressure check', place: 'Regular check-ups, no queue' },
  { src: nurseWard, caption: 'Ward with free beds', place: 'See live bed availability' },
]
