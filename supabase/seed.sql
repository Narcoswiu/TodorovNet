-- LOCAL DEMO DATA ONLY. Applied by `supabase db reset`; never pushed to production.
-- Reference data (classes, points, penalties) lives in migrations, not here.
--
-- Demo logins, password "demo-todorovnet":
--   admin@demo.local  super admin and organizer
--   timer@demo.local  timekeeper
--   gps@demo.local    GPS judge
--   jury@demo.local   jury and jury chair

do $$
declare
  v_pw text := extensions.crypt('demo-todorovnet', extensions.gen_salt('bf'));
  u    record;
begin
  for u in
    select * from (values
      ('10000000-0000-0000-0000-000000000001'::uuid, 'admin@demo.local', 'Демо Администратор'),
      ('10000000-0000-0000-0000-000000000002'::uuid, 'timer@demo.local', 'Демо Хронометрист'),
      ('10000000-0000-0000-0000-000000000003'::uuid, 'gps@demo.local',   'Демо GPS съдия'),
      ('10000000-0000-0000-0000-000000000004'::uuid, 'jury@demo.local',  'Демо Жури')
    ) as t (id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, v_pw, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    );
  end loop;
end;
$$;

update public.profiles set is_super_admin = true where id = '10000000-0000-0000-0000-000000000001';

-- Act as the demo admin so the authorization guards (penalty review, start list) accept the seed.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
declare
  v_season  bigint := (select id from public.seasons where year = 2026);
  v_event   bigint;
  v_nav     bigint;
  v_ex      bigint;
  v_clubs   bigint[];
  v_timer   uuid := '10000000-0000-0000-0000-000000000002';
  v_gps     uuid := '10000000-0000-0000-0000-000000000003';
  v_first   timestamptz := date_trunc('minute', now()) - interval '4 hours';
  v_num     int := 0;
  v_rider   bigint;
  v_at      timestamptz;
  cls       record;
  s         record;
  male_first   text[] := array['Иван','Георги','Димитър','Николай','Петър','Стоян','Христо','Васил','Александър','Мартин','Тодор','Калоян','Борислав','Емил','Радослав'];
  male_last    text[] := array['Иванов','Георгиев','Димитров','Николов','Петров','Стоянов','Христов','Василев','Александров','Маринов','Тодоров','Колев','Божинов','Енчев','Радев'];
  female_first text[] := array['Мария','Елена','Десислава','Никол','Петя','Гергана','Ивана','Виктория'];
  female_last  text[] := array['Иванова','Георгиева','Димитрова','Николова','Петрова','Стоянова','Христова','Колева'];
begin
  insert into public.clubs (name) values ('Демо МК Габрово'), ('Демо МК Враца'), ('Демо МК Банско'), ('Демо МК Кирково');
  select array_agg(id order by id) into v_clubs from public.clubs where name like 'Демо%';

  insert into public.events (season_id, kind, round_number, name, location, date_from, date_to, status)
  values (v_season, 'championship_round', 10, 'Демо Хард Ендуро', 'Кирково', current_date, current_date + 1, 'live')
  returning id into v_event;

  insert into public.event_staff (event_id, user_id, role) values
    (v_event, '10000000-0000-0000-0000-000000000001', 'organizer'),
    (v_event, v_timer, 'timekeeper'),
    (v_event, v_gps,   'gps_judge'),
    (v_event, '10000000-0000-0000-0000-000000000004', 'jury'),
    (v_event, '10000000-0000-0000-0000-000000000004', 'jury_chair');

  insert into public.event_classes (event_id, class_id, start_order)
  select v_event, c.id, c.sort_order
  from public.classes c
  where c.season_id = v_season and c.code in ('pro', 'exp', 'std', 's40', 'wom');

  -- Day 1: navigation. Pro 1 rider per 30 s, other classes 2 per 30 s with a 3-minute gap.
  insert into public.stages (event_id, day_number, sort_order, type, name, points_scale,
                             first_start_at, start_interval_seconds, riders_per_slot, course_closes_at)
  values (v_event, 1, 1, 'navigation', 'Ден 1 · Навигация', 'bgx_navigation_day1',
          v_first, 30, 2, v_first + interval '7 hours')
  returning id into v_nav;

  insert into public.stage_classes (stage_id, event_id, class_id, start_order, riders_per_slot, gap_before_seconds, distance_km)
  select v_nav, v_event, ec.class_id, ec.start_order,
         case when c.code = 'pro' then 1 end,
         case when c.code = 'pro' then 0 else 180 end,
         case when c.code = 'wom' then 33 else 62 end
  from public.event_classes ec
  join public.classes c on c.id = ec.class_id
  where ec.event_id = v_event;

  insert into public.checkpoints (stage_id, event_id, code, name, sort_order) values
    (v_nav, v_event, 'CP1', 'Контрола 1', 1),
    (v_nav, v_event, 'CP2', 'Контрола 2 · зареждане', 2);

  for cls in
    select c.id, c.code, c.sort_order
    from public.classes c
    join public.event_classes ec on ec.class_id = c.id and ec.event_id = v_event
    order by c.sort_order
  loop
    for i in 1 .. 8 loop
      v_num := v_num + 1;
      if cls.code = 'wom' then
        insert into public.riders (first_name, last_name, club_id)
        values (female_first[1 + (v_num * 5) % 8], female_last[1 + (v_num * 3) % 8], v_clubs[1 + v_num % 4])
        returning id into v_rider;
      else
        insert into public.riders (first_name, last_name, club_id)
        values (male_first[1 + (v_num * 7) % 15], male_last[1 + (v_num * 11) % 15], v_clubs[1 + v_num % 4])
        returning id into v_rider;
      end if;
      insert into public.entries (event_id, rider_id, class_id, race_number)
      values (v_event, v_rider, cls.id, cls.sort_order * 100 + i);
    end loop;
  end loop;

  perform public.generate_start_list(v_nav);

  -- Simulated race in progress: control passings and finishes that are already in the past.
  for s in select * from public.start_slots where stage_id = v_nav order by position loop
    v_at := s.scheduled_start + interval '50 minutes' + make_interval(secs => (s.position * 23) % 600);
    if v_at <= now() then
      insert into public.passings (client_id, event_id, stage_id, entry_id, point, checkpoint_id, passed_at, recorded_by)
      values (gen_random_uuid(), v_event, v_nav, s.entry_id, 'checkpoint',
              (select id from public.checkpoints where stage_id = v_nav and code = 'CP1'), v_at, v_timer);
    end if;
    v_at := s.scheduled_start + interval '1 hour 50 minutes' + make_interval(secs => (s.position * 29) % 900);
    if v_at <= now() then
      insert into public.passings (client_id, event_id, stage_id, entry_id, point, checkpoint_id, passed_at, recorded_by)
      values (gen_random_uuid(), v_event, v_nav, s.entry_id, 'checkpoint',
              (select id from public.checkpoints where stage_id = v_nav and code = 'CP2'), v_at, v_timer);
    end if;
    v_at := s.scheduled_start + interval '3 hours 15 minutes' + make_interval(secs => (s.position * 37) % 1800);
    if v_at <= now() then
      insert into public.passings (client_id, event_id, stage_id, entry_id, point, passed_at, recorded_by)
      values (gen_random_uuid(), v_event, v_nav, s.entry_id, 'finish', v_at, v_timer);
    end if;
  end loop;

  -- One confirmed and one proposed GPS penalty.
  insert into public.penalties (event_id, stage_id, entry_id, penalty_type_id, note, created_by, status)
  select v_event, v_nav, e.id, pt.id, 'Отклонение 320 м при WP 14', v_gps, 'confirmed'
  from public.entries e, public.penalty_types pt
  where e.event_id = v_event and e.race_number = 102 and pt.event_id is null and pt.code = 'track_dev_100_500';

  insert into public.penalties (event_id, stage_id, entry_id, penalty_type_id, note, created_by)
  select v_event, v_nav, e.id, pt.id, 'Няма запис на CP2', v_gps
  from public.entries e, public.penalty_types pt
  where e.event_id = v_event and e.race_number = 205 and pt.event_id is null and pt.code = 'missed_control';

  -- Day 2: enduro-cross, heats not started yet.
  insert into public.stages (event_id, day_number, sort_order, type, name, points_scale)
  values (v_event, 2, 2, 'enduro_cross', 'Ден 2 · Ендурокрос', 'bgx_closed_course')
  returning id into v_ex;

  insert into public.stage_classes (stage_id, event_id, class_id, start_order)
  select v_ex, v_event, class_id, start_order from public.event_classes where event_id = v_event;

  insert into public.sessions (event_id, stage_id, class_id, kind, number, duration_minutes)
  select v_event, v_ex, ec.class_id, k.kind, k.number,
         case when k.kind = 'qualifying' then 20 when c.code = 'pro' then 10 when c.code in ('exp', 's40') then 8 else 7 end
  from public.event_classes ec
  join public.classes c on c.id = ec.class_id
  cross join (values ('qualifying'::public.session_kind, 1), ('heat', 1), ('heat', 2)) as k (kind, number)
  where ec.event_id = v_event;
end;
$$;

select set_config('request.jwt.claims', '', false);
