-- Season race-number registry (bgx.bg/racenumbers.html): who holds which number for the season.

-- Bulk registration from a spreadsheet, same row keys and matching rules as import_entries.
-- A race number already taken moves to the new rider; a rider who already holds another number
-- gives it up (one number per rider per season). Super admin only (season_numbers RLS).
create function public.import_season_numbers(p_season_id bigint, p_rows jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_row     jsonb;
  v_line    int := 0;
  v_number  int;
  v_first   text;
  v_last    text;
  v_country text;
  v_class   bigint;
  v_club    bigint;
  v_rider   bigint;
  v_exists  boolean;
  v_added   int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can manage the number registry' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    v_class := null;
    v_club := null;
    v_rider := null;
    begin
      v_number := nullif(btrim(v_row ->> 'race_number'), '')::int;
      v_first := btrim(coalesce(v_row ->> 'first_name', ''));
      v_last := btrim(coalesce(v_row ->> 'last_name', ''));
      v_country := upper(coalesce(nullif(btrim(v_row ->> 'country'), ''), 'BG'));
      if v_number is null or v_number <= 0 then
        raise exception 'invalid race number';
      end if;
      if v_first = '' or v_last = '' then
        raise exception 'missing first or last name';
      end if;

      select c.id into v_class
      from public.classes c
      where c.season_id = p_season_id
        and lower(btrim(v_row ->> 'class')) in (lower(c.code), lower(c.name), lower(coalesce(c.name_en, '')))
      limit 1;
      if v_class is null then
        raise exception 'unknown class "%"', coalesce(v_row ->> 'class', '');
      end if;

      if nullif(btrim(v_row ->> 'club'), '') is not null then
        select id into v_club from public.clubs where lower(name) = lower(btrim(v_row ->> 'club'));
        if v_club is null then
          insert into public.clubs (name, country) values (btrim(v_row ->> 'club'), v_country) returning id into v_club;
        end if;
      end if;

      select r.id into v_rider
      from public.riders r
      where lower(r.first_name) = lower(v_first) and lower(r.last_name) = lower(v_last)
        and (v_club is null or r.club_id = v_club)
      order by r.id
      limit 1;
      if v_rider is null then
        insert into public.riders (first_name, last_name, country, club_id)
        values (v_first, v_last, v_country, v_club)
        returning id into v_rider;
      elsif v_club is not null then
        update public.riders set club_id = v_club where id = v_rider;
      end if;

      select exists (select 1 from public.season_numbers where season_id = p_season_id and race_number = v_number) into v_exists;

      delete from public.season_numbers
      where season_id = p_season_id and rider_id = v_rider and race_number <> v_number;

      insert into public.season_numbers (season_id, race_number, rider_id, class_id)
      values (p_season_id, v_number, v_rider, v_class)
      on conflict (season_id, race_number) do update set rider_id = excluded.rider_id, class_id = excluded.class_id;

      if v_exists then v_updated := v_updated + 1; else v_added := v_added + 1; end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('line', v_line, 'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'errors', v_errors);
end;
$$;

grant execute on function public.import_season_numbers(bigint, jsonb) to authenticated;

-- Eligibility gains one check: in a season that keeps a registry, the rider races with the number
-- registered to them. Seasons without a registry are not flagged.
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
         then 'number_not_registered' end
  ], null) as issues
from public.entries e
join public.events ev on ev.id = e.event_id
join public.classes c on c.id = e.class_id
join public.riders ri on ri.id = e.rider_id
left join public.rider_private rp on rp.rider_id = e.rider_id
where not e.withdrawn
  and public.has_event_role(e.event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]);
