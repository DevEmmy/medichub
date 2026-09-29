# Medic Hub

Healthcare access and emergency platform for Nigeria. Patients find the right hospital, see live availability, book a slot and get a QR pass. Hospitals run an operations portal that pushes status changes to patients in real time. Everyone gets a one-tap emergency mode with **Call 112**, first-aid video guides and a triage check.

## Contact

Team Medic Hub · medichubnigeria@gmail.com · 07042744090

## Medic AI and languages

- Language picker (header globe, Profile › Language): English, Nigerian Pidgin, Yoruba, Hausa, Igbo. Interface strings are translated; first-aid steps stay in English until clinically reviewed. Translations need native-speaker review before launch.
- Medic AI (`/assistant`): health Q&A in the chosen language with danger-sign detection (shows Call 112), optional Health Vault personalisation (off by default), and a Stop button. Inside the Claude artifact viewer it uses the `sample` capability; elsewhere set `VITE_AI_ENDPOINT` to a server route like `server/ask.example.ts`. With neither, it answers from the built-in first-aid guides.

## Deploy to GitHub Pages

1. Create an empty public repository on GitHub, for example `medic-hub`.
2. Push this folder to its `main` branch (commands below).
3. The live site is served from the `gh-pages` branch (Settings › Pages › Deploy from a branch › `gh-pages`). To rebuild: `npm run build`, then push the contents of `dist/` to `gh-pages`.
4. Optional automatic deploys: copy `docs-deploy/deploy.yml.example` to `.github/workflows/deploy.yml` and switch Pages to GitHub Actions (pushing it needs a token with the Workflows permission).

```bash
git remote add origin https://github.com/<your-username>/medic-hub.git
git push -u origin main
```

Medic AI on GitHub Pages answers from the built-in guides unless you deploy `server/ask.example.ts` somewhere (e.g. Vercel) and build with `VITE_AI_ENDPOINT` set.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/ (deploy to Vercel/Netlify as a static site)
SINGLE=1 npm run build   # one self-contained HTML file in dist-single/
```

## Demo accounts (password `demo1234`)

| Role | Email | What to show |
|---|---|---|
| Patient | amaka@medichub.demo | Find care → book → QR pass, Health Vault, emergency snapshot |
| Hospital | ops@lagooncrest.demo | Live status, capacity, slots, booking queue, check-in (`MED-7X82K9`, `MED-K7RA5N`), announcements |
| Reviewer | review@medichub.demo | Approve Tanke Hills Medical Centre → it appears in patient search |

The landing page has one-click buttons for all three. The account menu has **Reset demo data**.

### The three demo moments
1. **Live status**: open the hospital portal in one tab and `#/hospitals/h_lagooncrest` in another. Switch Emergency from Open to Busy. The patient tab flashes the change and shows a live toast.
2. **Instant booking pass**: book any slot. A confirmation animates in and the QR pass rises into view.
3. **Emergency mode**: tap Emergency (or SOS on mobile). A red wash expands from your tap into a stripped-back screen with Call 112 first.

## Architecture

```
src/
  components/  ui, navigation, hospitals, bookings, emergency, hospital-admin
  pages/       public, patient, hospital, admin
  layouts/     App (patient), Hospital (ops portal), Admin, Emergency, Auth
  services/    auth, hospitals, bookings, health, notifications  ← all data access + access policies
  lib/store.ts relational data engine (localStorage + cross-tab realtime)
  data/        seed (17 fictional hospitals), first-aid content, wellness content
  supabase/schema.sql  Postgres schema + Row Level Security + atomic booking function
```

**Data layer.** No backend credentials were available during the build, so the app ships with an in-browser relational store (`src/lib/store.ts`) that mirrors `supabase/schema.sql` table-for-table. It persists to localStorage and broadcasts every write to other tabs via `BroadcastChannel`, which gives the same realtime behaviour Supabase Realtime provides. Every read and write goes through `src/services/*`, which enforce the same rules as the RLS policies: patients only see their own health data and bookings; hospital staff can only act on their own facility; only reviewers can change verification; unverified hospitals are not public.

**Moving to Supabase.** Run `supabase/schema.sql`, then re-implement the functions in `src/services/*` with `supabase-js` (signatures stay the same). Bookings should call the `book_slot()` RPC so capacity is enforced atomically. Replace `db.subscribe` in `useLive` with `supabase.channel(...).on('postgres_changes', ...)`. Client-side checks are a UX layer; RLS is the real security boundary.

## Honest notes
- Hospitals are fictional demo facilities. Nothing claims a real hospital is verified.
- First-aid videos are real British Red Cross and St John Ambulance videos, linked or embedded from their source (YouTube privacy-enhanced mode). They are UK-produced; the app reminds users that the number in Nigeria is 112. Durations aren't shown because we didn't measure them.
- Medic Hub does not dispatch ambulances. `Call 112` is a `tel:` link; on desktop it tells you to dial from a phone.
- The map is a dependency-free schematic using real coordinates, with “Directions” opening Google Maps. Swap in Mapbox/Leaflet tiles if you have a key.
- Password reset shows the reset link on screen (“demo inbox”) because email isn't connected.
- Nutrition values are approximate per typical serving.
