-- English names for everything the public reads. The UI falls back to the Bulgarian name when empty.
-- Rider names are not stored twice: the app transliterates them (official Bulgarian system).

alter table public.classes       add column name_en text;
alter table public.penalty_types add column name_en text;
alter table public.stages        add column name_en text;
alter table public.checkpoints   add column name_en text;

update public.classes c
set name_en = v.name_en
from (values
  ('pro', 'Pro'), ('exp', 'Expert'), ('std', 'Standard'), ('s40', 'Senior 40+'), ('s50', 'Senior 50+'),
  ('wom', 'Women'), ('jst', 'Junior Standard'), ('jun', 'Junior'), ('mjun', 'Mini Junior'), ('adv', 'Adventure')
) as v (code, name_en)
where c.code = v.code;

update public.points_scales p
set name = v.name
from (values
  ('bgx_navigation_day1', 'Навигация ден 1 (места 1–20) / Navigation day 1 (places 1–20)'),
  ('bgx_closed_course',   'Ендурокрос / навигация ден 2 (места 1–12) / Enduro-cross or navigation day 2 (places 1–12)'),
  ('bgx_team',            'Отборно класиране (места 1–25) / Team classification (places 1–25)')
) as v (code, name)
where p.code = v.code;

update public.penalty_types t
set name_en = v.name_en
from (values
  ('track_dev_100_500',      'Track deviation 100–500 m'),
  ('track_dev_500_1000',     'Track deviation 500–1000 m'),
  ('track_dev_over_1000',    'Track deviation over 1000 m'),
  ('gps_gap_100_500',        'GPS signal gap 100–500 m'),
  ('gps_gap_500_1000',       'GPS signal gap 500–1000 m'),
  ('gps_gap_over_1000',      'GPS signal gap over 1000 m'),
  ('bypass_mandatory',       'Bypassed a mandatory section'),
  ('missed_control',         'Missed control'),
  ('speeding',               'Speeding (GPS peak value)'),
  ('ex_missed_obstacle',     'Missed obstacle (enduro-cross)'),
  ('tape_exit_closed',       'Left the tapes on the closed course'),
  ('numbers_invalid',        'Non-compliant race numbers'),
  ('start_despite_tech',     'Started despite the technical official''s refusal'),
  ('bike_change',            'Changed motorcycle during a race day'),
  ('refuel_violation',       'Refuelled outside the zone or with the engine running'),
  ('smoking_refuel',         'Smoking in the refuelling zone'),
  ('ex_outside_help',        'Outside assistance on the enduro-cross course'),
  ('dangerous_riding',       'Dangerous riding causing an accident'),
  ('abusive_conduct',        'Abusive conduct'),
  ('left_course_unreported', 'Left the course without notifying the organiser'),
  ('paddock_speeding',       'Over 20 km/h in the paddock'),
  ('radio_contact',          'Electronic communication with the team during a session'),
  ('washing_outside',        'Washing or dumping oil outside the designated areas')
) as v (code, name_en)
where t.event_id is null and t.code = v.code;
