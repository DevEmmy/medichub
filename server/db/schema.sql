-- Medic Hub production database (PostgreSQL 14+).
-- One table per entity, typed columns, foreign keys and indexes.
-- Column names are the snake_case of the app's TypeScript fields (src/types/index.ts),
-- so the server maps rows generically. Nested values (opening hours, registration, etc.) are jsonb.
-- Safe to run repeatedly.

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('patient', 'hospital', 'admin')),
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists patient_profiles (
  user_id text primary key references users(id) on delete cascade,
  city text,
  date_of_birth text,
  gender text,
  onboarded boolean not null default false
);

create table if not exists hospitals (
  id text primary key,
  slug text not null,
  name text not null,
  type text not null,
  tagline text not null default '',
  description text not null default '',
  address text not null default '',
  area text not null default '',
  city text not null default '',
  state text not null default '',
  lat double precision not null,
  lng double precision not null,
  phone text not null default '',
  emergency_phone text not null default '',
  email text not null default '',
  website text,
  socials jsonb not null default '[]',
  hue integer not null default 160,
  logo text,
  cover text,
  photos jsonb,
  is24h boolean not null default false,
  hours jsonb not null default '[]',
  facilities jsonb not null default '[]',
  specialties jsonb not null default '[]',
  verification text not null default 'draft' check (verification in ('draft','pending','under_review','verified','needs_attention','rejected')),
  verification_note text,
  registration jsonb not null default '{}',
  admin jsonb not null default '{}',
  auto_confirm boolean not null default true,
  public_record boolean,
  ownership text,
  plan text default 'basic' check (plan in ('basic','premium')),
  plan_trial_ends_at text,
  automations jsonb,
  payouts_enabled boolean,
  owner_user_id text not null references users(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hospitals_verification_idx on hospitals(verification);
create index if not exists hospitals_city_idx on hospitals(city);

create table if not exists hospital_staff (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('owner','staff')),
  unique (hospital_id, user_id)
);
create index if not exists hospital_staff_user_idx on hospital_staff(user_id);

create table if not exists hospital_departments (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  name text not null,
  head text,
  phone text,
  status text not null check (status in ('open','busy','closed'))
);
create index if not exists hospital_departments_h_idx on hospital_departments(hospital_id);

create table if not exists hospital_services (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  name text not null,
  category text not null,
  department_id text,
  duration_mins integer not null,
  fee integer,
  bookable boolean not null,
  active boolean not null
);
create index if not exists hospital_services_h_idx on hospital_services(hospital_id);

create table if not exists hospital_doctors (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  name text not null,
  specialty text not null,
  department_id text,
  available boolean not null
);
create index if not exists hospital_doctors_h_idx on hospital_doctors(hospital_id);

create table if not exists hospital_status (
  hospital_id text primary key references hospitals(id) on delete cascade,
  emergency text not null check (emergency in ('open','busy','closed')),
  oxygen text not null,
  pharmacy text not null,
  laboratory text not null,
  ambulance text not null,
  maternity text not null,
  theatre text not null,
  blood_bank text not null,
  updated_at timestamptz not null,
  last_reminder_at timestamptz
);

create table if not exists hospital_capacity (
  hospital_id text primary key references hospitals(id) on delete cascade,
  overall text not null check (overall in ('available','moderate','high','full')),
  emergency text not null check (emergency in ('available','limited','full')),
  beds_total integer not null check (beds_total >= 0),
  beds_available integer not null check (beds_available >= 0),
  icu_available integer not null check (icu_available >= 0),
  updated_at timestamptz not null
);

create table if not exists hospital_slots (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  service_id text not null,
  date date not null,
  time text not null,
  capacity integer not null check (capacity >= 0),
  booked integer not null check (booked >= 0)
);
create index if not exists hospital_slots_lookup_idx on hospital_slots(hospital_id, service_id, date);

create table if not exists bookings (
  id text primary key,
  ref text not null unique,
  token text not null,
  patient_id text not null references users(id),
  patient_name text not null,
  patient_phone text,
  hospital_id text not null references hospitals(id),
  service_id text not null,
  slot_id text not null,
  date date not null,
  time text not null,
  reason text,
  status text not null check (status in ('awaiting_payment','pending','confirmed','checked_in','in_consultation','completed','cancelled','no_show')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  reminded_at timestamptz,
  amount integer,
  payment_status text check (payment_status in ('unpaid','paid','refunded','failed')),
  payment_ref text,
  paid_at timestamptz,
  pay_at_hospital boolean
);
create index if not exists bookings_patient_idx on bookings(patient_id);
create index if not exists bookings_hospital_date_idx on bookings(hospital_id, date);

create table if not exists booking_events (
  id text primary key,
  booking_id text not null references bookings(id) on delete cascade,
  status text not null,
  at timestamptz not null,
  by text not null,
  note text
);
create index if not exists booking_events_b_idx on booking_events(booking_id);

create table if not exists health_profiles (
  user_id text primary key references users(id) on delete cascade,
  blood_group text not null default '',
  genotype text not null default '',
  allergies jsonb not null default '[]',
  conditions jsonb not null default '[]',
  medications jsonb not null default '[]',
  height_cm double precision,
  weight_kg double precision,
  notes text not null default '',
  updated_at timestamptz not null
);

create table if not exists health_events (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  detail text,
  date date not null,
  place text
);
create index if not exists health_events_u_idx on health_events(user_id);

create table if not exists emergency_contacts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  "primary" boolean not null default false
);
create index if not exists emergency_contacts_u_idx on emergency_contacts(user_id);

create table if not exists notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null
);
create index if not exists notifications_u_idx on notifications(user_id, created_at desc);

create table if not exists hospital_announcements (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  title text not null,
  body text not null,
  severity text not null check (severity in ('info','warning','critical')),
  active boolean not null,
  created_at timestamptz not null
);
create index if not exists hospital_announcements_h_idx on hospital_announcements(hospital_id);

create table if not exists hospital_documents (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  name text not null,
  kind text not null,
  size integer not null,
  file_id text,
  uploaded_at timestamptz not null,
  status text not null check (status in ('submitted','accepted','needs_attention'))
);
create index if not exists hospital_documents_h_idx on hospital_documents(hospital_id);

create table if not exists files (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  name text not null,
  mime text not null,
  size integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists password_resets (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);

create table if not exists hospital_reviews (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  patient_id text not null references users(id) on delete cascade,
  author_name text not null,
  booking_id text not null unique references bookings(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  tags jsonb not null default '[]',
  comment text not null default '',
  created_at timestamptz not null,
  reply jsonb
);
create index if not exists hospital_reviews_h_idx on hospital_reviews(hospital_id, created_at desc);

create table if not exists payments (
  id text primary key,
  reference text not null unique,
  booking_id text not null references bookings(id) on delete cascade,
  hospital_id text not null references hospitals(id),
  patient_id text not null references users(id),
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status text not null check (status in ('initialized','success','failed','abandoned','refunded')),
  provider text not null,
  channel text,
  gateway_response text,
  created_at timestamptz not null,
  paid_at timestamptz,
  refunded_at timestamptz
);
create index if not exists payments_booking_idx on payments(booking_id);
create index if not exists payments_hospital_idx on payments(hospital_id, created_at desc);

create table if not exists hospital_payouts (
  hospital_id text primary key references hospitals(id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_last4 text not null,
  account_name text not null,
  subaccount_code text not null,
  provider text not null,
  verified_at timestamptz not null
);

-- Email confirmation links sent at sign-up
create table if not exists email_verifications (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);
alter table users add column if not exists email_verified_at timestamptz;
alter table users add column if not exists via_phone boolean;
alter table bookings add column if not exists channel text;

-- People at the hospital who get booking emails (no login needed)
create table if not exists hospital_team (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  name text not null,
  role text not null,
  email text not null,
  phone text,
  department_id text,
  alerts jsonb not null,
  active boolean not null default true,
  last_digest_on date,
  created_at timestamptz not null default now()
);
create index if not exists hospital_team_hospital on hospital_team(hospital_id);

-- Every email Medic Hub sends for a hospital (booking alerts, daily schedules, patient confirmations)
create table if not exists email_log (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  booking_id text,
  to_email text not null,
  to_name text,
  audience text not null check (audience in ('team','patient')),
  kind text not null,
  subject text not null,
  body text not null,
  status text not null check (status in ('queued','sent','failed','simulated')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists email_log_hospital on email_log(hospital_id, created_at desc);

-- Upgrades for databases created before payments existed
alter table hospitals add column if not exists payouts_enabled boolean;
alter table bookings add column if not exists amount integer;
alter table bookings add column if not exists payment_status text;
alter table bookings add column if not exists payment_ref text;
alter table bookings add column if not exists paid_at timestamptz;
alter table bookings add column if not exists pay_at_hospital boolean;
alter table hospitals add column if not exists photos jsonb;
alter table hospital_documents add column if not exists file_id text;
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check check (status in ('awaiting_payment','pending','confirmed','checked_in','in_consultation','completed','cancelled','no_show'));

-- Doctors get appointment alerts and their own dashboard
alter table hospital_doctors add column if not exists email text;
alter table hospital_doctors add column if not exists phone text;
alter table hospital_doctors add column if not exists user_id text;
alter table bookings add column if not exists doctor_id text;
alter table bookings add column if not exists doctor_name text;
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('patient','hospital','admin','doctor'));
