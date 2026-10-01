import { rpc } from '../lib/rpc'
// Ratings & reviews. Only patients with a real visit (checked in / in consultation / completed
// booking) can rate, one review per booking — so every rating on Medic Hub is a verified visit.
// Replying to reviews is part of the free Basic plan.
import { db } from '../lib/store'
import { uid } from '../lib/ids'
import type { Review } from '../types'
import { AppError, currentUser, latency, requireHospitalStaff, requireRole } from './core'
import { notify } from './notifications'

export const REVIEW_TAGS = ['Short wait', 'Kind staff', 'Clean', 'Clear explanation', 'Fair price', 'Long wait', 'Hard to find', 'Rude staff', 'Overcrowded'] as const
const VISITED = new Set(['checked_in', 'in_consultation', 'completed'])

export interface RatingSummary { avg: number; count: number; dist: number[] }

export function ratingSummary(hospitalId: string): RatingSummary {
  const rs = db.select('hospital_reviews').filter((r) => r.hospitalId === hospitalId)
  const dist = [0, 0, 0, 0, 0]
  rs.forEach((r) => dist[r.rating - 1]++)
  const avg = rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0
  return { avg: Math.round(avg * 10) / 10, count: rs.length, dist }
}

export function reviewsFor(hospitalId: string): Review[] {
  return db.select('hospital_reviews').filter((r) => r.hospitalId === hospitalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Visits the signed-in patient can still rate at this hospital. */
export function rateableVisits(hospitalId: string) {
  const u = currentUser()
  if (!u || u.role !== 'patient') return []
  const done = new Set(db.select('hospital_reviews').filter((r) => r.patientId === u.id).map((r) => r.bookingId))
  const services = db.select('hospital_services')
  return db.select('bookings')
    .filter((b) => b.patientId === u.id && b.hospitalId === hospitalId && VISITED.has(b.status) && !done.has(b.id))
    .map((b) => ({ id: b.id, date: b.date, serviceName: services.find((s) => s.id === b.serviceId)?.name ?? 'Visit' }))
}

export const submitReview = rpc('reviews.submitReview', async function submitReview(bookingId: string, input: { rating: number; tags: string[]; comment: string }) {
  const u = requireRole('patient')
  if (!input || !Array.isArray(input.tags) || input.tags.some((t) => !(REVIEW_TAGS as readonly string[]).includes(t))) throw new AppError('validation', 'Invalid tags.')
  if (typeof input.comment !== 'string') throw new AppError('validation', 'Invalid comment.')
  await latency(200)
  const b = db.select('bookings').find((x) => x.id === bookingId && x.patientId === u.id)
  if (!b) throw new AppError('not_found', 'Booking not found.')
  if (!VISITED.has(b.status)) throw new AppError('validation', 'You can rate a hospital after your visit.')
  if (db.select('hospital_reviews').some((r) => r.bookingId === bookingId)) throw new AppError('conflict', 'You already rated this visit.')
  const rating = Math.round(input.rating)
  if (rating < 1 || rating > 5) throw new AppError('validation', 'Choose 1 to 5 stars.')
  const comment = input.comment.trim().slice(0, 600)
  const parts = u.name.trim().split(/\s+/)
  const authorName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
  const r: Review = { id: uid('rv_'), hospitalId: b.hospitalId, patientId: u.id, authorName, bookingId, rating, tags: input.tags.slice(0, 4), comment, createdAt: new Date().toISOString() }
  db.write(['hospital_reviews'], (d) => { d.hospital_reviews.push(r) })
  const h = db.select('hospitals').find((x) => x.id === b.hospitalId)
  db.select('hospital_staff').filter((s) => s.hospitalId === b.hospitalId).forEach((s) => notify(s.userId, 'system', `New ${rating}-star rating`, `${authorName} rated ${h?.name ?? 'your hospital'}${comment ? `: "${comment.slice(0, 80)}"` : '.'}`, '/hospital/reviews'))
  return r
})

export const replyToReview = rpc('reviews.replyToReview', async function replyToReview(hospitalId: string, reviewId: string, body: string) {
  requireHospitalStaff(hospitalId)
  await latency(160)
  if (typeof body !== 'string') throw new AppError('validation', 'Write a reply first.')
  const text = body.trim().slice(0, 500)
  if (!text) throw new AppError('validation', 'Write a reply first.')
  let patientId = ''
  db.write(['hospital_reviews'], (d) => {
    const r = d.hospital_reviews.find((x) => x.id === reviewId && x.hospitalId === hospitalId)
    if (!r) throw new AppError('not_found', 'Review not found.')
    r.reply = { body: text, at: new Date().toISOString() }; patientId = r.patientId
  })
  if (patientId) notify(patientId, 'system', 'The hospital replied to your review', text.slice(0, 120), `/hospitals/${hospitalId}`)
})
