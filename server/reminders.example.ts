// Status-freshness reminder job (production). Run every hour, e.g. Vercel Cron "0 * * * *"
// or a Supabase scheduled Edge Function. Each hospital gets at most one email per 12 hours,
// only when its live status hasn't been touched for 12+ hours. After 24 hours the email is
// marked urgent, and patients already see "availability at risk" in the app.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_FROM (e.g. "Medic Hub <alerts@yourdomain>")
import { createClient } from '@supabase/supabase-js'

const REMINDER_HOURS = 12
const STALE_HOURS = 24

export default async function handler() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const cutoff = new Date(Date.now() - REMINDER_HOURS * 3_600_000).toISOString()
  const { data: due, error } = await sb
    .from('hospital_status')
    .select('hospital_id, updated_at, last_reminder_at, hospitals!inner(name, email, admin_contact, verification, public_record)')
    .lt('updated_at', cutoff)
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${cutoff}`)
    .eq('hospitals.verification', 'verified')
    .eq('hospitals.public_record', false)
  if (error) throw error

  let sent = 0
  for (const row of due ?? []) {
    const h = (row as any).hospitals
    const hrs = Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 3_600_000)
    const urgent = hrs >= STALE_HOURS
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: h.admin_contact?.email || h.email,
        subject: urgent ? `Urgent: ${h.name}'s status on Medic Hub is ${hrs} hours old` : `Please confirm ${h.name}'s live status`,
        text: `Your live status was last updated ${hrs} hours ago. ${urgent ? 'Patients are now told your availability may be wrong.' : 'Patients now see a "not updated" warning.'}\n\nOpen your portal and update it, or tap "Still correct" if nothing has changed.`,
      }),
    })
    if (res.ok) {
      await sb.from('hospital_status').update({ last_reminder_at: new Date().toISOString() }).eq('hospital_id', row.hospital_id)
      sent++
    }
  }
  return new Response(JSON.stringify({ checked: due?.length ?? 0, sent }), { headers: { 'Content-Type': 'application/json' } })
}
