-- Medic Hub — Postgres schema + Row Level Security for Supabase
-- Mirrors the tables used by the in-browser data engine (src/lib/store.ts) and the
-- access rules enforced in src/services/core.ts. Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role as enum ('patient', 'hospital', 'admin');
create type verification_status as enum ('draft', 'pending', 'under_review', 'verified', 'needs_attention', 'rejected');
create type emergency_level as enum ('open', 'busy', 'closed');
create type availability as enum ('available', 'limited', 'unavailable');
create type overall_capacity as enum ('available', 'moderate', 'high', 'full');
create type emergency_capacity as enum ('available', 'limited', 'full');
create type booking_status as enum ('pending', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show');
create type announcement_severity as enum ('info', 'warning', 'critical');
create type health_event_type as enum ('appointment', 'visit', 'vaccination', 'lab', 'medication', 'profile');

-- ---------- Identity ----------
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role user_role not null default 'patient',   -- 'admin' is never self-assignable (see trigger below)
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table patient_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  city text, date_of_birth date, gender text, onboarded boolean not null default false
);

-- ---------- Hospitals ----------
create table hospitals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null,
  tagline text, description text,
  address text, area text, city text, state text,
  lat double precision, lng double precision,
  phone text, emergency_phone text, email text, website text,
  socials jsonb not null default '[]',
  hue int not null default 160,
  logo_path text, cover_path text,                 -- Supabase Storage paths (bucket: hospital-media)
  is_24h boolean not null default false,
  hours jsonb not null default '[]',
  facilities text[] not null default '{}',
  specialties text[] not null default '{}',
  verification verification_status not null default 'pending',
  verification_note text,
  registration jsonb not null default '{}',
  admin_contact jsonb not null default '{}',
  auto_confirm boolean not null default true,
  owner_user_id uuid not null references users(id),
  submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table hospital_staff (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  unique (hospital_id, user_id)
);

create table hospital_departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null, head text, phone text,
  status emergency_level not null default 'open'
);

create table hospital_services (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null, category text not null,
  department_id uuid references hospital_departments(id) on delete set null,
  duration_mins int not null default 20, fee int,
  bookable boolean not null default true, active boolean not null default true
);

create table hospital_doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null, specialty text not null,
  department_id uuid references hospital_departments(id) on delete set null,
  available boolean not null default true
);

create table hospital_status (
  hospital_id uuid primary key references hospitals(id) on delete cascade,
  emergency emergency_level not null default 'open',
  oxygen availability not null default 'available',
  pharmacy availability not null default 'available',
  laboratory availability not null default 'available',
  ambulance availability not null default 'unavailable',
  maternity availability not null default 'unavailable',
  theatre availability not null default 'unavailable',
  blood_bank availability not null default 'unavailable',
  updated_at timestamptz not null default now()
);

create table hospital_capacity (
  hospital_id uuid primary key references hospitals(id) on delete cascade,
  overall overall_capacity not null default 'available',
  emergency emergency_capacity not null default 'available',
  beds_total int not null default 0 check (beds_total >= 0),
  beds_available int not null default 0 check (beds_available >= 0 and beds_available <= beds_total),
  icu_available int not null default 0,
  updated_at timestamptz not null default now()
);

create table hospital_slots (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  service_id uuid not null references hospital_services(id) on delete cascade,
  date date not null, time time not null,
  capacity int not null check (capacity >= 0),
  booked int not null default 0 check (booked >= 0 and booked <= capacity),
  unique (service_id, date, time)
);

create table hospital_announcements (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  title text not null, body text, severity announcement_severity not null default 'info',
  active boolean not null default true, created_at timestamptz not null default now()
);

create table hospital_documents (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null, kind text, size int, storage_path text,   -- bucket: hospital-documents (private)
  status text not null default 'submitted', uploaded_at timestamptz not null default now()
);

-- ---------- Bookings ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                                       -- e.g. MED-7X82K9
  token text not null default encode(gen_random_bytes(24), 'hex'), -- secret in the QR payload
  patient_id uuid not null references users(id),
  patient_name text not null, patient_phone text,
  hospital_id uuid not null references hospitals(id),
  service_id uuid not null references hospital_services(id),
  slot_id uuid not null references hospital_slots(id),
  date date not null, time time not null, reason text,
  status booking_status not null default 'confirmed',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on bookings (hospital_id, date);
create index on bookings (patient_id);

create table booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  status booking_status not null, by text not null, note text, at timestamptz not null default now()
);

-- ---------- Private health data ----------
create table health_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  blood_group text, genotype text,
  allergies text[] not null default '{}', conditions text[] not null default '{}',
  medications jsonb not null default '[]',
  height_cm int, weight_kg int, notes text, updated_at timestamptz not null default now()
);
create table health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type health_event_type not null, title text not null, detail text, date date not null, place text
);
create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null, relationship text, phone text not null, "primary" boolean not null default false
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null, title text not null, body text, link text,
  read boolean not null default false, created_at timestamptz not null default now()
);

-- ---------- Public content ----------
create table emergency_guides (slug text primary key, title text not null, short text, icon text, severity text, call_112_when text, do_now text[], dont text[], video_ids text[], keywords text[]);
create table emergency_videos (id text primary key, title text not null, description text, emergency_type text, youtube_id text, source_url text not null, source_org text not null, duration_label text, safety_note text);
create table nutrition_content (id text primary key, name text not null, local_name text, serving text, calories int, protein numeric, carbs numeric, fat numeric, fiber numeric, meal_type text, diet text[], note text);
create table wellness_content (id text primary key, name text not null, category text, level text, minutes int, summary text, steps text[]);

-- ---------- Helpers ----------
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where id = auth.uid() and role = 'admin') $$;

create or replace function is_staff_of(h uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from hospital_staff where hospital_id = h and user_id = auth.uid()) $$;

create or replace function hospital_is_public(h uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from hospitals where id = h and verification = 'verified') $$;

-- Users can never promote themselves to admin, or change role after signup.
create or replace function guard_user_role() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.role = 'admin' and not is_admin() then raise exception 'admin role cannot be self-assigned'; end if;
  if tg_op = 'UPDATE' and new.role <> old.role and not is_admin() then raise exception 'role cannot be changed'; end if;
  return new;
end $$;
create trigger users_role_guard before insert or update on users for each row execute function guard_user_role();

-- Staff cannot verify their own facility.
create or replace function guard_verification() returns trigger language plpgsql as $$
begin
  if new.verification <> old.verification and not is_admin()
     and not (old.verification in ('needs_attention', 'rejected') and new.verification = 'pending') then
    raise exception 'only reviewers can change verification';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger hospitals_verification_guard before update on hospitals for each row execute function guard_verification();

-- Atomic booking: locks the slot row so two patients can't take the last place.
create or replace function book_slot(p_slot uuid, p_reason text, p_phone text) returns bookings
language plpgsql security definer set search_path = public as $$
declare s hospital_slots; b bookings; u users; ref text;
begin
  select * into u from users where id = auth.uid() and role = 'patient';
  if not found then raise exception 'only patients can book'; end if;
  select * into s from hospital_slots where id = p_slot for update;
  if not found then raise exception 'slot not found'; end if;
  if not hospital_is_public(s.hospital_id) then raise exception 'facility not accepting bookings'; end if;
  if s.booked >= s.capacity then raise exception 'slot full'; end if;
  if (s.date + s.time) <= now() at time zone 'Africa/Lagos' then raise exception 'slot in the past'; end if;
  update hospital_slots set booked = booked + 1 where id = p_slot;
  ref := 'MED-' || upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1I', ''), 1, 6));
  insert into bookings (ref, patient_id, patient_name, patient_phone, hospital_id, service_id, slot_id, date, time, reason, status)
  values (ref, u.id, u.name, coalesce(p_phone, u.phone), s.hospital_id, s.service_id, s.id, s.date, s.time, p_reason,
          case when (select auto_confirm from hospitals where id = s.hospital_id) then 'confirmed'::booking_status else 'pending' end)
  returning * into b;
  insert into booking_events (booking_id, status, by) values (b.id, b.status, 'patient');
  return b;
end $$;

-- ---------- Row Level Security ----------
alter table users enable row level security;
alter table patient_profiles enable row level security;
alter table hospitals enable row level security;
alter table hospital_staff enable row level security;
alter table hospital_departments enable row level security;
alter table hospital_services enable row level security;
alter table hospital_doctors enable row level security;
alter table hospital_status enable row level security;
alter table hospital_capacity enable row level security;
alter table hospital_slots enable row level security;
alter table hospital_announcements enable row level security;
alter table hospital_documents enable row level security;
alter table bookings enable row level security;
alter table booking_events enable row level security;
alter table health_profiles enable row level security;
alter table health_events enable row level security;
alter table emergency_contacts enable row level security;
alter table notifications enable row level security;
alter table emergency_guides enable row level security;
alter table emergency_videos enable row level security;
alter table nutrition_content enable row level security;
alter table wellness_content enable row level security;

-- users: you see yourself; reviewers see everyone
create policy users_self on users for select using (id = auth.uid() or is_admin());
create policy users_insert_self on users for insert with check (id = auth.uid());
create policy users_update_self on users for update using (id = auth.uid());

-- patient-private data: owner only (hospitals get NO access)
create policy pp_owner on patient_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy hp_owner on health_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy he_owner on health_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ec_owner on emergency_contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy nt_owner on notifications for select using (user_id = auth.uid());
create policy nt_owner_update on notifications for update using (user_id = auth.uid());

-- hospitals: public sees verified; staff see their own; reviewers see all
create policy h_public on hospitals for select using (verification = 'verified' or is_staff_of(id) or is_admin());
create policy h_create on hospitals for insert with check (owner_user_id = auth.uid() and verification = 'pending'
  and exists (select 1 from users where id = auth.uid() and role = 'hospital'));
create policy h_staff_update on hospitals for update using (is_staff_of(id) or is_admin());

create policy hs_read on hospital_staff for select using (user_id = auth.uid() or is_staff_of(hospital_id) or is_admin());
create policy hs_owner_insert on hospital_staff for insert with check (
  (user_id = auth.uid() and exists (select 1 from hospitals where id = hospital_id and owner_user_id = auth.uid())) or is_admin());

-- operational tables: public read when the hospital is listed; write only by that hospital's staff
do $$
declare t text;
begin
  foreach t in array array['hospital_departments','hospital_services','hospital_doctors','hospital_status','hospital_capacity','hospital_slots','hospital_announcements'] loop
    execute format('create policy %1$s_read on %1$s for select using (hospital_is_public(hospital_id) or is_staff_of(hospital_id) or is_admin())', t);
    execute format('create policy %1$s_write on %1$s for all using (is_staff_of(hospital_id)) with check (is_staff_of(hospital_id))', t);
  end loop;
end $$;

-- documents: never public
create policy hd_staff on hospital_documents for all using (is_staff_of(hospital_id) or is_admin()) with check (is_staff_of(hospital_id));

-- bookings: patient sees own; hospital staff see bookings for their facility only
create policy b_patient_read on bookings for select using (patient_id = auth.uid());
create policy b_staff_read on bookings for select using (is_staff_of(hospital_id));
create policy b_patient_cancel on bookings for update using (patient_id = auth.uid() and status in ('pending', 'confirmed'))
  with check (patient_id = auth.uid() and status = 'cancelled');
create policy b_staff_update on bookings for update using (is_staff_of(hospital_id)) with check (is_staff_of(hospital_id));
-- inserts go through book_slot() (security definer) so capacity is enforced atomically

create policy be_read on booking_events for select using (exists (select 1 from bookings b where b.id = booking_id and (b.patient_id = auth.uid() or is_staff_of(b.hospital_id))));
create policy be_staff_insert on booking_events for insert with check (exists (select 1 from bookings b where b.id = booking_id and (b.patient_id = auth.uid() or is_staff_of(b.hospital_id))));

-- public content: read-only for everyone
create policy eg_read on emergency_guides for select using (true);
create policy ev_read on emergency_videos for select using (true);
create policy nc_read on nutrition_content for select using (true);
create policy wc_read on wellness_content for select using (true);

-- ---------- Realtime ----------
-- Patient screens subscribe to these so hospital changes appear instantly.
alter publication supabase_realtime add table hospital_status, hospital_capacity, hospital_slots, hospital_announcements, bookings, notifications;
