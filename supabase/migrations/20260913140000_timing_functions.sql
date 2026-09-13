-- Functions used by the timing app and the organizer.

-- Server clock for device clock-offset correction. A marshal's phone can be seconds off;
-- the app measures the offset while online and stores corrected times.
create function public.server_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

grant execute on function public.server_time() to anon, authenticated;

-- Start-list generator. Р XI and observed practice:
--   * classes in stage_classes.start_order, with an optional gap before each class;
--   * inside a class: day 1 by current season standing (unranked riders last, by race number),
--     a later navigation day by the previous navigation day's result;
--   * riders_per_slot riders share each slot, slots start_interval_seconds apart.
-- Runs with the caller's rights, so RLS limits it to the event's organizer.
create function public.generate_start_list(p_stage_id bigint)
returns int
language plpgsql
set search_path = ''
as $$
declare
  st          public.stages;
  prev_stage  bigint;
  c           record;
  r           record;
  v_next      timestamptz;
  v_in_slot   int;
  v_interval  int;
  v_per_slot  int;
  v_position  int := 0;
  v_first     boolean := true;
begin
  select * into st from public.stages where id = p_stage_id;
  if not found then
    raise exception 'Stage % not found', p_stage_id;
  end if;
  if not public.has_event_role(st.event_id, array['organizer']::public.staff_role[]) then
    raise exception 'Only the organizer can generate a start list';
  end if;
  if st.first_start_at is null then
    raise exception 'Set the first start time before generating the start list';
  end if;
  if exists (select 1 from public.passings p where p.stage_id = p_stage_id and p.voided_at is null) then
    raise exception 'Timing has already been recorded for this stage; the start list is locked';
  end if;

  select s.id into prev_stage
  from public.stages s
  where s.event_id = st.event_id and s.type = 'navigation' and s.day_number < st.day_number
  order by s.day_number desc
  limit 1;

  delete from public.start_slots where stage_id = p_stage_id;

  v_next := st.first_start_at;

  for c in
    select sc.*
    from public.stage_classes sc
    where sc.stage_id = p_stage_id
    order by sc.start_order, sc.class_id
  loop
    v_interval := coalesce(c.start_interval_seconds, st.start_interval_seconds, 30);
    v_per_slot := coalesce(c.riders_per_slot, st.riders_per_slot, 1);
    v_in_slot := 0;

    if not v_first then
      v_next := v_next + make_interval(secs => c.gap_before_seconds);
    end if;

    for r in
      select e.id as entry_id
      from public.entries e
      left join public.navigation_results prev
        on prev.stage_id = prev_stage and prev.entry_id = e.id
      left join public.events ev on ev.id = e.event_id
      left join public.season_standings ss
        on ss.season_id = ev.season_id and ss.rider_id = e.rider_id and ss.class_id = e.class_id
      where e.event_id = st.event_id and e.class_id = c.class_id and not e.withdrawn
      order by
        case when prev_stage is not null then prev.position end nulls last,
        ss.position nulls last,
        e.race_number
    loop
      if v_in_slot = v_per_slot then
        v_next := v_next + make_interval(secs => v_interval);
        v_in_slot := 0;
      end if;
      v_position := v_position + 1;
      insert into public.start_slots (stage_id, event_id, entry_id, position, scheduled_start)
      values (p_stage_id, st.event_id, r.entry_id, v_position, v_next);
      v_in_slot := v_in_slot + 1;
      v_first := false;
    end loop;

    if v_in_slot > 0 then
      v_next := v_next + make_interval(secs => v_interval);
    end if;
  end loop;

  return v_position;
end;
$$;

grant execute on function public.generate_start_list(bigint) to authenticated;
