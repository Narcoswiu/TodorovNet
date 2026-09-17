-- Free events ranked by total time instead of BG-X points.
--   ranking = 'points'  round result is the sum of stage points (BG-X, Р XVIII)
--   ranking = 'time'    round result is the sum of navigation totals (elapsed + penalties + adjustments);
--                       only riders classified on every navigation stage get a position.

alter table public.events
  add column ranking text not null default 'points' check (ranking in ('points', 'time'));

create view public.round_time_results
with (security_invoker = true)
as
with nav_stages as (
  select st.event_id, count(*) as stage_count
  from public.stages st
  where st.type = 'navigation'
  group by st.event_id
),
per_entry as (
  select
    nr.event_id,
    nr.entry_id,
    count(*) filter (where nr.result_status = 'classified') as stages_classified,
    sum(nr.total_s) filter (where nr.result_status = 'classified') as total_s,
    sum(nr.penalty_s) as penalty_s,
    -- The worst status across stages explains why a rider has no position.
    (array_agg(nr.result_status order by array_position(array['dsq', 'dnf', 'dns', 'nc', 'on_course', 'classified'], nr.result_status)))[1]
      as worst_status
  from public.navigation_results nr
  group by nr.event_id, nr.entry_id
),
totals as (
  select
    e.event_id,
    e.id as entry_id,
    e.rider_id,
    e.class_id,
    e.race_number,
    p.total_s,
    coalesce(p.penalty_s, 0) as penalty_s,
    coalesce(p.stages_classified, 0) as stages_classified,
    coalesce(ns.stage_count, 0) as stage_count,
    case
      when ns.stage_count is null then 'dns'
      when coalesce(p.stages_classified, 0) = ns.stage_count then 'classified'
      else coalesce(p.worst_status, 'dns')
    end as result_status
  from public.entries e
  left join per_entry p on p.entry_id = e.id
  left join nav_stages ns on ns.event_id = e.event_id
  where not e.withdrawn
)
select
  t.*,
  case when t.result_status = 'classified' then
    rank() over (partition by t.event_id, t.class_id, t.result_status = 'classified' order by t.total_s)
  end as position,
  t.total_s - min(t.total_s) filter (where t.result_status = 'classified')
    over (partition by t.event_id, t.class_id) as gap_s
from totals t;

grant select on public.round_time_results to anon, authenticated;

-- Publishing the round final of a time-ranked event freezes the time classification.
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
