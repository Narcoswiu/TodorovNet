-- Enduro-cross formats (Р XVI): qualifying groups, the finals grid, and red flags.

-- What the officials decided after a red flag: 'count' keeps the heat and classifies it at the moment of
-- the flag; 'restart' is carried out by restart_session(), which voids the heat's crossings.
alter table public.sessions
  add column red_flag_decision text check (red_flag_decision in ('count', 'restart'));

-- More than 20 riders in a class: two qualifying groups, A and B, filled alternately by the navigation
-- result (1st to A, 2nd to B, ...). Classes of 20 or fewer keep one qualifying session with everybody.
-- Returns the number of classes that were split.
create function public.build_qualifying_groups(p_stage_id bigint)
returns int
language plpgsql
set search_path = ''
as $$
declare
  st       public.stages;
  c        record;
  e        record;
  v_nav    bigint;
  v_a      bigint;
  v_b      bigint;
  v_count  int;
  v_index  int;
  v_split  int := 0;
begin
  select * into st from public.stages where id = p_stage_id;
  if not found or st.type <> 'enduro_cross' then
    raise exception 'Stage % is not an enduro-cross stage', p_stage_id;
  end if;
  if not public.has_event_role(st.event_id, array['organizer']::public.staff_role[]) then
    raise exception 'Only the organizer can build qualifying groups' using errcode = '42501';
  end if;

  select s.id into v_nav
  from public.stages s
  where s.event_id = st.event_id and s.type = 'navigation' and s.day_number <= st.day_number
  order by s.day_number desc
  limit 1;

  for c in select sc.class_id from public.stage_classes sc where sc.stage_id = p_stage_id loop
    select count(*) into v_count
    from public.entries en
    where en.event_id = st.event_id and en.class_id = c.class_id and not en.withdrawn;

    continue when v_count <= 20;

    -- An ungrouped qualifying session is replaced, unless timing has already started in it.
    delete from public.sessions s
    where s.stage_id = p_stage_id and s.class_id = c.class_id and s.kind = 'qualifying' and s.group_label is null
      and not exists (select 1 from public.laps l where l.session_id = s.id);

    insert into public.sessions (event_id, stage_id, class_id, kind, group_label, number, duration_minutes)
    values (st.event_id, p_stage_id, c.class_id, 'qualifying', 'A', 1, 15),
           (st.event_id, p_stage_id, c.class_id, 'qualifying', 'B', 1, 15)
    on conflict (stage_id, class_id, kind, group_label, number) do nothing;

    select id into v_a from public.sessions
    where stage_id = p_stage_id and class_id = c.class_id and kind = 'qualifying' and group_label = 'A' and number = 1;
    select id into v_b from public.sessions
    where stage_id = p_stage_id and class_id = c.class_id and kind = 'qualifying' and group_label = 'B' and number = 1;

    delete from public.session_riders where session_id in (v_a, v_b);

    v_index := 0;
    for e in
      select en.id
      from public.entries en
      left join public.navigation_results nr on nr.stage_id = v_nav and nr.entry_id = en.id
      where en.event_id = st.event_id and en.class_id = c.class_id and not en.withdrawn
      order by nr.position nulls last, en.race_number
    loop
      insert into public.session_riders (session_id, event_id, entry_id)
      values (case when v_index % 2 = 0 then v_a else v_b end, st.event_id, e.id);
      v_index := v_index + 1;
    end loop;

    v_split := v_split + 1;
  end loop;

  return v_split;
end;
$$;

grant execute on function public.build_qualifying_groups(bigint) to authenticated;

-- The finals grid for every heat of the stage: the best p_size riders on best qualifying lap across all
-- groups. A rider without a qualifying time may not race (Р XVI); if qualifying was cancelled for a class,
-- the navigation result decides instead (Р XVI.8). Returns the number of grid places filled.
create function public.build_finals_grid(p_stage_id bigint, p_size int default 12)
returns int
language plpgsql
set search_path = ''
as $$
declare
  st            public.stages;
  c             record;
  h             record;
  v_nav         bigint;
  v_qualified   boolean;
  v_rows        int;
  v_total       int := 0;
begin
  select * into st from public.stages where id = p_stage_id;
  if not found or st.type <> 'enduro_cross' then
    raise exception 'Stage % is not an enduro-cross stage', p_stage_id;
  end if;
  if not public.has_event_role(st.event_id, array['organizer']::public.staff_role[]) then
    raise exception 'Only the organizer can build the finals grid' using errcode = '42501';
  end if;

  select s.id into v_nav
  from public.stages s
  where s.event_id = st.event_id and s.type = 'navigation' and s.day_number <= st.day_number
  order by s.day_number desc
  limit 1;

  for c in select sc.class_id from public.stage_classes sc where sc.stage_id = p_stage_id loop
    select exists (
      select 1 from public.session_results sr
      where sr.stage_id = p_stage_id and sr.class_id = c.class_id and sr.kind = 'qualifying' and sr.result_status = 'classified'
    ) into v_qualified;

    for h in
      select s.id from public.sessions s
      where s.stage_id = p_stage_id and s.class_id = c.class_id and s.kind = 'heat'
    loop
      delete from public.session_riders where session_id = h.id;

      insert into public.session_riders (session_id, event_id, entry_id, grid_position)
      select h.id, st.event_id, ranked.entry_id, ranked.grid
      from (
        select
          en.id as entry_id,
          q.best_lap_s,
          row_number() over (order by q.best_lap_s nulls last, nr.position nulls last, en.race_number) as grid
        from public.entries en
        left join (
          select sr.entry_id, min(sr.best_lap_s) as best_lap_s
          from public.session_results sr
          where sr.stage_id = p_stage_id and sr.class_id = c.class_id and sr.kind = 'qualifying' and sr.result_status = 'classified'
          group by sr.entry_id
        ) q on q.entry_id = en.id
        left join public.navigation_results nr on nr.stage_id = v_nav and nr.entry_id = en.id
        where en.event_id = st.event_id and en.class_id = c.class_id and not en.withdrawn
      ) ranked
      where ranked.grid <= p_size
        and (ranked.best_lap_s is not null or not v_qualified);

      get diagnostics v_rows = row_count;
      v_total := v_total + v_rows;
    end loop;
  end loop;

  return v_total;
end;
$$;

grant execute on function public.build_finals_grid(bigint, int) to authenticated;

-- Red flag → restart: the heat's crossings are voided (kept for the audit trail) and the session goes
-- back to not started. Returns the number of crossings voided.
create function public.restart_session(p_session_id bigint)
returns int
language plpgsql
set search_path = ''
as $$
declare
  s       public.sessions;
  v_count int;
begin
  select * into s from public.sessions where id = p_session_id;
  if not found then
    raise exception 'Session % not found', p_session_id;
  end if;
  if not public.has_event_role(s.event_id, array['organizer', 'timekeeper']::public.staff_role[]) then
    raise exception 'Only the organizer or a timekeeper can restart a session' using errcode = '42501';
  end if;

  update public.laps
  set voided_at = now(), voided_by = auth.uid(), void_reason = 'red flag restart'
  where session_id = p_session_id and voided_at is null;
  get diagnostics v_count = row_count;

  update public.sessions
  set started_at = null, finished_at = null, red_flag_at = null, red_flag_decision = 'restart'
  where id = p_session_id;

  return v_count;
end;
$$;

grant execute on function public.restart_session(bigint) to authenticated;

-- Session results now respect a red flag that was decided as 'count': crossings after the flag are ignored.
create or replace view public.session_results
with (security_invoker = true)
as
with riders as (
  select
    s.event_id, s.stage_id, s.id as session_id, s.class_id, s.kind, s.number, s.group_label,
    s.started_at, st.points_scale,
    e.id as entry_id, e.rider_id, e.race_number
  from public.sessions s
  join public.stages st on st.id = s.stage_id
  join public.entries e
    on e.event_id = s.event_id and e.class_id = s.class_id and not e.withdrawn
  where not exists (select 1 from public.session_riders sr where sr.session_id = s.id)
     or exists (select 1 from public.session_riders sr where sr.session_id = s.id and sr.entry_id = e.id)
),
crossings as (
  select
    l.session_id,
    l.entry_id,
    l.crossed_at,
    l.crossed_at - lag(l.crossed_at) over w as since_previous
  from public.laps l
  join public.sessions s on s.id = l.session_id
  where l.voided_at is null
    and (s.red_flag_decision is distinct from 'count' or s.red_flag_at is null or l.crossed_at <= s.red_flag_at)
  window w as (partition by l.session_id, l.entry_id order by l.crossed_at)
),
agg as (
  select
    r.event_id, r.stage_id, r.session_id, r.class_id, r.kind, r.number, r.group_label,
    r.started_at, r.points_scale, r.entry_id, r.rider_id, r.race_number,
    count(c.crossed_at) as crossings,
    max(c.crossed_at)   as last_crossing,
    min(extract(epoch from
      case when r.kind = 'qualifying' then c.since_previous
           else coalesce(c.since_previous, c.crossed_at - r.started_at) end)) as best_lap_s
  from riders r
  left join crossings c on c.session_id = r.session_id and c.entry_id = r.entry_id
  group by
    r.event_id, r.stage_id, r.session_id, r.class_id, r.kind, r.number, r.group_label,
    r.started_at, r.points_scale, r.entry_id, r.rider_id, r.race_number
),
statused as (
  select
    a.*,
    case when a.kind = 'qualifying' then greatest(a.crossings - 1, 0) else a.crossings end as laps,
    coalesce((select sum(pn.seconds) from public.penalties pn
      where pn.session_id = a.session_id and pn.entry_id = a.entry_id
        and pn.status = 'confirmed' and pn.seconds is not null), 0) as penalty_s,
    case
      when exists (select 1 from public.penalties pn
             where pn.entry_id = a.entry_id and pn.status = 'confirmed'
               and (pn.dsq_scope in ('event', 'event_and_next_round')
                    or (pn.stage_id = a.stage_id and pn.dsq_scope = 'stage')
                    or (pn.session_id = a.session_id and pn.dsq_scope = 'session')))
        then 'dsq'
      else (select rs.status::text from public.rider_statuses rs
             where rs.session_id = a.session_id and rs.entry_id = a.entry_id)
    end as forced_status
  from agg a
),
classified as (
  select
    s.*,
    extract(epoch from s.last_crossing - s.started_at) + s.penalty_s as total_s,
    case
      when s.forced_status is not null                              then s.forced_status
      when s.kind = 'qualifying' and s.best_lap_s is not null       then 'classified'
      when s.kind = 'heat' and s.laps >= 1 and s.started_at is not null then 'classified'
      when s.crossings = 0                                           then 'dns'
      else 'nc'
    end as result_status
  from statused s
),
ranked as (
  select
    c.*,
    case when c.result_status = 'classified' then
      case when c.kind = 'qualifying' then
        rank() over (partition by c.session_id, c.result_status = 'classified' order by c.best_lap_s)
      else
        rank() over (partition by c.session_id, c.result_status = 'classified' order by c.laps desc, c.total_s)
      end
    end as position
  from classified c
)
select
  r.event_id, r.stage_id, r.session_id, r.class_id, r.kind, r.number, r.group_label,
  r.entry_id, r.rider_id, r.race_number,
  r.laps, r.best_lap_s, r.total_s, r.penalty_s, r.result_status, r.position,
  case when r.kind = 'heat' then coalesce(ps.points[r.position], 0) else 0 end as points
from ranked r
left join public.points_scales ps on ps.code = r.points_scale;
