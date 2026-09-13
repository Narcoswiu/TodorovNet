-- Derived results. Nothing here is stored: every classification is recomputed from the raw facts,
-- so a voided passing, a confirmed penalty or a status change is reflected everywhere at once.
-- All views run with the caller's rights (security_invoker), so RLS still decides what a viewer sees:
-- the public only ever counts confirmed penalties.
--
-- Rules: docs/bgx-rules.md. Р XII.3 (time from scheduled start), Р XIX.5 (course close), Р XVI (enduro-cross),
-- Р XVIII (points, round and season classification).

-- ─────────────────────────────────────────────────────────────
-- Navigation day
-- ─────────────────────────────────────────────────────────────
create view public.navigation_results
with (security_invoker = true)
as
with base as (
  select
    st.event_id,
    st.id          as stage_id,
    st.day_number,
    st.points_scale,
    e.id           as entry_id,
    e.rider_id,
    e.class_id,
    e.race_number,
    coalesce(sc.course_closes_at, st.course_closes_at) as closes_at,
    ss.scheduled_start
  from public.stages st
  join public.stage_classes sc on sc.stage_id = st.id
  join public.entries e
    on e.event_id = st.event_id and e.class_id = sc.class_id and not e.withdrawn
  left join public.start_slots ss on ss.stage_id = st.id and ss.entry_id = e.id
  where st.type = 'navigation'
),
facts as (
  select
    b.*,
    (select p.passed_at from public.passings p
      where p.stage_id = b.stage_id and p.entry_id = b.entry_id
        and p.point = 'start' and p.voided_at is null) as actual_start,
    (select p.passed_at from public.passings p
      where p.stage_id = b.stage_id and p.entry_id = b.entry_id
        and p.point = 'finish' and p.voided_at is null) as finish_at,
    coalesce((select sum(ta.seconds) from public.time_adjustments ta
      where ta.stage_id = b.stage_id
        and (ta.entry_id = b.entry_id or ta.class_id = b.class_id)), 0) as adjustment_s,
    coalesce((select sum(pn.seconds) from public.penalties pn
      where pn.stage_id = b.stage_id and pn.entry_id = b.entry_id
        and pn.status = 'confirmed' and pn.seconds is not null), 0) as penalty_s,
    exists (select 1 from public.penalties pn
      where pn.entry_id = b.entry_id and pn.status = 'confirmed'
        and (pn.dsq_scope in ('event', 'event_and_next_round')
             or (pn.stage_id = b.stage_id and pn.dsq_scope = 'stage'))) as has_dsq,
    exists (select 1 from public.penalties pn
      join public.penalty_types pt on pt.id = pn.penalty_type_id
      where pn.stage_id = b.stage_id and pn.entry_id = b.entry_id
        and pn.status = 'confirmed' and pt.kind = 'dnf') as has_dnf_penalty,
    exists (select 1 from public.penalties pn
      join public.penalty_types pt on pt.id = pn.penalty_type_id
      where pn.stage_id = b.stage_id and pn.entry_id = b.entry_id
        and pn.status = 'confirmed' and pt.kind = 'no_start') as has_no_start_penalty,
    (select rs.status from public.rider_statuses rs
      where rs.stage_id = b.stage_id and rs.session_id is null
        and rs.entry_id = b.entry_id) as manual_status
  from base b
),
timed as (
  select
    f.*,
    extract(epoch from f.finish_at - coalesce(f.scheduled_start, f.actual_start)) as elapsed_s,
    case
      when f.manual_status = 'dsq' or f.has_dsq                 then 'dsq'
      when f.manual_status = 'dns' or f.has_no_start_penalty    then 'dns'
      when f.manual_status = 'dnf' or f.has_dnf_penalty         then 'dnf'
      when f.manual_status = 'nc'                               then 'nc'
      when f.finish_at is null and f.closes_at is not null
           and now() > f.closes_at                              then 'dnf'
      when f.finish_at is null                                  then 'on_course'
      when coalesce(f.scheduled_start, f.actual_start) is null  then 'nc'
      when f.closes_at is not null and f.finish_at > f.closes_at then 'nc'
      else 'classified'
    end as result_status
  from facts f
),
ranked as (
  select
    t.*,
    t.elapsed_s + t.adjustment_s + t.penalty_s as total_s,
    case when t.result_status = 'classified' then
      rank() over (
        partition by t.stage_id, t.class_id, t.result_status = 'classified'
        order by t.elapsed_s + t.adjustment_s + t.penalty_s
      )
    end as position
  from timed t
)
select
  r.event_id,
  r.stage_id,
  r.day_number,
  r.class_id,
  r.entry_id,
  r.rider_id,
  r.race_number,
  r.scheduled_start,
  r.actual_start,
  r.finish_at,
  r.closes_at,
  r.elapsed_s,
  r.adjustment_s,
  r.penalty_s,
  r.total_s,
  r.result_status,
  r.position,
  r.total_s - min(r.total_s) filter (where r.result_status = 'classified')
    over (partition by r.stage_id, r.class_id) as gap_s,
  coalesce(ps.points[r.position], 0) as points
from ranked r
left join public.points_scales ps on ps.code = r.points_scale;

-- Live splits at controls, measured from the scheduled start.
create view public.navigation_splits
with (security_invoker = true)
as
select
  p.event_id,
  p.stage_id,
  p.entry_id,
  e.class_id,
  e.race_number,
  cp.id        as checkpoint_id,
  cp.code      as checkpoint_code,
  cp.sort_order,
  p.passed_at,
  extract(epoch from p.passed_at - ss.scheduled_start) as split_s,
  rank() over (partition by p.stage_id, cp.id, e.class_id order by p.passed_at - ss.scheduled_start) as split_position
from public.passings p
join public.checkpoints cp on cp.id = p.checkpoint_id
join public.entries e on e.id = p.entry_id
left join public.start_slots ss on ss.stage_id = p.stage_id and ss.entry_id = p.entry_id
where p.point = 'checkpoint' and p.voided_at is null;

-- ─────────────────────────────────────────────────────────────
-- Enduro-cross sessions
-- ─────────────────────────────────────────────────────────────
-- Qualifying: rolling start, the first crossing opens the first timed lap, ranked on best lap.
-- Heat: gate start at started_at, "most laps in least time", at least one timed lap to be classified.
create view public.session_results
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
  where l.voided_at is null
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

-- Enduro-cross overall for a stage: heat points summed, ties go to the better second heat. Р XVI.3
create view public.enduro_cross_results
with (security_invoker = true)
as
with heats as (
  select
    sr.event_id, sr.stage_id, sr.class_id, sr.entry_id, sr.rider_id, sr.race_number,
    sum(sr.points) as heat_points,
    coalesce(max(sr.points) filter (where sr.number = 2), 0) as heat2_points,
    bool_or(sr.result_status = 'classified') as any_classified
  from public.session_results sr
  where sr.kind = 'heat'
  group by sr.event_id, sr.stage_id, sr.class_id, sr.entry_id, sr.rider_id, sr.race_number
),
ranked as (
  select
    h.*,
    case when h.any_classified then
      rank() over (partition by h.stage_id, h.class_id, h.any_classified
                   order by h.heat_points desc, h.heat2_points desc)
    end as position
  from heats h
)
select
  r.event_id, r.stage_id, r.class_id, r.entry_id, r.rider_id, r.race_number,
  r.heat_points, r.heat2_points, r.position,
  coalesce(ps.points[r.position], 0) as points
from ranked r
join public.stages st on st.id = r.stage_id
left join public.points_scales ps on ps.code = st.points_scale;

-- ─────────────────────────────────────────────────────────────
-- Round classification
-- ─────────────────────────────────────────────────────────────
-- Sum of stage points. Ties: more navigation points, then more day-1 points. Р XVIII.1
create view public.round_results
with (security_invoker = true)
as
with stage_points as (
  select nr.event_id, nr.entry_id, nr.day_number, 'navigation'::public.stage_type as type, nr.points
  from public.navigation_results nr
  join public.stages st on st.id = nr.stage_id
  where st.points_scale is not null
  union all
  select ex.event_id, ex.entry_id, st.day_number, 'enduro_cross'::public.stage_type, ex.points
  from public.enduro_cross_results ex
  join public.stages st on st.id = ex.stage_id
  where st.points_scale is not null
),
totals as (
  select
    e.event_id, e.id as entry_id, e.rider_id, e.class_id, e.race_number,
    coalesce(sum(sp.points), 0) as total_points,
    coalesce(sum(sp.points) filter (where sp.type = 'navigation'), 0) as navigation_points,
    coalesce(sum(sp.points) filter (where sp.day_number = 1), 0) as day1_points,
    coalesce(sum(sp.points) filter (where sp.day_number = 2), 0) as day2_points
  from public.entries e
  left join stage_points sp on sp.entry_id = e.id
  where not e.withdrawn
  group by e.event_id, e.id, e.rider_id, e.class_id, e.race_number
)
select
  t.*,
  rank() over (partition by t.event_id, t.class_id
               order by t.total_points desc, t.navigation_points desc, t.day1_points desc) as position
from totals t;

-- ─────────────────────────────────────────────────────────────
-- Season standings
-- ─────────────────────────────────────────────────────────────
-- Sum of rounds minus the worst N; a missed round counts as the worst result. Р XVIII.3
create view public.season_standings
with (security_invoker = true)
as
with held as (
  select ev.season_id, count(*) as rounds_held
  from public.events ev
  where ev.kind = 'championship_round' and ev.status in ('live', 'finished')
  group by ev.season_id
),
per_rider as (
  select
    ev.season_id, rr.rider_id, rr.class_id,
    count(*) as rounds_ridden,
    sum(rr.total_points) as gross_points,
    array_agg(rr.total_points order by rr.total_points) as points_low_to_high
  from public.round_results rr
  join public.events ev on ev.id = rr.event_id
  where ev.kind = 'championship_round' and ev.status in ('live', 'finished')
  group by ev.season_id, rr.rider_id, rr.class_id
),
net as (
  select
    p.*,
    h.rounds_held,
    p.gross_points - coalesce((
      select sum(x)
      from unnest(p.points_low_to_high[1 : greatest(s.drop_worst_rounds - (h.rounds_held - p.rounds_ridden), 0)]) as x
    ), 0) as net_points
  from per_rider p
  join held h on h.season_id = p.season_id
  join public.seasons s on s.id = p.season_id
)
select
  n.season_id, n.rider_id, n.class_id, n.rounds_held, n.rounds_ridden,
  n.gross_points, n.net_points,
  rank() over (partition by n.season_id, n.class_id order by n.net_points desc) as position
from net n;

grant select on
  public.navigation_results, public.navigation_splits, public.session_results,
  public.enduro_cross_results, public.round_results, public.season_standings
to anon, authenticated;
