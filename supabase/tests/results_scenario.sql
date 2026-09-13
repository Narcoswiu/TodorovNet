-- Scenario test for the results views and access rules. Runs in one transaction and rolls back.
-- Run: docker exec -i supabase_db_todorovnet psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/results_scenario.sql

begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000001', 'admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'outsider@test.local', 'authenticated', 'authenticated');
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- A navigation-only round: riders finish in the given order, one minute apart.
create function pg_temp.nav_round(p_round int, p_riders bigint[])
returns bigint
language plpgsql
as $$
declare
  v_season bigint := (select id from public.seasons where year = 2026);
  v_pro    bigint := (select id from public.classes where season_id = v_season and code = 'pro');
  v_event  bigint;
  v_stage  bigint;
  v_entry  bigint;
  t0       timestamptz := '2026-10-01 09:00:00+03'::timestamptz + (p_round * interval '7 days');
begin
  insert into public.events (season_id, kind, round_number, name, date_from, date_to, status)
  values (v_season, 'championship_round', p_round, 'Round ' || p_round, t0::date, t0::date, 'finished')
  returning id into v_event;
  insert into public.event_classes (event_id, class_id) values (v_event, v_pro);
  insert into public.stages (event_id, day_number, type, name, points_scale, course_closes_at)
  values (v_event, 1, 'navigation', 'Nav', 'bgx_navigation_day1', t0 + interval '8 hours')
  returning id into v_stage;
  insert into public.stage_classes (stage_id, event_id, class_id) values (v_stage, v_event, v_pro);
  for i in 1 .. cardinality(p_riders) loop
    insert into public.entries (event_id, rider_id, class_id, race_number)
    values (v_event, p_riders[i], v_pro, 100 + i) returning id into v_entry;
    insert into public.start_slots values (v_stage, v_event, v_entry, i, t0);
    insert into public.passings (client_id, event_id, stage_id, entry_id, point, passed_at)
    values (gen_random_uuid(), v_event, v_stage, v_entry, 'finish', t0 + interval '4 hours' + i * interval '1 minute');
  end loop;
  return v_event;
end;
$$;

do $$
declare
  v_season bigint := (select id from public.seasons where year = 2026);
  v_pro    bigint := (select id from public.classes where season_id = v_season and code = 'pro');
  v_club   bigint;
  v_event  bigint;
  v_nav    bigint;
  v_ex     bigint;
  v_h1     bigint;
  v_h2     bigint;
  r1 bigint; r2 bigint; r3 bigint;
  e1 bigint; e2 bigint; e3 bigint;
  t0 timestamptz := '2026-09-26 09:30:00+03';
  t1 timestamptz := '2026-09-27 11:00:00+03';
  t2 timestamptz := '2026-09-27 13:00:00+03';
  got record;
  failed boolean;
begin
  insert into public.clubs (name) values ('Test MC') returning id into v_club;
  insert into public.riders (first_name, last_name, club_id) values ('Rider', 'One', v_club)   returning id into r1;
  insert into public.riders (first_name, last_name, club_id) values ('Rider', 'Two', v_club)   returning id into r2;
  insert into public.riders (first_name, last_name, club_id) values ('Rider', 'Three', v_club) returning id into r3;

  insert into public.events (season_id, kind, round_number, name, date_from, date_to, status)
  values (v_season, 'championship_round', 1, 'Round 1', '2026-09-26', '2026-09-27', 'live')
  returning id into v_event;
  insert into public.event_classes (event_id, class_id) values (v_event, v_pro);
  insert into public.entries (event_id, rider_id, class_id, race_number) values (v_event, r1, v_pro, 11) returning id into e1;
  insert into public.entries (event_id, rider_id, class_id, race_number) values (v_event, r2, v_pro, 22) returning id into e2;
  insert into public.entries (event_id, rider_id, class_id, race_number) values (v_event, r3, v_pro, 33) returning id into e3;

  -- ── Day 1: navigation ──
  insert into public.stages (event_id, day_number, type, name, points_scale, course_closes_at)
  values (v_event, 1, 'navigation', 'Навигация', 'bgx_navigation_day1', t0 + interval '7 hours 30 minutes')
  returning id into v_nav;
  insert into public.stage_classes (stage_id, event_id, class_id) values (v_nav, v_event, v_pro);
  insert into public.start_slots values
    (v_nav, v_event, e1, 1, t0),
    (v_nav, v_event, e2, 2, t0 + interval '30 seconds'),
    (v_nav, v_event, e3, 3, t0 + interval '60 seconds');

  insert into public.passings (client_id, event_id, stage_id, entry_id, point, passed_at) values
    (gen_random_uuid(), v_event, v_nav, e1, 'start',  t0 + interval '5 minutes'),              -- late start
    (gen_random_uuid(), v_event, v_nav, e1, 'finish', t0 + interval '4 hours'),
    (gen_random_uuid(), v_event, v_nav, e2, 'finish', t0 + interval '30 seconds' + interval '4 hours 20 minutes'),
    (gen_random_uuid(), v_event, v_nav, e3, 'finish', t0 + interval '7 hours 35 minutes');     -- after course close

  -- A second active finish for the same rider must be rejected.
  failed := false;
  begin
    insert into public.passings (client_id, event_id, stage_id, entry_id, point, passed_at)
    values (gen_random_uuid(), v_event, v_nav, e2, 'finish', t0 + interval '5 hours');
  exception when unique_violation then
    failed := true;
  end;
  assert failed, 'duplicate active finish must be rejected';

  -- Confirmed 2 h track penalty on rider 1; a merely proposed penalty on rider 2 must not count.
  insert into public.penalties (event_id, stage_id, entry_id, penalty_type_id, status)
  values (v_event, v_nav, e1, (select id from public.penalty_types where event_id is null and code = 'track_dev_500_1000'), 'confirmed');
  insert into public.penalties (event_id, stage_id, entry_id, penalty_type_id)
  values (v_event, v_nav, e2, (select id from public.penalty_types where event_id is null and code = 'missed_control'));

  select * into got from public.navigation_results where stage_id = v_nav and entry_id = e1;
  assert got.elapsed_s = 4 * 3600, 'elapsed runs from the scheduled start, got ' || got.elapsed_s;
  assert got.penalty_s = 7200, 'confirmed penalty counted, got ' || got.penalty_s;
  assert got.position = 2 and got.points = 22, 'rider 1 second with 22, got ' || got.position || '/' || got.points;

  select * into got from public.navigation_results where stage_id = v_nav and entry_id = e2;
  assert got.penalty_s = 0, 'proposed penalty ignored';
  assert got.position = 1 and got.points = 25, 'rider 2 wins navigation with 25';
  assert got.gap_s = 0, 'leader gap is zero';

  select * into got from public.navigation_results where stage_id = v_nav and entry_id = e3;
  assert got.result_status = 'nc' and got.position is null and got.points = 0, 'finish after course close is not classified';

  -- ── Day 2: enduro-cross ──
  insert into public.stages (event_id, day_number, type, name, points_scale)
  values (v_event, 2, 'enduro_cross', 'Ендурокрос', 'bgx_closed_course') returning id into v_ex;
  insert into public.stage_classes (stage_id, event_id, class_id) values (v_ex, v_event, v_pro);
  insert into public.sessions (event_id, stage_id, class_id, kind, number, duration_minutes, started_at)
  values (v_event, v_ex, v_pro, 'heat', 1, 10, t1) returning id into v_h1;
  insert into public.sessions (event_id, stage_id, class_id, kind, number, duration_minutes, started_at)
  values (v_event, v_ex, v_pro, 'heat', 2, 10, t2) returning id into v_h2;

  -- Heat 1: e1 3 laps in 9:00, e2 3 laps in 9:30, e3 2 laps.
  insert into public.laps (client_id, event_id, session_id, entry_id, crossed_at) values
    (gen_random_uuid(), v_event, v_h1, e1, t1 + interval '3 minutes'),
    (gen_random_uuid(), v_event, v_h1, e1, t1 + interval '6 minutes'),
    (gen_random_uuid(), v_event, v_h1, e1, t1 + interval '9 minutes'),
    (gen_random_uuid(), v_event, v_h1, e2, t1 + interval '3 minutes 10 seconds'),
    (gen_random_uuid(), v_event, v_h1, e2, t1 + interval '6 minutes 20 seconds'),
    (gen_random_uuid(), v_event, v_h1, e2, t1 + interval '9 minutes 30 seconds'),
    (gen_random_uuid(), v_event, v_h1, e3, t1 + interval '5 minutes'),
    (gen_random_uuid(), v_event, v_h1, e3, t1 + interval '10 minutes');
  -- Heat 2: e2 3 laps in 9:00, e1 3 laps in 9:10, e3 never crosses.
  insert into public.laps (client_id, event_id, session_id, entry_id, crossed_at) values
    (gen_random_uuid(), v_event, v_h2, e2, t2 + interval '3 minutes'),
    (gen_random_uuid(), v_event, v_h2, e2, t2 + interval '6 minutes'),
    (gen_random_uuid(), v_event, v_h2, e2, t2 + interval '9 minutes'),
    (gen_random_uuid(), v_event, v_h2, e1, t2 + interval '3 minutes'),
    (gen_random_uuid(), v_event, v_h2, e1, t2 + interval '6 minutes'),
    (gen_random_uuid(), v_event, v_h2, e1, t2 + interval '9 minutes 10 seconds');

  select * into got from public.session_results where session_id = v_h1 and entry_id = e3;
  assert got.laps = 2 and got.position = 3 and got.points = 10, 'heat 1: two laps ranks behind three laps';
  select * into got from public.session_results where session_id = v_h1 and entry_id = e1;
  assert got.best_lap_s = 180 and got.points = 15, 'heat 1: e1 wins, best lap 3:00';
  select * into got from public.session_results where session_id = v_h2 and entry_id = e3;
  assert got.result_status = 'dns' and got.points = 0, 'heat 2: no crossings is DNS';

  -- Overall enduro-cross: e1 and e2 both 27 heat points, e2 has the better second heat.
  select * into got from public.enduro_cross_results where stage_id = v_ex and entry_id = e2;
  assert got.heat_points = 27 and got.position = 1 and got.points = 15, 'tie broken by second heat, e2 first';
  select * into got from public.enduro_cross_results where stage_id = v_ex and entry_id = e1;
  assert got.position = 2 and got.points = 12, 'e1 second overall';

  -- ── Round: 25+15=40, 22+12=34, 0+10=10 ──
  select * into got from public.round_results where event_id = v_event and entry_id = e2;
  assert got.total_points = 40 and got.position = 1, 'round: e2 40 points first, got ' || got.total_points;
  select * into got from public.round_results where event_id = v_event and entry_id = e1;
  assert got.total_points = 34 and got.position = 2, 'round: e1 34 points second';

  -- ── Season: rounds 2 and 3 ──
  perform pg_temp.nav_round(2, array[r1, r2]); -- r1 25, r2 22
  perform pg_temp.nav_round(3, array[r1]);     -- r1 25, r2 and r3 miss it
  -- r1: 34, 25, 25 -> drop 25 -> 59.  r2: 40, 22, missed -> missed round is the drop -> 62.  r3: 10 -> 10.
  select * into got from public.season_standings where season_id = v_season and rider_id = r1;
  assert got.rounds_held = 3 and got.net_points = 59 and got.position = 2, 'season r1 59 second, got ' || got.net_points;
  select * into got from public.season_standings where season_id = v_season and rider_id = r2;
  assert got.net_points = 62 and got.position = 1, 'season r2 62 first, got ' || got.net_points;
  select * into got from public.season_standings where season_id = v_season and rider_id = r3;
  assert got.net_points = 10, 'season r3 10';

  -- ── Correction: voiding e2's navigation finish makes rider 1 the winner ──
  update public.passings set voided_at = now(), void_reason = 'wrong rider'
  where stage_id = v_nav and entry_id = e2 and point = 'finish';
  select * into got from public.navigation_results where stage_id = v_nav and entry_id = e1;
  assert got.position = 1, 'voided finish removes e2 from the classification';
  assert (select count(*) from public.audit_log where table_name = 'passings' and action = 'update') = 1,
    'void is written to the audit log';

  raise notice 'results scenario: all assertions passed';
end;
$$;

-- ── Access rules ──
-- The public can read live results but never write, and never sees proposed penalties.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  failed boolean := false;
begin
  assert (select count(*) from public.penalties where status = 'proposed') = 0, 'anon must not see proposed penalties';
  assert (select count(*) from public.penalties where status = 'confirmed') = 1, 'anon sees confirmed penalties';
  assert (select count(*) from public.rider_private) = 0, 'anon must not see personal data';
  begin
    insert into public.clubs (name) values ('Hacker MC');
  exception when insufficient_privilege then
    failed := true;
  end;
  assert failed, 'anon cannot write';
  raise notice 'access rules (anon): all assertions passed';
end;
$$;

-- A signed-in user who is not staff of the event cannot record timing or confirm penalties.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare
  failed boolean := false;
  v_stage bigint;
  v_entry bigint;
  v_event bigint;
begin
  select st.event_id, st.id into v_event, v_stage from public.stages st where st.type = 'navigation' limit 1;
  select id into v_entry from public.entries where event_id = v_event limit 1;
  begin
    insert into public.passings (client_id, event_id, stage_id, entry_id, point, passed_at)
    values (gen_random_uuid(), v_event, v_stage, v_entry, 'start', now());
  exception when insufficient_privilege then
    failed := true;
  end;
  assert failed, 'non-staff cannot record timing';

  failed := false;
  begin
    update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-000000000002';
  exception when insufficient_privilege then
    failed := true;
  end;
  assert failed, 'a user cannot make themselves super admin';
  raise notice 'access rules (outsider): all assertions passed';
end;
$$;

rollback;
