-- Entry eligibility checks (Р V ages, licences from the 2026 licence table, club via BFM licensing).
-- Warnings for the organizer, not hard blocks: officials decide, and some cases (a guest class, a
-- licence being processed) are legitimate. Visible only to the event's organizer and jury, because
-- the checks read personal data (birth date, licence).
--
-- Issue codes:
--   no_birth_date    birth date unknown, age limits cannot be checked
--   too_young        younger than the class minimum on the first day of the event
--   too_old          past the class maximum: the maximum applies until the end of the calendar year
--                    in which the rider reaches it (Р V p.3)
--   no_licence       Bulgarian rider without a licence type on file
--   licence_expired  licence valid-until date before the last day of the event
--   licence_class    licence type does not cover the class (PROMO: Mini Junior, Junior, Junior-Standard,
--                    Women, Adventure; A: Pro, Expert; B: Standard, Senior 40+, Senior 50+;
--                    one-event and foreign licences cover any class)
--   no_club          Bulgarian rider without a club (a BFM licence is issued through a club)

create view public.entry_eligibility
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
    case when ri.country = 'BG' and e.club_id is null then 'no_club' end
  ], null) as issues
from public.entries e
join public.events ev on ev.id = e.event_id
join public.classes c on c.id = e.class_id
join public.riders ri on ri.id = e.rider_id
left join public.rider_private rp on rp.rider_id = e.rider_id
where not e.withdrawn
  and public.has_event_role(e.event_id, array['organizer', 'jury', 'jury_chair']::public.staff_role[]);

revoke all on public.entry_eligibility from anon;
grant select on public.entry_eligibility to authenticated;
