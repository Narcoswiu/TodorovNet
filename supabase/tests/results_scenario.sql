-- Scenario test for the results views and access rules. Runs in one transaction and rolls back.
-- Run: docker exec -i supabase_db_todorovnet psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/results_scenario.sql

begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000001', 'admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'outsider@test.local', 'authenticated', 'authenticated');
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Isolate from local demo data: the season maths must only see this scenario's rounds. Rolled back at the end.
delete from public.events;

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
  -- The club may already exist from a browser-test import in the same local database.
  insert into public.clubs (name) values ('Scenario MC')
  on conflict (name) do update set name = excluded.name
  returning id into v_club;
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
    (gen_random_uuid(), v_event, v_nav, e2, 'start',  t0 + interval '20 seconds'),             -- sent off 10 s early
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
  assert got.elapsed_s = 4 * 3600 + 20 * 60 + 10, 'early start is timed from the actual start, got ' || got.elapsed_s;
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
  assert got.gross_points = 10, 'interim (gross) sum kept alongside the net total';

  -- ── Teams: one club, best Pro rider each round is 1st -> 30 team points per round ──
  select * into got from public.team_round_results where event_id = v_event and club_id = v_club;
  assert got.classes_scored = 1 and got.team_points = 30 and got.position = 1, 'team round: best Pro rider scores 30';
  select * into got from public.team_season_standings where season_id = v_season and club_id = v_club;
  assert got.team_points = 90 and got.rounds_scored = 3, 'team season: plain sum 90, got ' || got.team_points;

  -- ── Publication: numbered versions with a frozen copy of the classification ──
  declare
    v_pub bigint;
  begin
    v_pub := public.publish_results(v_event, v_nav, 'provisional', 120, 'след GPS проверка');
    assert (select version from public.publications where id = v_pub) = 1, 'first publication is version 1';
    assert (select snapshot ->> 'kind' from public.publications where id = v_pub) = 'navigation', 'navigation snapshot';
    assert (select jsonb_array_length(snapshot -> 'rows') from public.publications where id = v_pub)
         = (select count(*) from public.navigation_results where stage_id = v_nav), 'snapshot holds every rider';
    assert (select snapshot -> 'rows' -> 0 ->> 'last_name' from public.publications where id = v_pub) is not null, 'snapshot carries names';
    assert (select protest_deadline_at between now() + interval '119 minutes' and now() + interval '121 minutes'
            from public.publications where id = v_pub), 'protest window of 2 h (navigation)';

    v_pub := public.publish_results(v_event, v_nav, 'official');
    assert (select version from public.publications where id = v_pub) = 2, 'second publication of the stage is version 2';

    v_pub := public.publish_results(v_event, null, 'provisional', 30);
    assert (select version || '/' || (snapshot ->> 'kind') from public.publications where id = v_pub) = '1/round',
      'round final is versioned separately';

    v_pub := public.publish_results(v_event, v_ex, 'provisional', 30);
    assert (select jsonb_array_length(snapshot -> 'sessions') > 0 from public.publications where id = v_pub), 'enduro-cross snapshot has heats';
  end;

  -- ── Neutralised time: 10 minutes of first aid deducted from rider 1 ──
  insert into public.time_adjustments (event_id, stage_id, entry_id, seconds, reason)
  values (v_event, v_nav, e1, -600, 'first aid');
  select * into got from public.navigation_results where stage_id = v_nav and entry_id = e1;
  assert got.adjustment_s = -600 and got.total_s = 4 * 3600 + 7200 - 600, 'adjustment deducted, got ' || got.total_s;
  -- A class-wide rest applies to every rider of the class.
  insert into public.time_adjustments (event_id, stage_id, class_id, seconds, reason)
  values (v_event, v_nav, v_pro, -900, 'fixed rest');
  select * into got from public.navigation_results where stage_id = v_nav and entry_id = e2;
  assert got.adjustment_s = -900, 'class adjustment applies to e2, got ' || got.adjustment_s;
  delete from public.time_adjustments where stage_id = v_nav;

  -- ── Correction: voiding e2's navigation finish makes rider 1 the winner ──
  update public.passings set voided_at = now(), void_reason = 'wrong rider'
  where stage_id = v_nav and entry_id = e2 and point = 'finish';
  select * into got from public.navigation_results where stage_id = v_nav and entry_id = e1;
  assert got.position = 1, 'voided finish removes e2 from the classification';
  assert exists (
    select 1 from public.audit_log a
    where a.table_name = 'passings' and a.action = 'update'
      and a.row_id = (select p.id::text from public.passings p where p.stage_id = v_nav and p.entry_id = e2 and p.point = 'finish')
      and a.new_row ->> 'void_reason' = 'wrong rider'
  ), 'void is written to the audit log';

  -- ── Start-list generator: Pro 1 per 30 s, Expert 2 per 30 s after a 2-minute gap ──
  declare
    v_sl_event bigint;
    v_sl_stage bigint;
    v_exp      bigint := (select id from public.classes where season_id = v_season and code = 'exp');
    v_start    timestamptz := '2026-11-01 10:00:00+02';
    v_rider    bigint;
    slots      text;
  begin
    insert into public.events (name, date_from, date_to, status) values ('Start list test', '2026-11-01', '2026-11-01', 'upcoming')
    returning id into v_sl_event;
    insert into public.event_classes (event_id, class_id, start_order) values (v_sl_event, v_pro, 1), (v_sl_event, v_exp, 2);
    for i in 1 .. 5 loop
      insert into public.riders (first_name, last_name) values ('Start', 'Rider' || i) returning id into v_rider;
      insert into public.entries (event_id, rider_id, class_id, race_number)
      values (v_sl_event, v_rider, case when i <= 2 then v_pro else v_exp end, 10 + i);
    end loop;
    insert into public.stages (event_id, day_number, type, name, first_start_at, start_interval_seconds, riders_per_slot)
    values (v_sl_event, 1, 'navigation', 'Nav', v_start, 30, 2) returning id into v_sl_stage;
    insert into public.stage_classes (stage_id, event_id, class_id, start_order, riders_per_slot, gap_before_seconds) values
      (v_sl_stage, v_sl_event, v_pro, 1, 1, 0),
      (v_sl_stage, v_sl_event, v_exp, 2, null, 120);

    assert public.generate_start_list(v_sl_stage) = 5, 'start list places all five riders';
    select string_agg(e.race_number || '@' || to_char(ss.scheduled_start at time zone 'Europe/Sofia', 'HH24:MI:SS'), ' ' order by ss.position)
      into slots
    from public.start_slots ss join public.entries e on e.id = ss.entry_id
    where ss.stage_id = v_sl_stage;
    assert slots = '11@10:00:00 12@10:00:30 13@10:03:00 14@10:03:00 15@10:03:30', 'start slots, got ' || slots;
  end;

  -- ── Entry import: new riders, a missing club, bad rows reported, same number updates ──
  declare
    v_imp_event bigint;
    v_report    jsonb;
    failed      boolean := false;
  begin
    insert into public.events (name, date_from, date_to, status) values ('Import test', '2026-11-02', '2026-11-02', 'upcoming')
    returning id into v_imp_event;
    insert into public.event_classes (event_id, class_id) values (v_imp_event, v_pro);

    v_report := public.import_entries(v_imp_event, '[
      {"race_number": "7", "first_name": "Иван",   "last_name": "Импортов", "class": "Pro", "club": "Нов МК", "birth_date": "1990-05-01", "phone": "0888"},
      {"race_number": "8", "first_name": "Петър",  "last_name": "Импортов", "class": "про"},
      {"race_number": "9", "first_name": "Грешен", "last_name": "Клас",     "class": "Мотокрос"},
      {"race_number": "x", "first_name": "Без",    "last_name": "Номер",    "class": "Про"}
    ]'::jsonb);
    assert (v_report ->> 'added')::int = 2, 'import adds two rows, got ' || v_report;
    assert jsonb_array_length(v_report -> 'errors') = 2, 'import reports the two bad rows, got ' || v_report;
    assert (select count(*) from public.clubs where name = 'Нов МК') = 1, 'import creates a missing club';
    assert (select rp.phone from public.rider_private rp
            join public.entries e on e.rider_id = rp.rider_id
            where e.event_id = v_imp_event and e.race_number = 7) = '0888', 'import stores personal data';

    v_report := public.import_entries(v_imp_event,
      '[{"race_number": "8", "first_name": "Петър", "last_name": "Импортов-Нов", "class": "Про"}]'::jsonb);
    assert (v_report ->> 'updated')::int = 1, 'the same race number updates the entry, got ' || v_report;

    -- ── Staff assignment by email ──
    perform public.assign_staff(v_imp_event, 'OUTSIDER@test.local', 'timekeeper');
    assert (select count(*) from public.event_staff_members(v_imp_event) where email = 'outsider@test.local' and role = 'timekeeper') = 1,
      'assigned staff member is listed with email';
    begin
      perform public.assign_staff(v_imp_event, 'nobody@test.local', 'timekeeper');
    exception when no_data_found then
      failed := true;
    end;
    assert failed, 'unknown email is reported';
  end;

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
