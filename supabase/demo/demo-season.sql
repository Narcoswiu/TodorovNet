-- TEST DATA: three fictional BG-X events with photos, riders, times, penalties, protests and published
-- results, so every page of the site has something to show.
--
-- Run it once in the Supabase SQL Editor (or with psql). It acts as the first super admin and adds that
-- account to each test event with every role, so the timing app and the admin panel work straight away.
-- Everything it creates is named "ТЕСТ", and riders belong to clubs named "Тест МК …".
-- Remove it all with supabase/demo/demo-season-remove.sql.
--
-- Photos: Unsplash (free to use under the Unsplash License), linked directly.

do $$
declare
  v_admin   uuid := (select p.id from public.profiles p where p.is_super_admin order by p.created_at limit 1);
  v_season  bigint := (select id from public.seasons where year = 2026);
  v_clubs   bigint[];
  v_riders  bigint[] := '{}';
  v_rider   bigint;
  v_events  bigint[] := '{}';
  v_event   bigint;
  v_nav     bigint;
  v_ex      bigint;
  v_day1    date;
  v_first   timestamptz;
  v_at      timestamptz;
  v_cp      bigint[];
  v_skill   numeric;
  v_n       int;
  v_laps    int;
  v_lap     numeric;
  cls       record;
  ev        record;
  s         record;
  e         record;
  sess      record;
  male_first   text[] := array['Александър','Борис','Веселин','Георги','Даниел','Емил','Живко','Иван','Калоян','Любомир',
                               'Мартин','Николай','Огнян','Петър','Радослав','Светослав','Тодор','Христо','Цветан','Явор',
                               'Атанас','Божидар','Валентин','Димитър','Ивайло','Кирил','Людмил','Марин','Пламен','Стефан',
                               'Теодор','Филип'];
  male_last    text[] := array['Ангелов','Балабанов','Василев','Гочев','Добрев','Енев','Желязков','Илиев','Караджов','Лазаров',
                               'Митев','Недялков','Орешков','Пеев','Рашков','Славов','Танев','Узунов','Филипов','Хаджиев',
                               'Цонев','Чакъров','Шопов','Янков','Атанасов','Бонев','Вълчев','Григоров','Динев','Жеков',
                               'Кръстев','Минчев'];
  female_first text[] := array['Ана','Виктория','Гергана','Десислава','Елица','Ивана','Мила','Теодора'];
  female_last  text[] := array['Ангелова','Василева','Добрева','Илиева','Митева','Пеева','Славова','Цонева'];
begin
  if v_admin is null then
    raise exception 'No super admin account found. Create one first.';
  end if;
  if exists (select 1 from public.events where name like 'ТЕСТ · %') then
    raise exception 'The test events already exist. Run demo-season-remove.sql first to start over.';
  end if;

  -- Act as the super admin, so the jury and publishing guards accept what follows.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  insert into public.clubs (name) values ('Тест МК Родопи'), ('Тест МК Балкан'), ('Тест МК Пирин'), ('Тест МК Черноморец'), ('Тест МК Витоша')
  on conflict (name) do nothing;
  select array_agg(id order by id) into v_clubs from public.clubs where name like 'Тест МК %';

  -- Riders: 8 per class in Pro, Expert, Standard, Senior 40+ and Women.
  for i in 1 .. 40 loop
    if i > 32 then
      insert into public.riders (first_name, last_name, club_id)
      values (female_first[i - 32], female_last[1 + (i * 3) % 8], v_clubs[1 + i % 5])
      returning id into v_rider;
    else
      insert into public.riders (first_name, last_name, club_id)
      values (male_first[i], male_last[1 + (i * 7) % 32], v_clubs[1 + i % 5])
      returning id into v_rider;
    end if;
    v_riders := v_riders || v_rider;
  end loop;

  -- Season race numbers: class hundreds, as on the start lists.
  insert into public.season_numbers (season_id, race_number, rider_id, class_id)
  select v_season, c.sort_order * 100 + ((r.i - 1) % 8) + 1, v_riders[r.i], c.id
  from generate_series(1, 40) as r (i)
  join public.classes c
    on c.season_id = v_season
   and c.code = (array['pro', 'exp', 'std', 's40', 'wom'])[1 + (r.i - 1) / 8]
  on conflict do nothing;

  for ev in
    select * from (values
      (1, 'ТЕСТ · Родопи Хард Ендуро',     'Смолян',  current_date - 6,  'finished',
          'https://images.unsplash.com/photo-1667373281235-4f52e3a5dce7?w=2000&q=80&auto=format&fit=crop'),
      (2, 'ТЕСТ · Стара планина Екстрем',   'Габрово', current_date,      'live',
          'https://images.unsplash.com/photo-1728376829311-33a039eb02b4?w=2000&q=80&auto=format&fit=crop'),
      (3, 'ТЕСТ · Пирин Ендуро Предизвикателство', 'Банско', current_date + 14, 'upcoming',
          'https://images.unsplash.com/photo-1667373818961-888a2d8ceb88?w=2000&q=80&auto=format&fit=crop')
    ) as t (round_number, name, location, day1, status, image_url)
  loop
    v_day1 := ev.day1;
    insert into public.events (season_id, kind, round_number, name, location, date_from, date_to, status, image_url)
    values (v_season, 'championship_round', ev.round_number, ev.name, ev.location, v_day1, v_day1 + 1,
            ev.status::public.event_status, ev.image_url)
    returning id into v_event;
    v_events := v_events || v_event;

    insert into public.event_staff (event_id, user_id, role)
    select v_event, v_admin, r from unnest(enum_range(null::public.staff_role)) as r;

    insert into public.event_classes (event_id, class_id, start_order)
    select v_event, c.id, c.sort_order
    from public.classes c
    where c.season_id = v_season and c.code in ('pro', 'exp', 'std', 's40', 'wom');

    insert into public.entries (event_id, rider_id, class_id, race_number)
    select v_event, sn.rider_id, sn.class_id, sn.race_number
    from public.season_numbers sn
    where sn.season_id = v_season and sn.rider_id = any (v_riders);

    -- Day 1: navigation, 09:00 local; the live event started four hours ago.
    v_first := case when ev.status = 'live'
                 then date_trunc('minute', now()) - interval '4 hours'
                 else (v_day1::timestamp + time '09:00') at time zone 'Europe/Sofia' end;

    insert into public.stages (event_id, day_number, sort_order, type, name, name_en, points_scale,
                               first_start_at, start_interval_seconds, riders_per_slot, course_closes_at)
    values (v_event, 1, 1, 'navigation', 'Ден 1 · Навигация', 'Day 1 · Navigation', 'bgx_navigation_day1',
            v_first, 30, 2, v_first + interval '8 hours')
    returning id into v_nav;

    insert into public.stage_classes (stage_id, event_id, class_id, start_order, riders_per_slot, gap_before_seconds, distance_km)
    select v_nav, v_event, ec.class_id, ec.start_order,
           case when c.code = 'pro' then 1 end,
           case when c.code = 'pro' then 0 else 180 end,
           case when c.code = 'wom' then 38 when c.code = 'std' then 52 else 68 end
    from public.event_classes ec
    join public.classes c on c.id = ec.class_id
    where ec.event_id = v_event;

    insert into public.checkpoints (stage_id, event_id, code, name, name_en, sort_order) values
      (v_nav, v_event, 'CP1', 'Контрола 1 · Прохода',       'Checkpoint 1 · The pass',       1),
      (v_nav, v_event, 'CP2', 'Контрола 2 · Зареждане',     'Checkpoint 2 · Refuel',         2),
      (v_nav, v_event, 'CP3', 'Контрола 3 · Скалния улей', 'Checkpoint 3 · Rock gully',     3);
    select array_agg(id order by sort_order) into v_cp from public.checkpoints where stage_id = v_nav;

    perform public.generate_start_list(v_nav);

    if ev.status <> 'upcoming' then
      -- Times: each rider has a steady "skill"; faster classes ride longer loops.
      for s in
        select ss.*, e2.race_number, c.code as class_code
        from public.start_slots ss
        join public.entries e2 on e2.id = ss.entry_id
        join public.classes c on c.id = e2.class_id
        where ss.stage_id = v_nav
        order by ss.position
      loop
        v_skill := 1 + (((s.race_number * 37) % 17) / 100.0) + (ev.round_number * ((s.race_number * 13) % 7) / 200.0);
        -- Two riders per event don't finish; they stop after CP2.
        v_n := case when s.race_number % 100 in (7) and s.class_code in ('pro', 'std') then 2 else 4 end;
        for k in 1 .. v_n loop
          -- The race number adds a few seconds, so no two riders share a time (a real tie is rare).
          v_at := s.scheduled_start
                  + make_interval(secs => round(k * (case s.class_code when 'wom' then 2700 when 'std' then 3000 else 3300 end) * v_skill)
                                          + k * (s.race_number % 100) * 7);
          continue when v_at > now();
          if k <= 3 then
            insert into public.passings (client_id, event_id, stage_id, entry_id, point, checkpoint_id, passed_at, recorded_by, source)
            values (gen_random_uuid(), v_event, v_nav, s.entry_id, 'checkpoint', v_cp[k], v_at, v_admin, 'device');
          else
            insert into public.passings (client_id, event_id, stage_id, entry_id, point, passed_at, recorded_by, source)
            values (gen_random_uuid(), v_event, v_nav, s.entry_id, 'finish', v_at, v_admin, 'device');
          end if;
        end loop;
        if v_n = 2 and ev.status = 'finished' then
          insert into public.rider_statuses (event_id, stage_id, entry_id, status, reason)
          values (v_event, v_nav, s.entry_id, 'dnf', 'Счупен преден амортисьор след CP2');
        end if;
      end loop;

      -- GPS penalties: two confirmed by the jury, one still waiting.
      insert into public.penalties (event_id, stage_id, entry_id, penalty_type_id, note, status)
      select v_event, v_nav, en.id, pt.id, 'GPS: отклонение 340 м при WP 21', 'confirmed'
      from public.entries en, public.penalty_types pt
      where en.event_id = v_event and en.race_number = 103 and pt.event_id is null and pt.code = 'track_dev_100_500';

      insert into public.penalties (event_id, stage_id, entry_id, penalty_type_id, note, status)
      select v_event, v_nav, en.id, pt.id, 'Няма запис на CP3', 'confirmed'
      from public.entries en, public.penalty_types pt
      where en.event_id = v_event and en.race_number = 305 and pt.event_id is null and pt.code = 'missed_control';

      insert into public.penalties (event_id, stage_id, entry_id, penalty_type_id, note)
      select v_event, v_nav, en.id, pt.id, 'GPS: отклонение 180 м, за преглед от журито'
      from public.entries en, public.penalty_types pt
      where en.event_id = v_event and en.race_number = 204 and pt.event_id is null and pt.code = 'track_dev_100_500';

      insert into public.marshal_messages (client_id, event_id, stage_id, checkpoint_id, kind, race_number, body, lat, lon, accuracy_m, sent_at,
                                           resolved_at, resolved_by)
      values (gen_random_uuid(), v_event, v_nav, v_cp[2], 'sos', 107, 'Паднал в улея, в съзнание, иска помощ за мотора',
              41.5775, 24.7011, 12, v_first + interval '2 hours',
              case when ev.status = 'finished' then v_first + interval '2 hours 20 minutes' end,
              case when ev.status = 'finished' then v_admin end);
    end if;

    -- Day 2: enduro-cross. Only the finished event has raced it.
    insert into public.stages (event_id, day_number, sort_order, type, name, name_en, points_scale)
    values (v_event, 2, 2, 'enduro_cross', 'Ден 2 · Ендурокрос', 'Day 2 · Enduro-cross', 'bgx_closed_course')
    returning id into v_ex;

    insert into public.stage_classes (stage_id, event_id, class_id, start_order)
    select v_ex, v_event, class_id, start_order from public.event_classes where event_id = v_event;

    insert into public.sessions (event_id, stage_id, class_id, kind, number, duration_minutes)
    select v_event, v_ex, ec.class_id, k.kind, k.number,
           case when k.kind = 'qualifying' then 15 when c.code = 'pro' then 10 else 8 end
    from public.event_classes ec
    join public.classes c on c.id = ec.class_id
    cross join (values ('qualifying'::public.session_kind, 1), ('heat', 1), ('heat', 2)) as k (kind, number)
    where ec.event_id = v_event;

    if ev.status = 'finished' then
      v_at := ((v_day1 + 1)::timestamp + time '10:00') at time zone 'Europe/Sofia';
      for sess in
        select se.*, c.sort_order
        from public.sessions se join public.classes c on c.id = se.class_id
        where se.stage_id = v_ex
        order by se.number, se.kind desc, c.sort_order
      loop
        update public.sessions set started_at = v_at, finished_at = v_at + make_interval(mins => duration_minutes + 3)
        where id = sess.id;
        for e in select * from public.entries where event_id = v_event and class_id = sess.class_id loop
          v_skill := 1 + (((e.race_number * (sess.number + 5)) % 19) / 100.0);
          v_lap := 92 * v_skill + sess.sort_order * 4;
          v_laps := case when sess.kind = 'qualifying' then 4 else greatest(2, floor((sess.duration_minutes * 60) / v_lap)::int + 1) end;
          -- The slowest rider in each heat falls a lap behind.
          if sess.kind = 'heat' and e.race_number % 100 = 8 then v_laps := v_laps - 1; end if;
          for k in 1 .. v_laps loop
            insert into public.laps (client_id, event_id, session_id, entry_id, crossed_at, source, recorded_by)
            values (gen_random_uuid(), v_event, sess.id, e.id,
                    v_at + make_interval(secs => round(k * v_lap + ((e.race_number * k) % 9), 1)), 'import', v_admin);
          end loop;
        end loop;
        v_at := v_at + interval '25 minutes';
      end loop;

      insert into public.protests (event_id, stage_id, filed_by_entry_id, against_entry_id, type, fact, fee_paid, fee_refunded,
                                   filed_at, deadline_at, status, decision, decided_by, decided_at)
      select v_event, v_nav, f.id, a.id, 'navigation', 'Състезател №103 е пропуснал задължителна точка WP 21.', true, false,
             v_first + interval '9 hours', v_first + interval '10 hours', 'upheld',
             'GPS тракът потвърждава отклонение от 340 м. Наложено наказание 30 минути по Р XIX.4.', v_admin, v_first + interval '10 hours 30 minutes'
      from public.entries f, public.entries a
      where f.event_id = v_event and f.race_number = 102 and a.event_id = v_event and a.race_number = 103;

      insert into public.protests (event_id, stage_id, filed_by_entry_id, type, fact, fee_paid, fee_refunded,
                                   filed_at, deadline_at, status, decision, decided_by, decided_at)
      select v_event, v_ex, f.id, 'result', 'Броят обиколки в манш 2 е грешен.', true, true,
             v_at, v_at + interval '30 minutes', 'rejected',
             'Записите от хронометража показват 7 пълни обиколки. Протестът се отхвърля.', v_admin, v_at + interval '50 minutes'
      from public.entries f
      where f.event_id = v_event and f.race_number = 208;

      perform public.publish_results(v_event, v_nav, 'provisional', 30, 'Предварителни резултати');
      perform public.publish_results(v_event, v_nav, 'official', null, 'Одобрено от журито');
      perform public.publish_results(v_event, v_ex, 'official', null, 'Одобрено от журито');
      perform public.publish_results(v_event, null, 'official', null, 'Крайно класиране на кръга');
    end if;
  end loop;

  raise notice 'Created test events: %', v_events;
end;
$$;
