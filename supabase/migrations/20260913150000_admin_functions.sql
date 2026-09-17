-- Functions behind the admin panel.

-- Organizers register clubs as riders arrive (a club typed in an import that does not exist yet).
drop policy "clubs: admin insert" on public.clubs;
create policy "clubs: organizer insert" on public.clubs
  for insert to authenticated with check (public.is_any_organizer());

-- Who holds which role in an event. Profiles and auth emails are private, so this goes through a function
-- that only the event's organizer or jury chair (or a super admin) can use.
create function public.event_staff_members(p_event_id bigint)
returns table (user_id uuid, email text, full_name text, role public.staff_role)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, u.email::text, coalesce(p.full_name, ''), s.role
  from public.event_staff s
  join auth.users u on u.id = s.user_id
  left join public.profiles p on p.id = s.user_id
  where s.event_id = p_event_id
    and public.has_event_role(p_event_id, array['organizer', 'jury_chair']::public.staff_role[])
  order by s.role, u.email;
$$;

grant execute on function public.event_staff_members(bigint) to authenticated;

-- Give an existing account a role in an event. Same rule as the event_staff policies:
-- a super admin assigns anything, an organizer assigns timekeepers and GPS judges.
create function public.assign_staff(p_event_id bigint, p_email text, p_role public.staff_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not (
    public.is_super_admin()
    or (p_role in ('timekeeper', 'gps_judge')
        and public.has_event_role(p_event_id, array['organizer']::public.staff_role[]))
  ) then
    raise exception 'Not allowed to assign this role' using errcode = '42501';
  end if;

  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No account with this email' using errcode = 'P0002';
  end if;

  insert into public.event_staff (event_id, user_id, role)
  values (p_event_id, v_user, p_role)
  on conflict do nothing;
  return v_user;
end;
$$;

grant execute on function public.assign_staff(bigint, text, public.staff_role) to authenticated;

-- Bulk entry import from a spreadsheet. Each row is independent: a bad row is reported, the rest go in.
-- Row keys: race_number, first_name, last_name, class (code or name, BG or EN), club, country,
--           birth_date (YYYY-MM-DD), phone, email, license_number.
-- A race number already in the event updates that entry; otherwise a rider with the same name
-- (and club, when given) is reused, else a new rider is created.
-- Runs with the caller's rights: RLS still limits it to the event's organizer.
create function public.import_entries(p_event_id bigint, p_rows jsonb)
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
  v_class   bigint;
  v_club    bigint;
  v_rider   bigint;
  v_entry   bigint;
  v_country text;
  v_added   int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.has_event_role(p_event_id, array['organizer']::public.staff_role[]) then
    raise exception 'Only the organizer can import entries' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    v_class := null;
    v_club := null;
    v_rider := null;
    v_entry := null;

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
      from public.event_classes ec
      join public.classes c on c.id = ec.class_id
      where ec.event_id = p_event_id
        and lower(btrim(v_row ->> 'class')) in (lower(c.code), lower(c.name), lower(coalesce(c.name_en, '')))
      limit 1;
      if v_class is null then
        raise exception 'unknown class "%"', coalesce(v_row ->> 'class', '');
      end if;

      if nullif(btrim(v_row ->> 'club'), '') is not null then
        select id into v_club from public.clubs where lower(name) = lower(btrim(v_row ->> 'club'));
        if v_club is null then
          insert into public.clubs (name, country) values (btrim(v_row ->> 'club'), v_country)
          returning id into v_club;
        end if;
      end if;

      select e.id, e.rider_id into v_entry, v_rider
      from public.entries e
      where e.event_id = p_event_id and e.race_number = v_number;

      if v_rider is null then
        select r.id into v_rider
        from public.riders r
        where lower(r.first_name) = lower(v_first)
          and lower(r.last_name) = lower(v_last)
          and (v_club is null or r.club_id = v_club)
        order by r.id
        limit 1;
      end if;

      if v_rider is null then
        insert into public.riders (first_name, last_name, country, club_id)
        values (v_first, v_last, v_country, v_club)
        returning id into v_rider;
      else
        update public.riders
        set first_name = v_first, last_name = v_last, country = v_country, club_id = coalesce(v_club, club_id)
        where id = v_rider;
      end if;

      if v_entry is null then
        insert into public.entries (event_id, rider_id, class_id, race_number, club_id)
        values (p_event_id, v_rider, v_class, v_number, v_club);
        v_added := v_added + 1;
      else
        update public.entries
        set rider_id = v_rider, class_id = v_class, club_id = coalesce(v_club, club_id), withdrawn = false
        where id = v_entry;
        v_updated := v_updated + 1;
      end if;

      -- After the entry exists, so the organizer's read policy on personal data applies to this rider.
      if coalesce(nullif(v_row ->> 'birth_date', ''), nullif(v_row ->> 'phone', ''),
                  nullif(v_row ->> 'email', ''), nullif(v_row ->> 'license_number', '')) is not null then
        insert into public.rider_private (rider_id, birth_date, phone, email, license_number)
        values (
          v_rider,
          nullif(v_row ->> 'birth_date', '')::date,
          nullif(v_row ->> 'phone', ''),
          nullif(v_row ->> 'email', ''),
          nullif(v_row ->> 'license_number', '')
        )
        on conflict (rider_id) do update set
          birth_date     = coalesce(excluded.birth_date, rider_private.birth_date),
          phone          = coalesce(excluded.phone, rider_private.phone),
          email          = coalesce(excluded.email, rider_private.email),
          license_number = coalesce(excluded.license_number, rider_private.license_number);
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('line', v_line, 'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'errors', v_errors);
end;
$$;

grant execute on function public.import_entries(bigint, jsonb) to authenticated;
