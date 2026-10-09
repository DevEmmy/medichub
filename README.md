# Medic Hub

Healthcare access and emergency platform for Nigeria. Patients find the right hospital, see live availability, call the nearest emergency unit directly, book a slot, get a QR pass and rate their visit. Hospitals set themselves up, get verified, run their live status, bookings and QR check-in, and can upgrade to Premium for analytics and automation.

## Contact

Team Medic Hub · medichubnigeria@gmail.com · 07042744090

## Two ways to run it

| | Launch (production) | Pitch demo |
|---|---|---|
| Data | Shared PostgreSQL database on a server | Stays in one browser (localStorage) |
| Accounts | Real sign-ups, strong password hashing, 30-day sessions | Demo accounts, password `demo1234` |
| Hospitals | None until a hospital signs up and a reviewer verifies it | Sample hospitals + real public-record listings with Wikimedia photos |
| Build | `npm run build:prod` → `npm start` | `npm run build` (or `SINGLE=1 npm run build` for one HTML file) |

## Launch checklist

1. **Database** – create a free PostgreSQL database and copy its connection URL. **Supabase** works: New project → Connect → *Session pooler* URI (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`). [Neon](https://neon.tech) works the same way.
2. **Server** – on [Render](https://render.com): New › Blueprint › this repo (uses `render.yaml` + `Dockerfile`). Fill in:
   - `DATABASE_URL` – from step 1 (tables are created automatically on first start)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` – the first reviewer account (reviewers approve hospitals; there is no public sign-up for them)
   - `APP_URL` – where people open the app; links in emails point here. Use `https://devemmy.github.io/medichub/` if the website stays on GitHub Pages, else the Render address.
   - `ALLOWED_ORIGINS` – `https://devemmy.github.io` when the website is on GitHub Pages.
   - Email (booking alerts to hospital staff, patient confirmations, password resets, status reminders, weekly reports). Set one of:
     - **Gmail**: `SMTP_USER` (your Gmail address) + `SMTP_PASS` (a Google *App password*: Google Account → Security → 2-Step Verification → App passwords). Optional `SMTP_HOST`/`SMTP_PORT` for other providers. Gmail allows about 500 emails a day.
     - **Resend**: `RESEND_API_KEY` + `MAIL_FROM` ([Resend](https://resend.com)), better for high volume.
     Without email, alerts are still recorded in each hospital's Email activity, and password reset is disabled for safety.
   - `PAYSTACK_SECRET_KEY` – online booking payments. Start with your `sk_test_…` key (Paystack test cards, no real money), switch to `sk_live_…` after Paystack approves your business. In the Paystack dashboard set the **Webhook URL** to `https://<your-site>/api/paystack/webhook`. `PLATFORM_FEE_PERCENT` sets Medic Hub's share (default 0).
   - Medic AI (streams answers like ChatGPT). Set one of:
     - `ANTHROPIC_API_KEY` – Claude (optional `MEDIC_AI_MODEL`, default `claude-sonnet-4-5`)
     - `AI_API_KEY` + `AI_BASE_URL` + `AI_MODEL` – any OpenAI-compatible API. A free [Groq](https://console.groq.com) key works with the defaults (`https://api.groq.com/openai/v1`, `llama-3.3-70b-versatile`).
     Without a key the app falls back to a free public AI (no Health Vault data is sent to it), then to the built-in first-aid guides.
   - Phones without internet (USSD menu + SMS) through [Africa's Talking](https://africastalking.com): `AT_USERNAME`, `AT_API_KEY`, optional `AT_SENDER_ID`, optional `PHONE_WEBHOOK_KEY`. In their dashboard set the USSD callback to `https://<server>/api/ussd` and the incoming SMS callback to `https://<server>/api/sms/incoming` (add `?key=<PHONE_WEBHOOK_KEY>` if you set one). With `AT_USERNAME=sandbox` you can test free in their phone simulator before buying a shortcode.
3. **Point the GitHub Pages site at the server** – GitHub repo › Settings › Secrets and variables › Actions › *Variables* › New variable `MEDICHUB_API_URL` = your server address (e.g. `https://medichub.onrender.com`). The next push rebuilds the site so sign-ups are saved in the database, emails go out and logins work from any device. Optional `MEDICHUB_USSD_CODE` and `MEDICHUB_SMS_NUMBER` show your real shortcode and number.
4. **Domain** – add your domain in Render (Settings › Custom domains).
5. **First hospital** – a hospital signs up → completes the 7-step setup (details, location, services, registration, documents, administrator) → you sign in as reviewer, open their documents and verify → they appear to patients. Each hospital uploads its own photos and sets its own fees and live status.
6. **Print the QR poster** – Hospital portal › Entrance QR poster.

Any Node 20+ host works the same way (`npm ci && npm run build:prod && npm start`). To serve the web app from somewhere else (e.g. GitHub Pages), build it with `VITE_BACKEND=1 VITE_API_URL=https://your-server npm run build:app` and set `ALLOWED_ORIGINS` on the server.

Render's free plan works for a pilot, but the server sleeps after 15 minutes without visitors (the first request then takes about a minute, and reminders pause while asleep). The Starter plan keeps it awake.

## Account emails

Signing up sends a welcome email with a **Confirm my email** button (valid 48 hours); until confirmed, a banner offers to resend it. **Forgot password** emails a single-use link valid 30 minutes. Both need email set up on the server (Gmail or Resend). In the browser-only demo there is no email, so the demo shows the link on screen instead, and accounts are kept in that browser only.

## Phones without internet (USSD and SMS)

Dial the Medic Hub code for a menu: 1 open emergency units by state (numbers also sent by SMS), 2 book (state → hospital → service → the next free times with places left → name for first-time callers → confirm; booking reference by SMS, fee paid at the hospital), 3 my bookings, 4 cancel, 5 first aid (steps by SMS). Or text `HELP`, `ER <state>`, `HOSPITALS <state>`, `SLOTS <code>`, `BOOK <n> <name>`, `MY`, `STATUS <ref>`, `CANCEL <ref>`, `AID <topic>`. A phone number only ever sees and changes its own bookings. Hospitals see these bookings like any other, marked “by USSD” or “by SMS”, and their staff get the usual emails. Try it in the app at `#/phone`.

## Architecture

```
src/services/*        every operation (bookings, status, reviews, plans…) with its access checks and input validation
src/lib/rpc.ts        in the browser, sends each operation to the server; on the server, runs it as the signed-in user
src/lib/store.ts      in-memory tables: browser cache (launch), browser-only (demo) or authoritative copy (server)
server/index.ts       API, realtime (Server-Sent Events), file storage, scheduled jobs, serves the web app
server/policy.ts      exactly which rows each person may receive
server/db.ts          PostgreSQL persistence (embedded PGlite when DATABASE_URL is unset, for local runs)
server/db/schema.sql  one table per entity, typed columns, foreign keys, indexes
```

- **Security**: passwords use PBKDF2-SHA256 (210k iterations, per-user salt); sessions are random 256-bit tokens stored hashed; every input is validated server-side; sign-in, sign-up and reset are rate-limited; patients only ever receive their own health data and bookings; hospital staff only their own facility; verification documents are private files only the uploader and reviewers can open.
- **Realtime**: when anything changes, open apps are told which tables changed and re-fetch only what they're allowed to see.
- **Scheduled jobs** (every 5 minutes): status-freshness reminders (12 h / urgent at 24 h) and Premium automations (patient reminders the day before, low-bed alerts, Monday weekly report).

## Features

- **Emergency mode**: one tap to call the nearest open emergency unit directly (distance, status freshness, directions), 112 as a free backup, first-aid video guides, triage check.
- **Status freshness**: hospitals are reminded every 12 hours; patients see "not updated" after 12 h and "availability at risk – call before you go" after 24 h.
- **QR codes**: patients' booking passes; hospitals scan them with any phone or laptop camera (or from a photo); printable entrance poster that patients scan to open the hospital's live page.
- **Ratings**: only patients who checked in for a booked visit can rate (1–5 stars, tags, comment); hospitals reply publicly for free; "Top rated" sort.
- **Freemium for hospitals**: Basic is free forever (listing, live status, emergency line, bookings, check-in, slots, announcements, reminders, ratings). Premium (₦25,000/month per facility, proposed; 30-day free trial) adds analytics, CSV export and automations. Paying never changes search or emergency ranking. Online billing (e.g. Paystack) is not connected yet.
- **Hospital team alerts**: each hospital lists its staff (name, role, Gmail or work email, optional department). Every booking, payment, cancellation and reschedule emails the right people instantly; Premium adds a 7 AM daily schedule. Every email is logged in the portal.
- **Accessibility**: read-aloud for any page with highlighting, Talk back (speaks what you tap or focus), text size, high contrast, underline links, reduce motion, screen-reader page announcements. Audited with axe-core: 0 serious WCAG 2.1 AA issues on 18 screens.
- **Medic AI**, a full chat assistant in five languages (English, Pidgin, Yoruba, Hausa, Igbo): streaming answers, saved conversations, follow-up questions, edit and regenerate, copy, voice input and read-aloud, danger-sign detection, and links straight to hospitals you can book.

## Payments

Hospitals add their settlement account under **Payments**: the account name is confirmed with the bank (Paystack account resolution) and registered as a Paystack subaccount, so every booking payment settles straight to the hospital. Only the last four digits are stored.

When a patient books a service that has a fee, the slot is held for 30 minutes and the patient pays on Paystack's checkout (card, transfer, USSD; Medic Hub never sees card details). The server confirms every payment with Paystack (status, amount, currency, reference) on return and again via the HMAC-signed webhook, so payments are never trusted from the browser and never lost if the browser closes. Unpaid holds expire and free the slot; cancelled paid bookings are refunded automatically. Services without a fee, or hospitals without a verified account, are "pay at the hospital". The pitch demo uses a clearly labelled test checkout instead of Paystack.

## QR codes

Booking passes carry a secure link (`…#/pass/MED-XXXXXX?t=<secret>`), so any phone camera opens a verification page: anyone holding the pass sees that it is genuine; hospital staff signed in to that hospital see every detail and can check the patient in from that screen. The hospital check-in page also scans with the camera or from a photo.

## Tests

- `node qa/mock-paystack.mjs &` then `node qa/launch.mjs` – production flow against the real server with a stand-in Paystack (hospital sign-up → documents → verification → bank account → paid booking → QR check-in → rating → Premium → refund → signed webhook → restart persistence)
- `node qa/e2e.mjs` – demo build flows and layout checks at 320–1024 px

## Pitch demo: accounts (password `demo1234`)

| Role | Email | What to show |
|---|---|---|
| Patient | amaka@medichub.demo | Find care → book → QR pass, Health Vault, emergency snapshot |
| Hospital | ops@lagooncrest.demo | Live status, capacity, slots, booking queue, check-in (`MED-7X82K9`, `MED-K7RA5N`), announcements |
| Reviewer | review@medichub.demo | Approve Tanke Hills Medical Centre → it appears in patient search |

The landing page has one-click buttons for all three. The account menu has **Reset demo data**.

### The three demo moments
1. **Live status**: open the hospital portal in one tab and `#/hospitals/h_lagooncrest` in another. Switch Emergency from Open to Busy. The patient tab flashes the change and shows a live toast.
2. **Instant booking pass**: book any slot. A confirmation animates in and the QR pass rises into view.
3. **Emergency mode**: tap Emergency (or SOS on mobile). The nearest open emergency unit's direct line comes first, with 112 as backup.
4. **Fresh or stale**: Lagoon Crest starts 13 hours out of date: patients see the warning, the hospital gets the reminder and taps "Still correct".
5. **Premium**: Hospital › Plan › Start free trial unlocks Analytics and Automations.

## Honest notes
- Demo build: Lagoon Crest and the review-queue hospitals are fictional. Real hospitals are listed from public records with photos from Wikimedia Commons (credited, linked to author and licence); their status is demo data and labelled "not updated by this hospital". Nothing claims a real hospital is verified, and real hospitals have no invented reviews. The launch build has none of this: hospitals add themselves.
- First-aid videos are real British Red Cross and St John Ambulance videos, linked or embedded from their source (YouTube privacy-enhanced mode). They are UK-produced; the app reminds users that the number in Nigeria is 112. Durations aren't shown because we didn't measure them.
- Medic Hub does not dispatch ambulances. Emergency calls are `tel:` links to the hospital's own emergency line or 112; on desktop it tells you to dial from a phone.
- The map is a dependency-free schematic using real coordinates, with “Directions” opening Google Maps. Swap in Mapbox/Leaflet tiles if you have a key.
- Demo build only: password reset shows the link on screen ("demo inbox"). The server never does; it emails the link.
- Nutrition values are approximate per typical serving.
