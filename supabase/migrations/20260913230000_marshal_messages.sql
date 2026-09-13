-- Messages from the course: SOS (a rider in trouble) and information from controls and timekeepers.
-- Sent from the timing app, queued offline like timing records (client_id keeps retries single),
-- visible live to the event's staff only. Location is the sender's phone, not the rider's.

create type public.message_kind as enum ('sos', 'info');

create table public.marshal_messages (
  id            bigint generated always as identity primary key,
  client_id     uuid not null unique,
  event_id      bigint not null references public.events (id) on delete cascade,
  stage_id      bigint,
  checkpoint_id bigint references public.checkpoints (id) on delete set null,
  kind          public.message_kind not null,
  race_number   int check (race_number > 0),
  body          text not null default '',
  lat           double precision check (lat between -90 and 90),
  lon           double precision check (lon between -180 and 180),
  accuracy_m    real check (accuracy_m >= 0),
  sent_at       timestamptz not null,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users (id) on delete set null,
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade
);

create index on public.marshal_messages (event_id, created_at desc);

alter table public.marshal_messages enable row level security;

create policy "marshal_messages: staff read" on public.marshal_messages
  for select to authenticated using (public.is_event_staff(event_id));
create policy "marshal_messages: staff send" on public.marshal_messages
  for insert to authenticated with check (public.is_event_staff(event_id) and resolved_at is null);
create policy "marshal_messages: resolve" on public.marshal_messages
  for update to authenticated
  using (public.has_event_role(event_id, array['organizer', 'timekeeper', 'jury', 'jury_chair']::public.staff_role[]));

create trigger audit after insert or update or delete on public.marshal_messages
  for each row execute function public.write_audit_log();

alter publication supabase_realtime add table public.marshal_messages;
