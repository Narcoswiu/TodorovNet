-- Reference data from the BG-X Правилник 2026 (docs/bgx-rules.md).

insert into public.points_scales (code, name, points) values
  ('bgx_navigation_day1', 'Навигация ден 1 (места 1–20)',
     array[25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]),
  ('bgx_closed_course', 'Ендурокрос / навигация ден 2 (места 1–12)',
     array[15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]),
  ('bgx_team', 'Отборно класиране (места 1–25)',
     array[30, 25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1, 1]);

insert into public.seasons (year, name, drop_worst_rounds) values
  (2026, 'BG-X Enduro Championship', 1);

-- Р V p.3 (ages), Р VI.4 (race-number colours). Mini Junior colours are not stated in the rules.
insert into public.classes (season_id, code, name, min_age, max_age, number_bg, number_fg, team_scoring, sort_order)
select s.id, c.code, c.name, c.min_age, c.max_age, c.number_bg, c.number_fg, c.team_scoring, c.sort_order
from public.seasons s
cross join (values
  ('pro',  'Про',              16, null, 'black',  'white', true,  1),
  ('exp',  'Експерт',          14, null, 'red',    'white', true,  2),
  ('std',  'Стандарт',         13, null, 'green',  'white', true,  3),
  ('s40',  'Сеньор 40+',       40, null, 'blue',   'white', false, 4),
  ('s50',  'Сеньор 50+',       50, null, 'white',  'blue',  false, 5),
  ('wom',  'Жени',             12, null, 'purple', 'white', false, 6),
  ('jst',  'Джуниър-Стандарт', 13, 18,   'white',  'green', false, 7),
  ('jun',  'Джуниър',          11, 14,   'white',  'green', false, 8),
  ('mjun', 'Мини Джуниър',      7, 10,   null,     null,    false, 9),
  ('adv',  'Адвенчър',         23, null, 'white',  'black', false, 10)
) as c (code, name, min_age, max_age, number_bg, number_fg, team_scoring, sort_order)
where s.year = 2026;

-- Default penalty catalogue, Р XIX and Appendix 4. Where the rulebook says only "дисквалификация"
-- without a scope, the scope below is a default the jury can change per event.
insert into public.penalty_types (code, name, rule_ref, kind, seconds, unit_label, dsq_scope, fine_eur) values
  ('track_dev_100_500',    'Отклонение от трака 100–500 м',               'Р XIX.4',  'time',          1800, null,           null,    null),
  ('track_dev_500_1000',   'Отклонение от трака 500–1000 м',              'Р XIX.4',  'time',          7200, null,           null,    null),
  ('track_dev_over_1000',  'Отклонение от трака над 1000 м',              'Р XIX.4',  'dsq',           null, null,           'stage', null),
  ('gps_gap_100_500',      'Липса на GPS сигнал 100–500 м',               'Р XIX.4',  'time',          1800, null,           null,    null),
  ('gps_gap_500_1000',     'Липса на GPS сигнал 500–1000 м',              'Р XIX.4',  'time',          7200, null,           null,    null),
  ('gps_gap_over_1000',    'Липса на GPS сигнал над 1000 м',              'Р XIX.4',  'dsq',           null, null,           'stage', null),
  ('bypass_mandatory',     'Заобикаляне на задължителен участък',          'Р XIX.7',  'time',          3600, null,           null,    null),
  ('missed_control',       'Пропусната контрола',                         'Р XIX.8',  'time',          3600, null,           null,    null),
  ('speeding',             'Превишена скорост (пикова GPS стойност)',      'Р XIX.9',  'time_per_unit',   60, 'км/ч над 50',  null,    null),
  ('ex_missed_obstacle',   'Непреминато препятствие (ендурокрос)',         'Р XIX.15', 'time',            30, null,           null,    null),
  ('tape_exit_closed',     'Излизане от лентите на затворения кръг',       'Р XIX.16', 'time',           900, null,           null,    null),
  ('numbers_invalid',      'Неизрядни състезателни номера',                'Р VI.6',   'dsq',           null, null,           'stage', null),
  ('start_despite_tech',   'Стартирал въпреки забрана на техническото лице','Р X.5',   'dnf',           null, null,           null,    null),
  ('bike_change',          'Смяна на мотор по време на състезателен ден',  'Р XIX.6',  'dsq',           null, null,           'stage', null),
  ('refuel_violation',     'Зареждане извън зоната или с работещ двигател','Р XV.3',   'dsq',           null, null,           'stage', null),
  ('smoking_refuel',       'Пушене в зоната за зареждане',                 'Р XIX.18', 'dsq',           null, null,           'stage', null),
  ('ex_outside_help',      'Непозволена помощ на ендурокрос трасето',      'Р XIX.13', 'dsq',           null, null,           'session', null),
  ('dangerous_riding',     'Опасно каране, предизвикало произшествие',     'Р XIX.17', 'dsq',           null, null,           'event', null),
  ('abusive_conduct',      'Непристойно поведение',                        'Р XIX.20', 'dsq',           null, null,           'event', null),
  ('left_course_unreported','Напуснал трасето без да уведоми',             'Р XIX.21', 'dsq',           null, null,           'event_and_next_round', null),
  ('paddock_speeding',     'Над 20 км/ч в падока',                         'Прил. 4',  'dsq',           null, null,           'event', null),
  ('radio_contact',        'Електронна връзка с отбора по време на сесия', 'Прил. 4',  'dsq',           null, null,           'event', null),
  ('washing_outside',      'Миене или изливане на масло извън определените места', 'Прил. 4', 'fine', null, null,         null,    50);
