-- Result publication: provisional → protest window → official, each a numbered version that freezes
-- the classification as it was at that moment. Documents (PDF) are rendered from the frozen copy,
-- so a published sheet can never change silently afterwards.

alter table public.publications
  add column version          int not null default 1,
  add column snapshot         jsonb,
  add column published_by_name text;

create index on public.publications (event_id, stage_id, published_at desc);

create function public.publications_next_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(p.version), 0) + 1 into new.version
  from public.publications p
  where p.event_id = new.event_id and p.stage_id is not distinct from new.stage_id;
  return new;
end;
$$;

create trigger publications_next_version
  before insert on public.publications
  for each row execute function public.publications_next_version();

-- Publications are a permanent record: no edits, no deletes.
drop policy if exists "publications: update" on public.publications;
revoke update, delete on public.publications from anon, authenticated;

-- Builds the frozen document and publishes it. p_stage_id null = the round's final classification.
-- Runs with the caller's rights: RLS decides who may publish, and the trigger allows 'official' only
-- for the jury chair. The snapshot holds public data only (names, club, country, results).
create function public.publish_results(
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

  select jsonb_build_object(
           'id', e.id, 'name', e.name, 'location', e.location, 'date_from', e.date_from,
           'date_to', e.date_to, 'round_number', e.round_number, 'timezone', e.timezone)
    into v_event
  from public.events e where e.id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'code', c.code, 'name', c.name, 'name_en', c.name_en,
           'number_bg', c.number_bg, 'number_fg', c.number_fg) order by ec.start_order, c.sort_order), '[]'::jsonb)
    into v_classes
  from public.event_classes ec join public.classes c on c.id = ec.class_id
  where ec.event_id = p_event_id;

  if p_stage_id is null then
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

grant execute on function public.publish_results(bigint, bigint, public.publication_state, int, text) to authenticated;
