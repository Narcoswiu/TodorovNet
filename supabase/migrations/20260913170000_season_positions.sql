-- Season standings: keep both classifications officials publish.
--   position_gross: interim standings, a plain sum of rounds (what is published during the season).
--   position:       the final rule, worst round dropped (Р XVIII.3); ties fall back to the plain sum.
-- Early in the season every rider's only round is "the worst", so the net total alone would rank
-- everyone equal; the interim position is what the public page shows until more rounds are held.

create or replace view public.season_standings
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
    s.drop_worst_rounds,
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
  rank() over (partition by n.season_id, n.class_id order by n.net_points desc, n.gross_points desc) as position,
  rank() over (partition by n.season_id, n.class_id order by n.gross_points desc) as position_gross,
  n.rounds_held > n.drop_worst_rounds as drop_applies
from net n;
