-- Results rules after the September 2026 audit, checked against the BG-X rulebook and published sheets.

-- ── Season: the worst round is dropped only in the final standings (Р XVIII.3) ──────────────────────
-- Interim standings during the season are a plain sum (verified on the 2026 interim sheets). The super
-- admin marks a season final once its last round is done; only then is the worst round dropped.
alter table public.seasons add column is_final boolean not null default false;

-- Ties (Р XVIII.2): more Day 1 navigation points, then more Day 2 points, then better Day 1 placings,
-- then better Day 2 placings.
drop view public.season_standings;
create view public.season_standings
with (security_invoker = true)
as
with held as (
  select ev.season_id, count(*) as rounds_held
  from public.events ev
  where ev.kind = 'championship_round' and ev.status in ('live', 'finished')
  group by ev.season_id
),
day_places as (
  select ev.season_id, rr.rider_id, rr.class_id,
         count(*) filter (where nr.day_number = 1 and nr.position = 1) as d1_first,
         count(*) filter (where nr.day_number = 1 and nr.position = 2) as d1_second,
         count(*) filter (where nr.day_number = 1 and nr.position = 3) as d1_third,
         count(*) filter (where nr.day_number = 2 and nr.position = 1) +
           count(*) filter (where ex.position = 1) as d2_first,
         count(*) filter (where nr.day_number = 2 and nr.position = 2) +
           count(*) filter (where ex.position = 2) as d2_second
  from public.round_results rr
  join public.events ev on ev.id = rr.event_id
  left join public.navigation_results nr on nr.entry_id = rr.entry_id
  left join public.enduro_cross_results ex on ex.entry_id = rr.entry_id and nr.entry_id is null
  where ev.kind = 'championship_round' and ev.status in ('live', 'finished')
  group by ev.season_id, rr.rider_id, rr.class_id
),
per_rider as (
  select
    ev.season_id, rr.rider_id, rr.class_id,
    count(*) as rounds_ridden,
    sum(rr.total_points) as gross_points,
    sum(rr.day1_points) as day1_points,
    sum(rr.day2_points) as day2_points,
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
    s.is_final,
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
  rank() over (partition by n.season_id, n.class_id
               order by n.net_points desc, n.day1_points desc, n.day2_points desc,
                        dp.d1_first desc, dp.d1_second desc, dp.d1_third desc, dp.d2_first desc, dp.d2_second desc) as position,
  rank() over (partition by n.season_id, n.class_id
               order by n.gross_points desc, n.day1_points desc, n.day2_points desc,
                        dp.d1_first desc, dp.d1_second desc, dp.d1_third desc, dp.d2_first desc, dp.d2_second desc) as position_gross,
  n.is_final as drop_applies
from net n
left join day_places dp on dp.season_id = n.season_id and dp.rider_id = n.rider_id and dp.class_id = n.class_id;

-- ── Teams (rulebook p.16–17, verified on the Gabrovo 2026 and 2025 final sheets) ──────────────────────
-- Per round each club adds up the round points of its best rider in Pro, Expert and Standard. Clubs that
-- scored in more classes rank first, then by that total; ties go to the Pro score, then the best single
-- score. The club's rank then earns team points on the 30-25-22… scale. A rider who changed club during the
-- season scores for the club of his first round of that season.
drop view public.team_season_standings;
drop view public.team_round_results;

create view public.team_round_results
with (security_invoker = true)
as
with season_club as (
  select distinct on (ev.season_id, en.rider_id)
         ev.season_id, en.rider_id, en.club_id
  from public.entries en
  join public.events ev on ev.id = en.event_id
  where ev.kind = 'championship_round' and not en.withdrawn and en.club_id is not null
  order by ev.season_id, en.rider_id, ev.date_from, en.id
),
best as (
  select rr.event_id, en.club_id, c.code as class_code, max(rr.total_points) as best_points
  from public.round_results rr
  join public.entries en on en.id = rr.entry_id
  join public.events ev on ev.id = rr.event_id
  join public.classes c on c.id = rr.class_id
  join public.clubs cl on cl.id = en.club_id
  left join season_club sc on sc.season_id = ev.season_id and sc.rider_id = en.rider_id
  where c.team_scoring and cl.bfm_licensed and rr.total_points > 0
    and (sc.club_id is null or sc.club_id = en.club_id)
  group by rr.event_id, en.club_id, c.code
),
per_club as (
  select
    b.event_id, b.club_id,
    count(*) as classes_scored,
    sum(b.best_points) as club_points,
    coalesce(max(b.best_points) filter (where b.class_code = 'pro'), 0) as pro_points,
    max(b.best_points) as top_points
  from best b
  group by b.event_id, b.club_id
),
ranked as (
  select p.*,
         rank() over (partition by p.event_id
                      order by p.classes_scored desc, p.club_points desc, p.pro_points desc, p.top_points desc) as position
  from per_club p
)
select
  r.event_id, r.club_id, r.classes_scored, r.club_points,
  coalesce(ps.points[r.position], 0) as team_points,
  r.position
from ranked r
left join public.points_scales ps on ps.code = 'bgx_team';

-- Team season: plain sum, no dropped round. Ties: more 1st places, then more 2nd places, then more 3rd
-- places, then the better place in the latest round.
create view public.team_season_standings
with (security_invoker = true)
as
with rounds as (
  select ev.season_id, t.*, ev.date_from,
         row_number() over (partition by ev.season_id, t.club_id order by ev.date_from desc) as recency
  from public.team_round_results t
  join public.events ev on ev.id = t.event_id
  where ev.kind = 'championship_round' and ev.status in ('live', 'finished')
),
per_club as (
  select season_id, club_id,
         count(*) as rounds_scored,
         sum(team_points) as team_points,
         count(*) filter (where position = 1) as firsts,
         count(*) filter (where position = 2) as seconds,
         count(*) filter (where position = 3) as thirds,
         min(position) filter (where recency = 1) as last_position
  from rounds
  group by season_id, club_id
)
select
  season_id, club_id, rounds_scored, team_points,
  rank() over (partition by season_id
               order by team_points desc, firsts desc, seconds desc, thirds desc, last_position asc nulls last) as position
from per_club;

grant select on public.season_standings, public.team_round_results, public.team_season_standings to anon, authenticated;

-- ── Enduro-cross: statuses set for the whole day count in every heat ─────────────────────────────────
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
      -- A status set for one heat wins; a status set for the whole enduro-cross day applies to every heat.
      else (select rs.status::text from public.rider_statuses rs
             where rs.entry_id = a.entry_id
               and (rs.session_id = a.session_id or (rs.session_id is null and rs.stage_id = a.stage_id))
             order by rs.session_id nulls last
             limit 1)
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

-- ── Eligibility: the next-round ban ─────────────────────────────────────────────────────────────────
create or replace view public.entry_eligibility
with (security_invoker = true)
as
select
  e.id as entry_id,
  e.event_id,
  e.race_number,
  c.code as class_code,
  array_remove(array[
    case when rp.birth_date is null then 'no_birth_date' end,
    case when rp.birth_date is not null and c.min_age is not null
              and age(ev.date_from, rp.birth_date) < make_interval(years => c.min_age)
         then 'too_young' end,
    case when rp.birth_date is not null and c.max_age is not null
              and extract(year from ev.date_from) - extract(year from rp.birth_date) > c.max_age
         then 'too_old' end,
    case when ri.country = 'BG' and rp.license_type is null then 'no_licence' end,
    case when rp.license_valid_until is not null and rp.license_valid_until < ev.date_to then 'licence_expired' end,
    case when rp.license_type is not null and not (
           rp.license_type in ('one_event', 'foreign')
           or (rp.license_type = 'promo'    and c.code in ('mjun', 'jun', 'jst', 'wom', 'adv'))
           or (rp.license_type = 'enduro_a' and c.code in ('pro', 'exp'))
           or (rp.license_type = 'enduro_b' and c.code in ('std', 's40', 's50'))
         ) then 'licence_class' end,
    case when ri.country = 'BG' and e.club_id is null then 'no_club' end,
    case when ev.season_id is not null
              and exists (select 1 from public.season_numbers sn where sn.season_id = ev.season_id)
              and not exists (
                select 1 from public.season_numbers sn
                where sn.season_id = ev.season_id and sn.race_number = e.race_number and sn.rider_id = e.rider_id)
         then 'number_not_registered' end,
    -- Р XIX.21: a disqualification "for this and the next round" bars the rider from the following round.
    case when ev.season_id is not null and ev.round_number is not null and exists (
           select 1
           from public.penalties pn
           join public.entries pe on pe.id = pn.entry_id
           join public.events pev on pev.id = pn.event_id
           where pe.rider_id = e.rider_id
             and pn.status = 'confirmed'
             and pn.dsq_scope = 'event_and_next_round'
             and pev.season_id = ev.season_id
             and pev.round_number = ev.round_number - 1)
         then 'banned_next_round' end
  ], null) as issues
from public.entries e
join public.events ev on ev.id = e.event_id
join public.classes c on c.id = e.class_id
join public.riders ri on ri.id = e.rider_id
left join public.rider_private rp on rp.rider_id = e.rider_id
where not e.withdrawn
  and public.has_event_role(e.event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]);
