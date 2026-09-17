-- Security hardening after the September 2026 audit. Every change narrows what an authenticated staff
-- member can do; nothing changes for the public or for the super admin.

-- ── Riders and personal data ────────────────────────────────────────────────────────────────────────
-- Before: any organizer of any event could rename every rider and overwrite anyone's personal data, and
-- could read personal data by entering a rider into their own event. Now personal data is reachable only
-- through events the caller works on that are current (not finished more than 30 days ago), which also
-- matches the retention promised on the privacy page.

create function public.can_manage_rider(p_rider_id bigint, p_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.entries e
    join public.events ev on ev.id = e.event_id
    where e.rider_id = p_rider_id
      and ev.date_to >= current_date - 30
      and public.has_event_role(e.event_id, p_roles)
  );
$$;

drop policy "riders: organizer update" on public.riders;
create policy "riders: organizer update" on public.riders
  for update to authenticated
  using (public.can_manage_rider(id, array['organizer']::public.staff_role[]));

drop policy "rider_private: staff read" on public.rider_private;
create policy "rider_private: staff read" on public.rider_private
  for select to authenticated
  using (public.can_manage_rider(rider_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]));

drop policy "rider_private: organizer insert" on public.rider_private;
create policy "rider_private: organizer insert" on public.rider_private
  for insert to authenticated
  with check (public.can_manage_rider(rider_id, array['organizer']::public.staff_role[]));

drop policy "rider_private: organizer update" on public.rider_private;
create policy "rider_private: organizer update" on public.rider_private
  for update to authenticated
  using (public.can_manage_rider(rider_id, array['organizer']::public.staff_role[]));

-- ── Penalties ───────────────────────────────────────────────────────────────────────────────────────
-- Before: a GPS judge could change the seconds, units or type of a penalty the jury had already confirmed.
-- Now a reviewed penalty is edited only by the jury, and seconds and DSQ scope always follow the type.

create or replace function public.penalties_snapshot()
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
  new.seconds := case t.kind
    when 'time'          then t.seconds
    when 'time_per_unit' then t.seconds * new.units
    else null
  end;
  new.dsq_scope := t.dsq_scope;
  return new;
end;
$$;

create or replace function public.guard_penalty_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.status <> 'proposed')
     or (tg_op = 'UPDATE' and (new.status is distinct from old.status or old.status <> 'proposed')) then
    if not public.has_event_role(new.event_id, array['jury', 'jury_chair']::public.staff_role[]) then
      raise exception 'Only the jury can confirm, reject or change a reviewed penalty';
    end if;
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- ── Events ──────────────────────────────────────────────────────────────────────────────────────────
-- Before: an organizer could move their event into the championship or change its round number, which
-- feeds season standings. Those three fields are now the super admin's.

create function public.guard_event_championship()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.kind, new.season_id, new.round_number) is distinct from (old.kind, old.season_id, old.round_number)
     and not public.is_super_admin() then
    raise exception 'Only the super admin can change the championship, season or round of an event';
  end if;
  return new;
end;
$$;

create trigger guard_event_championship
  before update on public.events
  for each row execute function public.guard_event_championship();

-- ── Publications ────────────────────────────────────────────────────────────────────────────────────
-- Before: staff could insert a publication with a snapshot they wrote themselves. Now the only way in is
-- publish_results, which builds the snapshot from the results views.

create function public.guard_publication_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('todorovnet.publishing', true) is distinct from 'on' then
    raise exception 'Results are published only through publish_results';
  end if;
  return new;
end;
$$;

create trigger guard_publication_source
  before insert on public.publications
  for each row execute function public.guard_publication_source();

create or replace function public.publish_results(
  p_event_id        bigint,
  p_stage_id        bigint,
  p_state           public.publication_state,
  p_protest_minutes int default null,
  p_note            text default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_stage    public.stages;
  v_ranking  text;
  v_event    jsonb;
  v_classes  jsonb;
  v_body     jsonb;
  v_id       bigint;
begin
  -- Marks this transaction as a real publication; guard_publication_source refuses any other insert.
  perform set_config('todorovnet.publishing', 'on', true);

  if p_stage_id is not null then
    select * into v_stage from public.stages where id = p_stage_id and event_id = p_event_id;
    if not found then
      raise exception 'Stage % does not belong to event %', p_stage_id, p_event_id;
    end if;
  end if;

  select e.ranking,
         jsonb_build_object(
           'id', e.id, 'name', e.name, 'location', e.location, 'date_from', e.date_from,
           'date_to', e.date_to, 'round_number', e.round_number, 'timezone', e.timezone)
    into v_ranking, v_event
  from public.events e where e.id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'code', c.code, 'name', c.name, 'name_en', c.name_en,
           'number_bg', c.number_bg, 'number_fg', c.number_fg) order by ec.start_order, c.sort_order), '[]'::jsonb)
    into v_classes
  from public.event_classes ec join public.classes c on c.id = ec.class_id
  where ec.event_id = p_event_id;

  if p_stage_id is null and v_ranking = 'time' then
    select jsonb_build_object('kind', 'round_time', 'rows', coalesce(jsonb_agg(
             to_jsonb(r) || jsonb_build_object('first_name', ri.first_name, 'last_name', ri.last_name,
                                               'country', ri.country, 'club', cl.name)
             order by r.class_id, r.position nulls last, r.race_number), '[]'::jsonb))
      into v_body
    from public.round_time_results r
    join public.entries en on en.id = r.entry_id
    join public.riders ri on ri.id = en.rider_id
    left join public.clubs cl on cl.id = en.club_id
    where r.event_id = p_event_id;

  elsif p_stage_id is null then
    select jsonb_build_object('kind', 'round', 'rows', coalesce(jsonb_agg(
             to_jsonb(r) || jsonb_build_object('first_name', ri.first_name, 'last_name', ri.last_name,
                                               'country', ri.country, 'club', cl.name)
             order by r.class_id, r.position, r.race_number), '[]'::jsonb))
      into v_body
    from public.round_results r
    join public.entries en on en.id = r.entry_id
    join public.riders ri on ri.id = en.rider_id
    left join public.clubs cl on cl.id = en.club_id
    where r.event_id = p_event_id;

  elsif v_stage.type = 'navigation' then
    select jsonb_build_object('kind', 'navigation', 'rows', coalesce(jsonb_agg(
             to_jsonb(r) || jsonb_build_object('first_name', ri.first_name, 'last_name', ri.last_name,
                                               'country', ri.country, 'club', cl.name)
             order by r.class_id, r.position nulls last, r.race_number), '[]'::jsonb))
      into v_body
    from public.navigation_results r
    join public.entries en on en.id = r.entry_id
    join public.riders ri on ri.id = en.rider_id
    left join public.clubs cl on cl.id = en.club_id
    where r.stage_id = p_stage_id;

  elsif v_stage.type = 'enduro_cross' then
    select jsonb_build_object(
             'kind', 'enduro_cross',
             'rows', coalesce((
               select jsonb_agg(to_jsonb(x) || jsonb_build_object('first_name', ri.first_name, 'last_name', ri.last_name,
                                                                  'country', ri.country, 'club', cl.name)
                                order by x.class_id, x.position nulls last, x.race_number)
               from public.enduro_cross_results x
               join public.entries en on en.id = x.entry_id
               join public.riders ri on ri.id = en.rider_id
               left join public.clubs cl on cl.id = en.club_id
               where x.stage_id = p_stage_id), '[]'::jsonb),
             'sessions', coalesce((
               select jsonb_agg(to_jsonb(s) order by s.class_id, s.kind, s.number, s.position nulls last)
               from public.session_results s where s.stage_id = p_stage_id), '[]'::jsonb))
      into v_body;

  else
    raise exception 'Publishing % stages is not supported yet', v_stage.type;
  end if;

  insert into public.publications (event_id, stage_id, state, protest_deadline_at, note, snapshot, published_by_name)
  values (
    p_event_id,
    p_stage_id,
    p_state,
    case when p_protest_minutes is not null then now() + make_interval(mins => p_protest_minutes) end,
    nullif(btrim(p_note), ''),
    v_body || jsonb_build_object(
      'event', v_event,
      'stage', case when p_stage_id is null then null
                    else jsonb_build_object('id', v_stage.id, 'name', v_stage.name, 'name_en', v_stage.name_en,
                                            'type', v_stage.type, 'day_number', v_stage.day_number) end,
      'classes', v_classes),
    (select nullif(p.full_name, '') from public.profiles p where p.id = auth.uid())
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ── Course messages ─────────────────────────────────────────────────────────────────────────────────
-- Before: resolving a message allowed rewriting its text, kind and location. Only the resolution changes now.

revoke update on public.marshal_messages from authenticated;
grant update (resolved_at, resolved_by) on public.marshal_messages to authenticated;

-- ── Timing facts ────────────────────────────────────────────────────────────────────────────────────
-- A checkpoint passing must use a checkpoint of the same stage.

create function public.guard_passing_checkpoint()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.checkpoint_id is not null and not exists (
    select 1 from public.checkpoints c where c.id = new.checkpoint_id and c.stage_id = new.stage_id
  ) then
    raise exception 'Checkpoint % is not on stage %', new.checkpoint_id, new.stage_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger guard_passing_checkpoint
  before insert or update of checkpoint_id, stage_id on public.passings
  for each row execute function public.guard_passing_checkpoint();

-- A lap must belong to a rider of the session's class.
create function public.guard_lap_class()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions s join public.entries e on e.class_id = s.class_id
    where s.id = new.session_id and e.id = new.entry_id
  ) then
    raise exception 'Rider is not in the class of this session' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_lap_class
  before insert or update of session_id, entry_id on public.laps
  for each row execute function public.guard_lap_class();
