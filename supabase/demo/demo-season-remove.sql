-- Removes everything demo-season.sql created: the "ТЕСТ · …" events (with their stages, entries,
-- times, penalties, protests and publications), the test riders and the "Тест МК …" clubs.
-- Nothing else is touched.

do $$
declare
  v_riders bigint[] := (
    select coalesce(array_agg(r.id), '{}')
    from public.riders r
    join public.clubs c on c.id = r.club_id
    where c.name like 'Тест МК %'
  );
begin
  -- Stages, entries, times, penalties, protests and publications go with their event.
  delete from public.events where name like 'ТЕСТ · %';

  delete from public.season_numbers where rider_id = any (v_riders);
  delete from public.riders where id = any (v_riders);
  delete from public.clubs where name like 'Тест МК %';
  raise notice 'Removed test data (% riders).', coalesce(array_length(v_riders, 1), 0);
end;
$$;
