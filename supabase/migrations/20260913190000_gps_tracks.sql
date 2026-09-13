-- GPS track check: official tracks per stage and class, and where the files live.
--
-- Two storage buckets:
--   gps-tracks  private. Official tracks and riders' logs. A rider's log is personal location data,
--               so only the event's GPS judges, jury and organizer can read it.
--   evidence    public read. The rulebook requires the track and a screenshot of the problem spot to be
--               published with every track or speed penalty (Р XIX.10).
-- Object paths start with events/<event_id>/ so the policies can check the caller's role in that event.

insert into storage.buckets (id, name, public)
values ('gps-tracks', 'gps-tracks', false), ('evidence', 'evidence', true)
on conflict (id) do nothing;

create function public.storage_event_id(p_name text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] = 'events' and (storage.foldername(p_name))[2] ~ '^\d+$'
      then ((storage.foldername(p_name))[2])::bigint
  end;
$$;

create policy "gps-tracks: staff read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'gps-tracks'
    and public.has_event_role(public.storage_event_id(name), array['gps_judge', 'jury', 'jury_chair', 'organizer']::public.staff_role[])
  );
create policy "gps-tracks: staff upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gps-tracks'
    and public.has_event_role(public.storage_event_id(name), array['gps_judge', 'jury', 'jury_chair', 'organizer']::public.staff_role[])
  );
create policy "gps-tracks: staff replace" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'gps-tracks'
    and public.has_event_role(public.storage_event_id(name), array['gps_judge', 'jury', 'jury_chair', 'organizer']::public.staff_role[])
  );

-- Evidence is readable by anyone through the public bucket URL; only judges add it, nobody edits it.
create policy "evidence: staff upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and public.has_event_role(public.storage_event_id(name), array['gps_judge', 'jury', 'jury_chair', 'organizer']::public.staff_role[])
  );

create table public.stage_tracks (
  id                  bigint generated always as identity primary key,
  event_id            bigint not null,
  stage_id            bigint not null,
  class_id            bigint, -- null: the track applies to every class of the stage
  name                text not null,
  storage_path        text not null check (storage_path like 'events/%'),
  point_count         int not null default 0,
  length_m            numeric(10, 1),
  -- Waypoint names from the official file that riders must pass (controls, SS start and finish).
  mandatory_waypoints text[] not null default '{}',
  uploaded_by         uuid default auth.uid() references auth.users (id) on delete set null,
  uploaded_at         timestamptz not null default now(),
  unique nulls not distinct (stage_id, class_id),
  foreign key (stage_id, event_id) references public.stages (id, event_id) on delete cascade
);

create index on public.stage_tracks (event_id);

alter table public.stage_tracks enable row level security;

create policy "stage_tracks: staff read" on public.stage_tracks
  for select to authenticated
  using (public.has_event_role(event_id, array['gps_judge', 'jury', 'jury_chair', 'organizer']::public.staff_role[]));
create policy "stage_tracks: staff write" on public.stage_tracks
  for all to authenticated
  using (public.has_event_role(event_id, array['gps_judge', 'jury', 'jury_chair', 'organizer']::public.staff_role[]))
  with check (public.has_event_role(event_id, array['gps_judge', 'jury', 'jury_chair', 'organizer']::public.staff_role[]));

create trigger audit after insert or update or delete on public.stage_tracks
  for each row execute function public.write_audit_log();
