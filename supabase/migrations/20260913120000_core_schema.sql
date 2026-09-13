-- TodorovNET core schema.
-- Rules source: docs/bgx-rules.md (BG-X Правилник 2026). Section refs like "Р XIX.4" point there.
--
-- Principles:
--   * Raw facts only (clock passings, lap crossings, penalties, statuses). Standings are derived, never stored by hand.
--   * Every timing fact carries a client-generated UUID, so an offline retry can never create a duplicate.
--   * Corrections void a row instead of deleting it, and every change lands in audit_log.
--   * Authorization lives in the database (RLS). The UI only hides what the database already forbids.

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
create type public.event_kind        as enum ('championship_round', 'free');
create type public.event_status      as enum ('draft', 'upcoming', 'live', 'finished');
create type public.stage_type        as enum ('prologue', 'navigation', 'enduro_cross', 'gncc');
create type public.staff_role        as enum ('organizer', 'timekeeper', 'gps_judge', 'jury', 'jury_chair');
create type public.session_kind      as enum ('qualifying', 'heat');
create type public.passing_point     as enum ('start', 'checkpoint', 'finish');
create type public.fact_source       as enum ('manual', 'import', 'device');
create type public.penalty_kind      as enum ('time', 'time_per_unit', 'dsq', 'dnf', 'no_start', 'fine');
create type public.dsq_scope         as enum ('session', 'stage', 'event', 'event_and_next_round');
create type public.review_status     as enum ('proposed', 'confirmed', 'rejected');
create type public.rider_status      as enum ('dns', 'dnf', 'dsq', 'nc');
create type public.protest_type      as enum ('incident', 'result', 'navigation', 'eligibility', 'technical');
create type public.protest_status    as enum ('filed', 'upheld', 'rejected', 'withdrawn');
create type public.publication_state as enum ('provisional', 'official');
create type public.license_type      as enum ('promo', 'enduro_a', 'enduro_b', 'one_event', 'foreign');

-- ─────────────────────────────────────────────────────────────
-- People and access
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Season, clubs, classes, riders
-- ─────────────────────────────────────────────────────────────
create table public.points_scales (
  code   text primary key,
  name   text not null,
  points int[] not null check (cardinality(points) > 0)
);

create table public.seasons (
  id                bigint generated always as identity primary key,
  year              int  not null check (year between 2000 and 2100),
  name              text not null,
  drop_worst_rounds int  not null default 1 check (drop_worst_rounds >= 0), -- Р XVIII.3
  unique (year, name)
);

create table public.clubs (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  country      char(2) not null default 'BG',
  bfm_licensed boolean not null default true
);

create table public.classes (
  id           bigint generated always as identity primary key,
  season_id    bigint references public.seasons (id) on delete cascade, -- null: template for free events
  code         text not null,
  name         text not null,
  min_age      int check (min_age > 0),
  max_age      int check (max_age > 0),
  number_bg    text, -- race-number background colour, Р VI.4
  number_fg    text,
  team_scoring boolean not null default false, -- Pro / Expert / Standard count for clubs
  sort_order   int not null default 0,
  unique nulls not distinct (season_id, code),
  check (max_age is null or min_age is null or max_age >= min_age)
);

-- Public part of a rider. Personal data lives in rider_private.
create table public.riders (
  id         bigint generated always as identity primary key,
  first_name text not null check (btrim(first_name) <> ''),
  last_name  text not null check (btrim(last_name) <> ''),
  country    char(2) not null default 'BG',
  club_id    bigint references public.clubs (id) on delete set null,
  created_at timestamptz not null default now()
);

-- GDPR: birth date, contacts, blood group, licence. Never readable by the public.
create table public.rider_private (
  rider_id            bigint primary key references public.riders (id) on delete cascade,
  birth_date          date,
  phone               text,
  email               text,
  blood_group         text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','0+','0-','unknown')),
  license_type        public.license_type,
  license_number      text,
  license_valid_until date,
  gps_model           text,
  notes               text
);

-- Season race-number registry (bgx.bg/racenumbers.html).
create table public.season_numbers (
  season_id   bigint not null references public.seasons (id) on delete cascade,
  race_number int    not null check (race_number > 0),
  rider_id    bigint not null references public.riders (id) on delete cascade,
  class_id    bigint not null references public.classes (id),
  primary key (season_id, race_number),
  unique (season_id, rider_id)
);

-- ─────────────────────────────────────────────────────────────
-- Events
-- ─────────────────────────────────────────────────────────────
create table public.events (
  id           bigint generated always as identity primary key,
  season_id    bigint references public.seasons (id) on delete set null,
  kind         public.event_kind   not null default 'free',
  round_number int check (round_number > 0),
  name         text not null,
  location     text not null default '',
  date_from    date not null,
  date_to      date not null,
  timezone     text not null default 'Europe/Sofia',
  status       public.event_status not null default 'draft',
  image_url    text,
  created_at   timestamptz not null default now(),
  check (date_to >= date_from),
  check (kind = 'free' or (season_id is not null and round_number is not null))
);

create table public.event_staff (
  event_id bigint not null references public.events (id) on delete cascade,
  user_id  uuid   not null references auth.users (id) on delete cascade,
  role     public.staff_role not null,
  primary key (event_id, user_id, role)
);

create table public.event_classes (
  event_id    bigint not null references public.events (id) on delete cascade,
  class_id    bigint not null references public.classes (id),
  start_order int not null default 0, -- class order is set per event, Р XI
  primary key (event_id, class_id)
);

create table public.entries (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references public.events (id) on delete cascade,
  rider_id    bigint not null references public.riders (id),
  class_id    bigint not null,
  race_number int    not null check (race_number > 0),
  club_id     bigint references public.clubs (id) on delete set null, -- frozen at entry; a mid-season club change brings no points, Р p.16
  transponder text,
  withdrawn   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (event_id, race_number),
  unique (event_id, rider_id),
  unique (id, event_id),
  foreign key (event_id, class_id) references public.event_classes (event_id, class_id)
);

create function public.entries_default_club()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.club_id is null then
    select r.club_id into new.club_id from public.riders r where r.id = new.rider_id;
  end if;
  return new;
end;
$$;

create trigger entries_default_club
  before insert on public.entries
  for each row execute function public.entries_default_club();

-- A stage is one scored part of an event: prologue, a navigation day, an enduro-cross day.
create table public.stages (
  id                     bigint generated always as identity primary key,
  event_id               bigint not null references public.events (id) on delete cascade,
  day_number             int    not null check (day_number >= 1),
  sort_order             int    not null default 0,
  type                   public.stage_type not null,
  name                   text   not null,
  points_scale           text references public.points_scales (code), -- null: no points (prologue)
  first_start_at         timestamptz,
  start_interval_seconds int check (start_interval_seconds > 0),
  riders_per_slot        int not null default 1 check (riders_per_slot > 0),
  course_closes_at       timestamptz, -- finishing later means not classified, Р XIX.5
  unique (id, event_id)
);

create table public.stage_classes (
  stage_id         bigint not null,
  event_id         bigint not null,
  class_id         bigint not null,
  start_order            int not null default 0,
  distance_km            numeric(6, 1),
  course_closes_at       timestamptz, -- per-class override of the stage close time
  -- Start-list generation. Observed practice: Pro 1 rider per 30 s, other classes 2 per 30 s, 2–5 min between classes.
  start_interval_seconds int check (start_interval_seconds > 0), -- null: use the stage default
  riders_per_slot        int check (riders_per_slot > 0),
  gap_before_seconds     int not null default 0 check (gap_before_seconds >= 0),
  primary key (stage_id, class_id),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (event_id, class_id) references public.event_classes (event_id, class_id) on delete cascade
);

-- Navigation elapsed time runs from the scheduled start, not the actual one. Р XII.3
create table public.start_slots (
  stage_id        bigint not null,
  event_id        bigint not null,
  entry_id        bigint not null,
  position        int    not null check (position > 0),
  scheduled_start timestamptz not null,
  primary key (stage_id, entry_id),
  unique (stage_id, position),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (entry_id, event_id) references public.entries (id, event_id) on delete cascade
);

create table public.checkpoints (
  id           bigint generated always as identity primary key,
  stage_id     bigint not null,
  event_id     bigint not null,
  code         text   not null,
  name         text   not null default '',
  sort_order   int    not null default 0,
  is_mandatory boolean not null default true, -- missed mandatory control: 1 h, Р XIX.8
  unique (stage_id, code),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Timing facts
-- ─────────────────────────────────────────────────────────────
create table public.passings (
  id            bigint generated always as identity primary key,
  client_id     uuid   not null unique, -- idempotency key generated on the device
  event_id      bigint not null,
  stage_id      bigint not null,
  entry_id      bigint not null,
  point         public.passing_point not null,
  checkpoint_id bigint references public.checkpoints (id) on delete cascade,
  passed_at     timestamptz not null,
  source        public.fact_source not null default 'manual',
  recorded_by   uuid default auth.uid() references auth.users (id) on delete set null,
  recorded_at   timestamptz not null default now(),
  voided_at     timestamptz,
  voided_by     uuid references auth.users (id) on delete set null,
  void_reason   text,
  check ((point = 'checkpoint') = (checkpoint_id is not null)),
  check ((voided_at is null) = (void_reason is null)),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (entry_id, event_id) references public.entries (id, event_id) on delete cascade
);

-- One active start, one active finish, one active passing per checkpoint. Two timers cannot double-record a rider.
create unique index passings_one_active
  on public.passings (stage_id, entry_id, point, coalesce(checkpoint_id, 0))
  where voided_at is null;

-- Enduro-cross qualifying sessions and heats. Р XVI
create table public.sessions (
  id               bigint generated always as identity primary key,
  event_id         bigint not null,
  stage_id         bigint not null,
  class_id         bigint not null,
  kind             public.session_kind not null,
  group_label      text,                  -- 'A' / 'B' when a class has more than 20 riders
  number           int  not null default 1,
  duration_minutes int  check (duration_minutes > 0),
  extra_laps       int  not null default 1 check (extra_laps >= 0), -- "N min + 1 lap"
  started_at       timestamptz,
  finished_at      timestamptz,
  red_flag_at      timestamptz,
  unique nulls not distinct (stage_id, class_id, kind, group_label, number),
  unique (id, event_id),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (event_id, class_id) references public.event_classes (event_id, class_id) on delete cascade
);

create table public.session_riders (
  session_id    bigint not null,
  event_id      bigint not null,
  entry_id      bigint not null,
  grid_position int check (grid_position > 0),
  primary key (session_id, entry_id),
  foreign key (session_id, event_id) references public.sessions (id, event_id) on delete cascade,
  foreign key (entry_id, event_id) references public.entries (id, event_id) on delete cascade
);

-- Every crossing of the line. Lap times are derived from consecutive crossings.
create table public.laps (
  id          bigint generated always as identity primary key,
  client_id   uuid   not null unique,
  event_id    bigint not null,
  session_id  bigint not null,
  entry_id    bigint not null,
  crossed_at  timestamptz not null,
  source      public.fact_source not null default 'manual',
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references auth.users (id) on delete set null,
  void_reason text,
  check ((voided_at is null) = (void_reason is null)),
  foreign key (session_id, event_id) references public.sessions (id, event_id) on delete cascade,
  foreign key (entry_id, event_id) references public.entries (id, event_id) on delete cascade
);

create unique index laps_one_active_crossing
  on public.laps (session_id, entry_id, crossed_at)
  where voided_at is null;

-- Neutralised time: first aid (Р XIV.7) or a fixed rest deducted from a whole class.
create table public.time_adjustments (
  id         bigint generated always as identity primary key,
  event_id   bigint not null,
  stage_id   bigint not null,
  entry_id   bigint,
  class_id   bigint,
  seconds    numeric(10, 3) not null, -- negative deducts time
  reason     text not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((entry_id is null) <> (class_id is null)),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (entry_id, event_id) references public.entries (id, event_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Penalties, statuses, protests, publication
-- ─────────────────────────────────────────────────────────────
-- Catalogue. event_id null = default BG-X catalogue; an event can override or add its own.
create table public.penalty_types (
  id         bigint generated always as identity primary key,
  event_id   bigint references public.events (id) on delete cascade,
  code       text not null,
  name       text not null,
  rule_ref   text,
  kind       public.penalty_kind not null,
  seconds    numeric(10, 3),
  unit_label text,
  dsq_scope  public.dsq_scope,
  fine_eur   numeric(8, 2),
  active     boolean not null default true,
  unique nulls not distinct (event_id, code),
  check ((kind in ('time', 'time_per_unit')) = (seconds is not null)),
  check ((kind = 'time_per_unit') = (unit_label is not null)),
  check ((kind = 'dsq') = (dsq_scope is not null)),
  check ((kind = 'fine') = (fine_eur is not null))
);

create table public.penalties (
  id              bigint generated always as identity primary key,
  event_id        bigint not null,
  stage_id        bigint not null,
  session_id      bigint,
  entry_id        bigint not null,
  penalty_type_id bigint not null references public.penalty_types (id),
  units           numeric(10, 3) not null default 1 check (units > 0),
  seconds         numeric(10, 3), -- snapshot at creation, so catalogue edits never rewrite history
  dsq_scope       public.dsq_scope,
  note            text,
  evidence_url    text, -- track + screenshot must be published with the penalty, Р XIX.10
  status          public.review_status not null default 'proposed',
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (session_id, event_id) references public.sessions (id, event_id) on delete cascade,
  foreign key (entry_id, event_id) references public.entries (id, event_id) on delete cascade
);

create table public.rider_statuses (
  id         bigint generated always as identity primary key,
  event_id   bigint not null,
  stage_id   bigint not null,
  session_id bigint,
  entry_id   bigint not null,
  status     public.rider_status not null,
  reason     text,
  set_by     uuid default auth.uid() references auth.users (id) on delete set null,
  set_at     timestamptz not null default now(),
  unique nulls not distinct (stage_id, session_id, entry_id),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (session_id, event_id) references public.sessions (id, event_id) on delete cascade,
  foreign key (entry_id, event_id) references public.entries (id, event_id) on delete cascade
);

-- Р XX: 80 EUR, one fact per protest, written decision within 24 h.
create table public.protests (
  id                bigint generated always as identity primary key,
  event_id          bigint not null references public.events (id) on delete cascade,
  stage_id          bigint,
  filed_by_entry_id bigint,
  against_entry_id  bigint,
  type              public.protest_type not null,
  fact              text not null,
  fee_eur           numeric(8, 2) not null default 80,
  fee_paid          boolean not null default false,
  fee_refunded      boolean not null default false,
  filed_at          timestamptz not null default now(),
  deadline_at       timestamptz,
  status            public.protest_status not null default 'filed',
  decision          text,
  decided_by        uuid references auth.users (id) on delete set null,
  decided_at        timestamptz,
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade,
  foreign key (filed_by_entry_id, event_id) references public.entries (id, event_id),
  foreign key (against_entry_id, event_id) references public.entries (id, event_id),
  check ((status in ('upheld', 'rejected')) = (decision is not null))
);

-- Provisional → protest window → official (approved by the jury chair, Р I.4).
create table public.publications (
  id                  bigint generated always as identity primary key,
  event_id            bigint not null references public.events (id) on delete cascade,
  stage_id            bigint, -- null: the round's final classification
  state               public.publication_state not null,
  published_at        timestamptz not null default now(),
  published_by        uuid default auth.uid() references auth.users (id) on delete set null,
  protest_deadline_at timestamptz,
  note                text,
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Indexes for foreign keys and hot paths
-- ─────────────────────────────────────────────────────────────
create index on public.classes (season_id);
create index on public.riders (club_id);
create index on public.season_numbers (rider_id);
create index on public.events (season_id);
create index on public.event_staff (user_id);
create index on public.entries (rider_id);
create index on public.stages (event_id);
create index on public.start_slots (entry_id);
create index on public.passings (event_id);
create index on public.passings (entry_id);
create index on public.sessions (stage_id);
create index on public.session_riders (entry_id);
create index on public.laps (entry_id);
create index on public.laps (event_id);
create index on public.time_adjustments (stage_id);
create index on public.penalties (stage_id, entry_id);
create index on public.penalties (event_id);
create index on public.rider_statuses (event_id);
create index on public.protests (event_id);
create index on public.publications (event_id, stage_id);

-- ─────────────────────────────────────────────────────────────
-- Integrity triggers
-- ─────────────────────────────────────────────────────────────
-- Penalty seconds and DSQ scope are frozen from the catalogue when the penalty is created.
create function public.penalties_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t public.penalty_types;
begin
  select * into t from public.penalty_types where id = new.penalty_type_id;
  if t.event_id is not null and t.event_id <> new.event_id then
    raise exception 'Penalty type % belongs to another event', t.id;
  end if;
  if tg_op = 'INSERT' or new.penalty_type_id <> old.penalty_type_id or new.units <> old.units then
    new.seconds := case t.kind
      when 'time'          then t.seconds
      when 'time_per_unit' then t.seconds * new.units
      else null
    end;
    new.dsq_scope := t.dsq_scope;
  end if;
  return new;
end;
$$;

create trigger penalties_snapshot
  before insert or update on public.penalties
  for each row execute function public.penalties_snapshot();

-- ─────────────────────────────────────────────────────────────
-- Authorization helpers
-- ─────────────────────────────────────────────────────────────
create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.has_event_role(p_event_id bigint, p_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.event_staff s
    where s.event_id = p_event_id
      and s.user_id = (select auth.uid())
      and s.role = any (p_roles)
  );
$$;

create function public.is_event_staff(p_event_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_event_role(p_event_id, enum_range(null::public.staff_role));
$$;

-- Draft events are visible only to their staff.
create function public.event_visible(p_event_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.status <> 'draft')
      or public.is_event_staff(p_event_id);
$$;

create function public.is_any_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1 from public.event_staff s
    where s.user_id = (select auth.uid()) and s.role = 'organizer'
  );
$$;

-- Only the jury decides a penalty (Р XXIII.4); only the jury chair makes results official (Р I.4).
create function public.guard_penalty_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.status <> 'proposed')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if not public.has_event_role(new.event_id, array['jury', 'jury_chair']::public.staff_role[]) then
      raise exception 'Only the jury can confirm or reject a penalty';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger guard_penalty_review
  before insert or update on public.penalties
  for each row execute function public.guard_penalty_review();

create function public.guard_official_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state = 'official'
     and not public.has_event_role(new.event_id, array['jury_chair']::public.staff_role[]) then
    raise exception 'Only the jury chair can publish official results';
  end if;
  return new;
end;
$$;

create trigger guard_official_publication
  before insert or update on public.publications
  for each row execute function public.guard_official_publication();

-- ─────────────────────────────────────────────────────────────
-- Audit log
-- ─────────────────────────────────────────────────────────────
create table public.audit_log (
  id         bigint generated always as identity primary key,
  event_id   bigint,
  table_name text not null,
  row_id     text not null,
  action     text not null,
  old_row    jsonb,
  new_row    jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

create index on public.audit_log (event_id, changed_at desc);

create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (event_id, table_name, row_id, action, old_row, new_row)
  values (
    (r ->> 'event_id')::bigint,
    tg_table_name,
    coalesce(r ->> 'id', concat_ws(':', r ->> 'stage_id', r ->> 'entry_id', r ->> 'user_id', r ->> 'role')),
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'entries', 'start_slots', 'passings', 'laps', 'time_adjustments',
    'penalties', 'rider_statuses', 'protests', 'publications', 'event_staff'
  ] loop
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function public.write_audit_log()', t);
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.points_scales    enable row level security;
alter table public.seasons          enable row level security;
alter table public.clubs            enable row level security;
alter table public.classes          enable row level security;
alter table public.riders           enable row level security;
alter table public.rider_private    enable row level security;
alter table public.season_numbers   enable row level security;
alter table public.events           enable row level security;
alter table public.event_staff      enable row level security;
alter table public.event_classes    enable row level security;
alter table public.entries          enable row level security;
alter table public.stages           enable row level security;
alter table public.stage_classes    enable row level security;
alter table public.start_slots      enable row level security;
alter table public.checkpoints      enable row level security;
alter table public.passings         enable row level security;
alter table public.sessions         enable row level security;
alter table public.session_riders   enable row level security;
alter table public.laps             enable row level security;
alter table public.time_adjustments enable row level security;
alter table public.penalty_types    enable row level security;
alter table public.penalties        enable row level security;
alter table public.rider_statuses   enable row level security;
alter table public.protests         enable row level security;
alter table public.publications     enable row level security;
alter table public.audit_log        enable row level security;

-- Profiles: users see and rename themselves; nobody can grant themselves super admin.
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_super_admin());
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_super_admin());
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Global reference data: public read, super admin write.
do $$
declare
  t text;
begin
  foreach t in array array['points_scales', 'seasons', 'clubs', 'classes', 'season_numbers'] loop
    execute format('create policy "%1$s: public read" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('create policy "%1$s: admin insert" on public.%1$I for insert to authenticated with check (public.is_super_admin())', t);
    execute format('create policy "%1$s: admin update" on public.%1$I for update to authenticated using (public.is_super_admin())', t);
    execute format('create policy "%1$s: admin delete" on public.%1$I for delete to authenticated using (public.is_super_admin())', t);
  end loop;
end;
$$;

-- Riders: public names; organizers register riders.
create policy "riders: public read" on public.riders
  for select to anon, authenticated using (true);
create policy "riders: organizer insert" on public.riders
  for insert to authenticated with check (public.is_any_organizer());
create policy "riders: organizer update" on public.riders
  for update to authenticated using (public.is_any_organizer());
create policy "riders: admin delete" on public.riders
  for delete to authenticated using (public.is_super_admin());

-- Personal data: super admin, or organizer/jury of an event the rider is entered in.
create policy "rider_private: staff read" on public.rider_private
  for select to authenticated
  using (
    public.is_super_admin() or exists (
      select 1 from public.entries e
      where e.rider_id = rider_private.rider_id
        and public.has_event_role(e.event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[])
    )
  );
create policy "rider_private: organizer insert" on public.rider_private
  for insert to authenticated with check (public.is_any_organizer());
create policy "rider_private: organizer update" on public.rider_private
  for update to authenticated using (public.is_any_organizer());
create policy "rider_private: admin delete" on public.rider_private
  for delete to authenticated using (public.is_super_admin());

-- Events
create policy "events: read visible" on public.events
  for select to anon, authenticated using (status <> 'draft' or public.is_event_staff(id));
create policy "events: admin insert" on public.events
  for insert to authenticated with check (public.is_super_admin());
create policy "events: organizer update" on public.events
  for update to authenticated using (public.has_event_role(id, array['organizer']::public.staff_role[]));
create policy "events: admin delete" on public.events
  for delete to authenticated using (public.is_super_admin());

-- Staff: super admin manages everyone; an organizer manages timekeepers and GPS judges only.
create policy "event_staff: staff read" on public.event_staff
  for select to authenticated using (public.is_event_staff(event_id));
create policy "event_staff: insert" on public.event_staff
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (role in ('timekeeper', 'gps_judge')
        and public.has_event_role(event_id, array['organizer']::public.staff_role[]))
  );
create policy "event_staff: delete" on public.event_staff
  for delete to authenticated
  using (
    public.is_super_admin()
    or (role in ('timekeeper', 'gps_judge')
        and public.has_event_role(event_id, array['organizer']::public.staff_role[]))
  );

-- Event set-up tables: public read when the event is visible, organizer write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'event_classes', 'entries', 'stages', 'stage_classes', 'start_slots',
    'checkpoints', 'sessions', 'session_riders'
  ] loop
    execute format('create policy "%1$s: read" on public.%1$I for select to anon, authenticated using (public.event_visible(event_id))', t);
    execute format('create policy "%1$s: organizer insert" on public.%1$I for insert to authenticated with check (public.has_event_role(event_id, array[''organizer'']::public.staff_role[]))', t);
    execute format('create policy "%1$s: organizer update" on public.%1$I for update to authenticated using (public.has_event_role(event_id, array[''organizer'']::public.staff_role[]))', t);
    execute format('create policy "%1$s: organizer delete" on public.%1$I for delete to authenticated using (public.has_event_role(event_id, array[''organizer'']::public.staff_role[]))', t);
  end loop;
end;
$$;

-- Timekeepers also run sessions (start, finish, red flag).
create policy "sessions: timekeeper update" on public.sessions
  for update to authenticated
  using (public.has_event_role(event_id, array['timekeeper']::public.staff_role[]));

-- Timing facts: public live read; timekeepers record and void; nobody but super admin deletes.
do $$
declare
  t text;
begin
  foreach t in array array['passings', 'laps'] loop
    execute format('create policy "%1$s: read" on public.%1$I for select to anon, authenticated using (public.event_visible(event_id))', t);
    execute format('create policy "%1$s: timekeeper insert" on public.%1$I for insert to authenticated with check (public.has_event_role(event_id, array[''organizer'', ''timekeeper'']::public.staff_role[]))', t);
    execute format('create policy "%1$s: timekeeper update" on public.%1$I for update to authenticated using (public.has_event_role(event_id, array[''organizer'', ''timekeeper'']::public.staff_role[]))', t);
    execute format('create policy "%1$s: admin delete" on public.%1$I for delete to authenticated using (public.is_super_admin())', t);
  end loop;
end;
$$;

create policy "time_adjustments: read" on public.time_adjustments
  for select to anon, authenticated using (public.event_visible(event_id));
create policy "time_adjustments: jury write" on public.time_adjustments
  for all to authenticated
  using (public.has_event_role(event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]))
  with check (public.has_event_role(event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]));

create policy "penalty_types: read" on public.penalty_types
  for select to anon, authenticated using (event_id is null or public.event_visible(event_id));
create policy "penalty_types: write" on public.penalty_types
  for all to authenticated
  using (
    case when event_id is null then public.is_super_admin()
         else public.has_event_role(event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]) end
  )
  with check (
    case when event_id is null then public.is_super_admin()
         else public.has_event_role(event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]) end
  );

-- Penalties: the public sees confirmed ones; staff see every proposal.
create policy "penalties: read" on public.penalties
  for select to anon, authenticated
  using ((status = 'confirmed' and public.event_visible(event_id)) or public.is_event_staff(event_id));
create policy "penalties: propose" on public.penalties
  for insert to authenticated
  with check (public.has_event_role(event_id, array['gps_judge', 'timekeeper', 'jury', 'jury_chair', 'organizer']::public.staff_role[]));
create policy "penalties: update" on public.penalties
  for update to authenticated
  using (public.has_event_role(event_id, array['gps_judge', 'jury', 'jury_chair']::public.staff_role[]));
create policy "penalties: delete proposed" on public.penalties
  for delete to authenticated
  using (status = 'proposed' and public.has_event_role(event_id, array['gps_judge', 'jury', 'jury_chair']::public.staff_role[]));

create policy "rider_statuses: read" on public.rider_statuses
  for select to anon, authenticated using (public.event_visible(event_id));
create policy "rider_statuses: write" on public.rider_statuses
  for all to authenticated
  using (public.has_event_role(event_id, array['organizer', 'timekeeper', 'jury', 'jury_chair']::public.staff_role[]))
  with check (public.has_event_role(event_id, array['organizer', 'timekeeper', 'jury', 'jury_chair']::public.staff_role[]));

create policy "protests: read decided or staff" on public.protests
  for select to anon, authenticated
  using ((status in ('upheld', 'rejected') and public.event_visible(event_id)) or public.is_event_staff(event_id));
create policy "protests: file" on public.protests
  for insert to authenticated
  with check (public.has_event_role(event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]));
create policy "protests: decide" on public.protests
  for update to authenticated
  using (public.has_event_role(event_id, array['jury', 'jury_chair']::public.staff_role[]));

create policy "publications: read" on public.publications
  for select to anon, authenticated using (public.event_visible(event_id));
create policy "publications: publish" on public.publications
  for insert to authenticated
  with check (public.has_event_role(event_id, array['organizer', 'timekeeper', 'jury_chair']::public.staff_role[]));

create policy "audit_log: organizer read" on public.audit_log
  for select to authenticated
  using (public.is_super_admin() or (event_id is not null and public.has_event_role(event_id, array['organizer', 'jury_chair']::public.staff_role[])));

-- ─────────────────────────────────────────────────────────────
-- Realtime: live timing tables
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table
  public.passings, public.laps, public.penalties, public.rider_statuses,
  public.sessions, public.start_slots, public.publications;
