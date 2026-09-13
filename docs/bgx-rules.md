# BG-X Enduro Championship (bgx.bg): rules extract for TodorovNET

Research date: 2026-09-13. Source site: https://bgx.bg (crawled in full: 28 content pages, all 2019–2026 event pages page-119…page-205, 140+ result PDFs, and every document linked from the Documents page).

## 0. What bgx.bg is, and which discipline matches

- bgx.bg is **not the federation's own site**. It belongs to the association „БГ Х Ендуро“, the BFM's promoter for the national extreme enduro championship. Footer: „Сдружение "БГ Х Ендуро" е промоутър на Българската федерация по мотоциклетизъм за организирането и провеждането на Националния Екстремен Ендуро Шампионат“. The federation itself (БФМ) is at bfm.bg.
- The site covers **one discipline**: the **BG-X Enduro Championship**, officially the Republican Enduro Championship „РШЕ“ („официалния Републикански шампионат по ендуро“). Its content is hard/extreme enduro. There are no separate rulebooks for classic enduro (ISDE-style TC/SS), rally-enduro or GNCC.
- **Event format** (Правилник 2026, I.6, p.1–2):
  - A round is traditionally **2 days**.
  - **Day 1 is НАВИГАЦИЯ**: a cross-country track followed by GPS and/or tape markers, with a per-class distance.
  - **Day 2 is ЕНДУРОКРОС**: a closed man-made course with a qualification session and 2 heats, timed by MyLaps transponders.
  - Alternative formats are allowed if announced. In 2026 six of the ten championship rounds were **2 days of navigation**.
  - An optional **ПРОЛОГ** can be held, Friday only. It gives no points and may set the navigation start order.
  - Uran Enduro 2026 used "Пролог | навигация | GNCC", with its rules on the external site uran-enduro.com (not read).
- **Mapping to the TodorovNET model:**
  - Navigation maps to your Navigation segment.
  - Enduro-cross maps to your "XC laps". It is heat-based: laps plus time, scored with points.
  - "Special stages" (SS) are **not separately timed stages**. They are mandatory sections inside the navigation, checked by a physical or GPS control, with a time penalty for bypassing them.
  - Prologue maps to Prologue.
  - **Key mismatch: round and season standings are POINTS-based, not summed time.** Time only ranks riders inside one navigation day or one enduro-cross heat.

Main source: **ПРАВИЛНИК за организиране и провеждане на състезания от националния БГ Х ЕНДУРО ШАМПИОНАТ За СЕЗОН 2026**, 27 pages.
https://bgx.bg/d/file/26-Правилник-на-БГ-Х-Ендуро-В7(1).pdf. Linked from https://bgx.bg/page-130.html. Cited below as "Р" + section + page.

---

## 1. Classes, age and bike limits, start order

**Classes** (Р V, p.3): „Мотори Про, Експерт, Стандарт, Сеньор 40+, Сеньор 50+, Жени, Джуниър-Стандарт, Джуниър, Мини джуниър“. Адвенчър is defined in the table and in Appendix 3.

| Class (BG / result sheets) | Min age | Max age | Allowed motorcycles |
|---|---|---|---|
| Про (sheets: ПРОФИ / PROFI) | 16 | – | 125–550cc 2T; 250–600cc 4T (the table row reads as applying to all adult classes) |
| Експерт | 14 | – | same |
| Стандарт | 13 | – | same |
| Сеньор 40+ | 40 | – | same |
| Сеньор 50+ | 50 | – | same |
| Жени | 12 | – | same |
| Джуниър | 11 | 14 | 85–150cc 2T / up to 250cc 4T |
| Джуниър-Стандарт | 13 | 18 | 150–300cc 2T; 240–500cc 4T |
| Мини Джуниър | 7 | 10 | up to 84cc 2T/4T, automatic, semi-automatic or geared |
| Адвенчър (ADV) | 23 | – | 4T only, dry weight ≥150 kg, ≥450cc (App.3 ADV02 names "CF MOTO"); motocross/enduro bikes forbidden |

- **Age rule:** „За минимална възраст … се взема предвид датата на раждане, а за максимална – края на календарната година в която състезателят я е навършил“ (Р V p.3). Minimum age counts from the birth date. Maximum age runs to the end of the calendar year in which it is reached.
- **Class change:** „…могат по изключение да сменят класа … само веднъж за един състезателен сезон“. Only after BG X reviews the request (Р V p.3).
- **Forced promotion of champions** (Р XVIII.4 p.15). Applies to Джуниър-Стандарт, Стандарт, Експерт and Про champions:
  - Junior-Standard champion moves up to Standard, Expert, or Pro if aged 16+.
  - Standard champion moves to Expert.
  - Expert champion moves to Pro.
  - The Pro champion may not ride Expert.
- **ADV extras** (App.3 p.24–25):
  - Car-style driving licence category A/A2.
  - Registered plate and valid civil liability insurance.
  - Hard luggage removed.
  - Full-face helmet.
  - Two riders may share one GPS (ADV07).
  - Number stickers are white background with black digits.
  - Radios are allowed for ADV only (App.4).
- **Race-number colours** (Р VI.4 p.4; racenumbers.html):
  - Pro: black background, white digits.
  - Expert: red background, white digits.
  - Senior 40+: blue background, white digits.
  - Senior 50+: white background, blue digits.
  - Standard: green background, white digits.
  - Women: purple background, white digits.
  - Junior-Standard and Junior: white background, green digits.
  - Adventure: white background, black digits.
  - The FAQ (page-133) still lists an older 5-colour scheme.
- **Physical numbers** (Р VI p.4): 3 numbers on the bike (front plate and both side panels), ≥20 mm margin, no tape-made digits. „Наказанието за състезатели с неизрядни номера е забрана за стартиране и дисквалификация за конкретния състезателен ден“: a rider with non-compliant numbers may not start and is disqualified for that day.
- **Start order** (Р XI p.6):
  - Round 1: by the previous year's final standings. Riders with no standing start last, in an order drawn by lot. A Prologue may decide the order instead.
  - Later rounds, day 1: by the current championship standings. Riders not yet ranked start last, by lot.
  - „Редът на стартиране за различните класове … се уточнява в допълнителния регламент“: the order of classes is set per event, and it really varies. Examples:
    - Buhovo 2026: Про, Експерт, Сеньор 50+, Стандарт, Сеньор 40+, Джуниър стандарт, Жени, Джуниър, Адвенчър.
    - Kărnare 2026: Джуниър-Стандарт, Джуниър, Жени, Сеньор50, Про, Експерт, Сеньор 40+, Стандарт.
  - Enduro-cross grid: by the current navigation ranking, or by qualification (Р XII.6, XVI).
- **Start intervals** are not fixed in the rulebook. Observed:
  - 30 s per rider (Gabrovo 2026 start list: two riders per 30-second slot).
  - „Стартиране по двама през 30 секунди“ (Bansko 2026 D2, page-201).
  - 15 s per rider (Uran 2026 start list).
- **Start-list columns** (pantev.net PDFs, e.g. https://bgx.bg/d/file/StartList_Gb_8_2026.pdf): Поз, Ст.№, Състезател, Moto, Отбор, Старт (clock time), Рейтинг (championship rank; unranked riders appear as 1004, 1006… on the Uran list).

## 2. Race format

**Navigation, Day 1 or both days** (Р XIII–XV p.7–9):
- The rider follows the uploaded GPS track and/or the taped course.
- The organiser must mark every class's course along its full length (App.1 p.22): tape ≥40 mm wide, plus class-named arrow signs at splits, with an extra sign 50–100 m before the split.
- A track-less event is allowed if the course is fully taped. GPS is then used for control, and the rider must hand in the GPS immediately after the finish (Р XIII.5).
- „Всички специални етапи обозначени и маркирани като SS трябва да имат физическа контрола с отчитане на преминалите“: every special stage marked SS must have a physical control that records riders passing (Р XIII.8).
- One GPS may be shared by up to 3 Standard riders, if announced (Р XIII.7).
- **Recommended control:** at least one control with internet access for real-time reporting to race control and timing (Р X.4 p.6). This is directly relevant to live timing.
- **Refuelling** only in the fenced zone, engine off. Breaking this rule means DSQ (Р XV).
- **Waypoint vocabulary used in briefings:** SS_START/SS_FINAL, ATTENTION, STOP, DANGER, GATE, FINAL, Left-1…
- **Day structure example** (Buhovo 2026, page-196):
  - 08:00–08:30 technical control.
  - 08:30–09:00 GPS hand-out.
  - 09:00–09:15 opening and briefing.
  - 09:30 first rider starts.
  - 17:00 course closes.
  - Day 2: 15:30 course closes; 15:30–16:00 results and protests; 16:15–17:00 final results and prize-giving.
- **Friday** is registration plus GPS hand-in for track upload: „В събота записване и качване на трак няма да има“ (no registration or track upload on Saturday).
- **Distances** vary per class and per event. Buhovo 2026: 60–65 km, Women/Junior 33 km, ADV 62 km. Several classes often share one track.

**Enduro-cross, Day 2** (Р XVI p.9–13):
- Bikes start with GPS mounts removed.
- **Qualifying:** „Квалификационната тренировка за всеки клас е с времетраене 20 минути или по малко“ (20 minutes or less per class), ranked by best lap. Participation is mandatory. A rider with no qualifying result may not race the heats.
- **More than 20 entries in a class:** two groups, A and B, filled alternately by navigation rank (1st to A, 2nd to B, 3rd to A…). Qualifying is then 12–15 min per group, and the top 12 on best lap from either group go to the finals.
- **Finals:** 2 heats; the gate holds 12 riders in 2 rows of 6. Bikes must be in the pre-start area 5 min before the heat or the rider loses the heat. No reserves, no flying starts.
- **Recommended heat length** (Р XVI p.12):
  - „ПРО – 10 мин + 1 обиколка“ (10 min + 1 lap).
  - Експерт and Сеньор40+: 8 min + 1 lap.
  - Стандарт, Джуниър-Стандарт, Джуниър, Сеньор50+, Жени: 7 min + 1 lap.
- If qualifying is cancelled, the navigation finishing order is used, or the jury decides, e.g. by lot (Р XVI.8).
- The entire enduro-cross course is a „NO HELP ЗОНА“.
- Transponders are handed out „срещу лиценз“ (the rider's licence is held as a deposit) (event pages 195, 199).

**Prologue** (Р I.6 p.2): Friday only; no points; may set the navigation start order. Example, Kărnare 2022 (page-158): „Пролога определя стартовата позиция…“, riders start 30 s apart, ordered by the previous round's result.

**Not on bgx.bg:** no classic-enduro TC/time-card concept, no early/late arrival at time controls, no split into TC/SS/lap structures. Navigation is one elapsed-time run per day.

## 3. Timing rules

- **Navigation time = finish clock minus scheduled start**, plus penalties.
  - „Ако по някаква причина състезателят не може да стартира, времето му тече от момента, когато е трябвало да му бъде даден старт“: if a rider cannot start, his time runs from his scheduled start (Р XII.3 p.7; also XIX.3 and X.5).
  - A rider not ready because of a technical-control problem still has his time counted from the original slot (Р X.5).
- **Precision observed on result sheets** (pantev.net):
  - Navigation elapsed time is shown to the second (05:51:08); the Тотал column to the tenth (5:51:08.7).
  - Enduro-cross (MyLaps Orbits, "Licensed to: BFM") lap and total times to the thousandth (1:16.517).
  - The rulebook states no required precision.
- **Maximum time = course closing time („затваряне на трасето“)**, set per event. Examples: 17:00, 17:30, 18:00, 14:00, 13:30 for Day 2.
  - „Състезателят получава класиране само, ако има регистриран финал в редовното съдийско време за преодоляване на трасето, което е обявено в Допълнителния регламент“: a rider is classified only if he finishes within the official time announced in the supplementary regulation (Р XIX.5 p.18).
  - Botevgrad 2026: the organiser may extend the time limit up to 30 min before the first start.
- **Intermediate cut-offs** are per event. Examples:
  - „Презареждането затваря в 13:00 … не продължава, а се прибира по пътя“ (Botevgrad 2026): the refuel closes at 13:00; riders who miss it do not continue.
  - „Който не е стигнал до презареждането до 16:00 да не продължава“ (Bansko 2021, Stara Zagora 2022–2024).
- **Neutralised time:**
  - First aid given to an injured rider, and the time spent reporting it, is deducted from total time using the GPS log (Р XIV.7 p.8).
  - Kărnare 2026 Pro: „15 минути почивка която се приспада на всеки независимо дали е почивал или не“. A fixed 15-minute rest is deducted from every rider, whether they rested or not.
- **GPS hand-in:** „Тракове (GPS устройства) не се приемат по късно от 10 минути след финиширане“: no later than 10 minutes after finishing (Р XIII.6). The GPS must be handed in switched on, with charged batteries; the rider consents to its data being wiped (Р XIII.3–4).
- **Speed:** limit 50 km/h where a limit applies. „по 1 минута за всеки километър над 50. Не се смята средна скорост, а пикови показания на GPS“: 1 minute per km/h over 50, measured on GPS peak speed, not average (Р XIX.9, 12).
- **Enduro-cross classification:**
  - „Победител в даден манш е състезател направил най-много обиколки за най-малко време“: most laps, then least time.
  - „минимум една времеизмерена обиколка“ is needed to be classified in a heat (Р XVI p.11).
- **Red flag in a heat** (Р XVI p.11–12):
  - Fewer than 2 laps done: full restart, no bike change or refuelling, grid by qualifying.
  - Between 2 laps and 50%: full restart, refuelling allowed.
  - Over 50%: the heat counts, with the order taken from the lap before the red flag.
- **Result-sheet columns, navigation** (e.g. https://bgx.bg/d/file/KlasiraneNavigation_D1_Uran_9_2026.pdf):
  - Поз, Ст.№, Състезател, Moto, club.
  - Време (elapsed), start clock, finish clock.
  - GPS (penalty, e.g. 00:30:00), CP (split time at a control).
  - Об. (laps, =1), Тотал (elapsed + penalty, e.g. 4:23:59 + 0:30:00 = 4:53:59.8).
  - Gap to leader, points.
  - DNF block listed at the bottom.
  - Footer: "Chief referee:", print timestamp, www.pantev.net.

## 4. Classification rules

- „Индивидуалното класиране се води за всеки клас и кръг поотделно“: standings are kept per class and per round (Р XVIII p.14). There is **no overall-across-classes** individual ranking in the rules.
- **Day 1 navigation:** ranked by total time (elapsed + penalties) among finishers inside the time limit. Places 1–20 score points.
- **Day 2:**
  - Enduro-cross: each heat gives points, heat points are summed, the class is ranked on that sum, and the overall rank gives day points.
  - Or navigation Day 2, which uses the same 15-scale (see §7).
- **Round result:** „Победител в даден клас за дадено състезание е състезателят спечелил най голям сбор точки от Навигацията и Ендурокроса“: the class winner is the rider with the highest points total from navigation plus enduro-cross (Р XVIII p.15). Final sheet columns: Rnk, No, Rider, Moto, Entrant, ДЕН2, ДЕН1, Total.
- **Ties:**
  - Enduro-cross overall: better 2nd heat wins (Р XVI.3, XVIII).
  - Round final (Р XVIII.1 p.15): more navigation points wins; with two navigation days, more Day 1 points. Verified on the Gabrovo 2026 Pro sheet: #30 on 7+18=25 is placed ahead of #13 on 10+15=25.
  - Interim/final standings (Р XVIII.2), in order: more Day 1 navigation wins; then more enduro-cross/Day 2 wins; then better Day 1 placings; then better enduro-cross/Day 2 placings.
- **Classified:** a registered finish within the time limit (XIX.5). Minimum one timed lap per enduro-cross heat. Enduro-cross riders who miss qualifying or the pre-start deadline cannot race the heats.
- **DNF situations:**
  - DNF is listed separately on the sheets.
  - „Ако все пак състезател стартира [въпреки техническото лице], то той получава автоматичен DNF“: starting despite the technical official's objection gives an automatic DNF (Р X.5).
  - „Ако всички състезатели от даден клас се откажат да се състезават на ендурокрос, то същите получават DNF за двата дни“: if every rider in a class withdraws from enduro-cross, they all get DNF for both days (Р XIX.22).
  - Kărnare 2026: a bike entering the closed park the wrong way is DNF.
- **DNS:** no explicit rule. A rider not at the start has his time running from the scheduled slot (XIX.3).
- **DSQ:** see §5. DSQ can be for a day, a heat, or the whole event.
- **Event-specific rule, Vratsa 2026 (page-200):** „Класиране се прави при минимум един завършил състезател от клас. Ако няма такъв, класирането за деня се отменя за съответния клас“. A class is classified for the day only if at least one rider finishes; otherwise that day's classification is cancelled for the class.
- **Team classification** (Р p.16–17):
  - Only BFM-licensed clubs.
  - Classes counted: Про, Експерт and Стандарт only. For each class, the points of the club's best-placed rider are taken.
  - Clubs with 3 results rank above clubs with 2 or 1.
  - A rider who changes club mid-season brings no points to the new club, unless the old club was struck off.
- **Season:** see §7.

## 5. Penalties

Main list: Р XIX „ЗАБРАНИ И НАКАЗАНИЯ“ p.17–19. "Who applies" is **the Jury** (Р XXIII.4: „Налагането на наказания, разглеждане на протести“), on information from GPS control, stewards, the technical official and timing, who have no vote. Track penalties are computed from the GPS log.

| # | Infraction (Bulgarian wording, abbreviated) | Penalty | Source |
|---|---|---|---|
| 1 | Entry form or declaration missing, or false data | Not admitted | XIX.1 |
| 2 | Bike or equipment non-compliant | Not admitted until fixed | XIX.2, IX.7 |
| 3 | Non-compliant race numbers | No start plus DSQ for the day | VI.6 |
| 4 | Starting despite technical official's objection | Automatic DNF | X.5 |
| 5 | Late to start | Time runs from scheduled start | XIX.3, XII.3 |
| 6 | Track deviation 100–500 m | 30 min (unless a bigger penalty is set for that section) | XIX.4 |
| 7 | Deviation 500–1000 m | 2 h | XIX.4 |
| 8 | Deviation over 1000 m | DSQ | XIX.4 |
| 9 | No active GPS trace over 1000 m | DSQ | XIX.4 |
| 10 | GPS signal gap 100–500 m | 30 min | XIX.4 |
| 11 | GPS signal gap 500–1000 m | 2 h | XIX.4 |
| 12 | GPS signal gap over 1000 m | DSQ | XIX.4 |
| 13 | „Заобикаляне на задължителен участък“ (bypassing a mandatory section) | 1 h | XIX.7 |
| 14 | „Пропусната контрола“ (missed control) | 1 h | XIX.8 |
| 15 | Speeding over 50 km/h in a limited zone | 1 min per km/h over, peak GPS reading | XIX.9, 12 |
| 16 | Bike change during a race day | DSQ (and forbidden) | XIX.6, 19 |
| 17 | Refuelling outside the zone or with engine running | DSQ | XV.3 |
| 18 | Smoking in the refuel zone | DSQ | XIX.18 |
| 19 | Help to a rider on the enduro-cross course when not a safety situation | DSQ | XIX.13–14 |
| 20 | Missed enduro-cross obstacle („непреминато препятствие“) | 30 s | XIX.15 |
| 21 | „Излизане от лентите по време на затворения кръг“ (leaving the tapes on the closed loop) | 15 min | XIX.16 |
| 22 | „Опасно каране, предизвикало произшествие“ (dangerous riding causing an accident) | DSQ | XIX.17 |
| 23 | Abusive conduct toward riders, officials, organisers or public | DSQ from the event, or loss of racing rights per BFM rules | XIX.20 |
| 24 | Leaving the course without a finish and without telling the organiser | DSQ **plus ban from the next round** | XIX.21 |
| 25 | All riders of a class withdraw from enduro-cross | DNF both days | XIX.22 |
| 26 | Enduro-cross external assistance (repair, starting the bike), or team members in the gate area | DSQ (heat/session) | XVI.9, XVI p.11, App.4 |
| 27 | Enduro-cross unsportsmanlike stopping or waiting | From loss of best lap up to DSQ | XVI.7 |
| 28 | Deliberately delaying the enduro-cross start procedure | DSQ from that heat | XVI p.12 |
| 29 | Not in the pre-start area 5 min before a heat / not on the gate | Loses the heat | XVI p.11 |
| 30 | Bike or ATV in paddock or technical zone over 20 km/h | DSQ from the event | App.4 p.26 |
| 31 | Electronic communication with the team during sessions (except ADV) | DSQ for the whole event | App.4 p.26 |
| 32 | Entering the paddock during a session, then re-entering the enduro-cross course | DSQ in that session | App.4 p.27 |
| 33 | Washing bikes, or dumping oil, outside designated places | Fine of 50 EUR (monetary, not time) | App.4 p.26 |
| 34 | Any other matter | Jury may penalise under the BFM Disciplinary Code | XIX.23 |

**Procedural obligations tied to penalties:**
- „При отчитане на наказание за трак или скорост организатора се задължава да публикува освен трака и скрийншот на проблемното място“: for any track or speed penalty the organiser must publish the track plus a screenshot of the problem spot (XIX.10).
- Deviation is measured perpendicular from the track to the active log (XIX.11).

**Event-specific penalties** from supplementary regulations. They are set per event, so the system needs a configurable penalty catalogue:
- Bypassing an extreme or special stage: 10 min, 15 min, 30 min, 1 h, 2 h or 3 h depending on the event.
  - Examples: Buhovo 2026 Pro SS 1 h each, stage 2 2 h; Damascena 2026 Pro 3 h; Botevgrad 2026 30 min.
  - Botevgrad 2026: not passing the start special section costs 10 min.
- Leaving tapes in an SS: 15 min, 30 min, 1 h or DSQ.
  - Kărnare 2026: 1 h. Bansko 2021: „Който не мине по лентите ще бъде дисквалифициран“.
- Not stopping at a STOP sign: 5 min (Vratsa 2026), 10 min (Kărnare 2022), 20 min (Kărnare 2020).
- „свинска опашка“ (a tag tied to the bike at a control) missing: 30 min (Stara Zagora 2024–2025).
- Missing an RFID or chip control: 15 min (Varna 2024).
- Being helped on a NO HELP course: +1 h (Vratsa 2026). Evidence only by video or photo, and only before the official classification is published.
- Crossing asphalt where forbidden, or riding through crop fields: DSQ/DNF (Bansko 2021, Kărnare 2025).
- Six Days Crazy Job 2025 (page-192): „За 6Д наказанията от Ден 2 се намалят на половина“. For the six-day format, Day 2 penalties are halved.

## 6. Protests, appeals, provisional and official results

Р XX „КОНТЕСТАЦИИ/ПРОТЕСТИ“, p.19:
- **Form and fee:** written, handed to a member of the jury. „такса от 80 евро, като сумата се възстановява при уважаване“: a fee of 80 EUR, refunded if the protest is upheld.
- **One fact per protest:** „Всеки един протест/контестация може да бъде само срещу един факт/нарушение“.
- **Deadlines:**
  - Incidents on course or during heats (hold-ups, confusion, accidents): ≤30 min after the last rider finishes (XX.3).
  - Results: ≤30 min after official publication of the results (XX.4).
  - **Navigation: „до 2 часа след обявяването на резултатите и публикуването на траковете с наказанията“** (XX.5). Up to 2 h after results *and* the penalised tracks are published.
  - A rider's eligibility: before the race day, no later than 30 min before the first starter (XX.6).
  - Technical: ≤30 min after publication (XX.7).
- **Procedure:**
  - The jury meets in closed session and must hear all parties and witnesses.
  - The decision is given in writing to the rider or club within 24 h of filing.
  - The rider has the right of access to the information behind the decision.
- **Appeal:** under the BFM Disciplinary Code (XX.8). That code is not on bgx.bg.
- **Jury** (Р XXIII p.20–21):
  - Chairman (BG X representative, voting); member (BG X, voting); member (BG X or BFM, voting).
  - Non-voting advisers: Техническо лице, GPS контрол, Трасе координатор, Времеизмерване, Организатор.
  - The jury interprets the rulebook (XXIV).
  - Each 2026 event page names its "Жури към BGX". Examples: Kărnare 2026 Николай Славов, Бижо Бижев, Тодор Пашов; Vratsa 2026 Стоян Пачарозов, Николай Славов, Асан Имамов.
- **Who makes results official:** „Представител на Сдружение БГ Х ЕНДУРО в Журито (председателя на журито) одобрява и обявява резултатите за всеки кръг (след изтичане на времето за протест), води временно и годишно генерално класиране“ (Р I.4 p.1). The jury chairman approves and announces round results after the protest time expires, and keeps the interim and annual standings.
- **Provisional-to-official flow in 2026 programmes:**
  - Vratsa D1 (page-200): „19:00 обявяване на предварителни резултати / 19:00-20:00 Контестации / 20:00 – Официално класиране за деня“.
  - Bansko D1: 18:00 / 18:00–19:00 / 19:00.
  - Gabrovo D1: 17:30 provisional, 18:00 official.
  - Gorna Malina D1: 20:00 results, 20:00–20:30 written protests.
  - Day 2 is typically: preliminary results for day 2 and both days combined, plus protests, then official results and prize-giving.
- **Implication for the system:** result states Provisional, then Protest window (per-type deadlines, e.g. 30 min or 2 h), then Official (approved by jury chairman). Plus penalty evidence (track and screenshot) published with results.

## 7. Championship points

Р XVIII p.14–17. Tables confirmed with layout extraction and against 2026 result sheets.

- **Navigation (Day 1), places 1–20:** 25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1.
- **„ЗАТВОРЕНО ТРАСЕ – ЕНДУРОКРОС ИЛИ ВТОРИ ДЕН НАВИГАЦИЯ“, places 1–12:** 15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1.
  - Used per enduro-cross heat (seen on MyLaps heat sheets), again for the enduro-cross overall, and for navigation Day 2 (Gabrovo 2026 Day 2 column 15/12/10/9…).
- **Prologue:** no points.
- **Round total** = Day 1 points + Day 2 points (see §4 for ties).
- **Season:** „се взема в предвид общия брой на всички спечелени точки през сезона …, като от тях се премахва един най-лош резултат/едно състезание. Неучастието в даден кръг се счита за „най-лош резултат““ (Р XVIII.3). The worst single round is dropped, and a missed round counts as the worst result.
  - Verified on the 2025 final Pro sheet (https://bgx.bg/d/file/KrajnoKlasiraneBG-X_2025_1.pdf), #15 Мартин МАРИНОВ. Round sums 33, 37, 33, 29, 27, 40, 31 = 230; dropping the 27 gives the published 203.
- **Season standings sheet columns:** N, Ст.№, Състезател, Отбор, Мотор, Общо, then per round „Кр“ (enduro-cross/Day 2) and „Нв“ (navigation) points.
- **Team points per round:** places 1–20 get 30, 25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2; places 21–25 are listed as 1 point. The table has a typo: "22 Място" appears twice.
- **Team season:** the sum over all rounds, with no dropped result stated. Ties: more 1st places, then 2nd…; then the last round's placing.
- **Year-end:** top 3 per class are invited to the BFM awards ceremony (Р XVII.3).

## 8. Licensing and registration

- **Eligibility:**
  - „Всеки участник … трябва да притежава валиден състезателен лиценз за дисциплина Ендуро издаден от БФМ“ (a valid BFM Enduro competition licence) (page-130).
  - „Всеки чуждестранен състезател трябва да притежава състезателен лиценз към съответната федерация на страната си и позволително за стартиране (starting permission) издадено към БФМ“: a foreign rider needs a licence from his own federation plus a starting permission to BFM (page-130; Р I.3).
  - A motocross-only licence is not valid (FAQ, page-133).
  - Р III: „всяко дееспособно лице лицензирано при БФМ съобразно Наредбата на БФМ за 2026г.“ The BFM Наредба itself is not on bgx.bg.
- **Club:**
  - Licensing is done through BFM's online system https://my.bfm.bg/. A rider licenses **through a club**: the club must be licensed first and approves the rider's request (ИНФОРМАЦИЯ 26-001, https://bgx.bg/d/file/ИНФОРМАЦИЯ 26-001_12_01_2026.pdf, p.1–3).
  - Page-130: „Ако състезател желае да се лицензира а няма клуб, може да отправи запитване към един от лицензираните клубове“. A rider without a club may ask a licensed club to race for it.
  - So in practice **a club is required** for a BFM licence.
  - BFM approves requests 2–3 times a day on weekdays, roughly a 24 h turnaround.
  - **Steps:** profile, then data and documents, then club approval, then licence choice, then BFM approval, then payment of licence and insurance. „без да бъде платен … лицето не е лицензирано“: until paid, the person is not licensed.
- **Licence types and prices, 2026 BG-X / hard enduro** (ЦЕНИ ЛИЦЕНЗИ И ЗАСТРАХОВКИ СЕЗОН 2026, https://bgx.bg/d/file/ЦЕНИ ЛИЦЕНЗИ И ЗАСТРАХОВКИ СЕЗОН 2026.pdf, p.1):
  - ENDURO PROMO 30 EUR: Mini Junior, Junior, Junior Standard, Women, ADV.
  - ENDURO A 60 EUR: Pro (30 EUR for ages 16–18), Expert (30 EUR for ages 14–18).
  - ENDURO B 60 EUR: Standard (30 EUR for ages 14–18), Senior 40, Senior 50.
  - **ONE EVENT licence: 40 EUR**, all disciplines (p.3). Club licence 360 EUR.
  - Mandatory insurance (ОЗК АД): Variant 1/2 up to age 13: 70/120 EUR; age 14+: 95/145 EUR; one-event Bulgaria 25 EUR; one-event abroad 20 EUR; annual abroad 95 EUR.
  - Р IV.3: publicity must state „условията за изваждане на временен лиценз“ (the conditions for a temporary licence).
- **Minors:** a parent/guardian profile, plus a notarised consent declaration valid until 31.12.2026. Template: https://bgx.bg/d/file/ДЕКЛАРАЦИЯ 2026 - НЕПЪЛНОЛЕТНИ.pdf, which collects both parents' names, ЕГН (national ID number), ID card numbers, address, and the child's name and ЕГН.
- **Riders aged 60+** must contact BFM before licensing; no international licences are issued to them.
- **Race number:**
  - The rider picks a free number on https://bgx.bg/racenumbers.html. Unconfirmed requests older than 7 days are deleted automatically.
  - A number is released if the rider did not race at all in the previous year (Р VI.2).
  - Only after the number and name appear in the "taken numbers" table can the rider enter rounds (rideon-202.html).
- **Required rider data**, from the race-number registration form getnumber-*.html, all required:
  - Name and surname, date of birth (dd.mm.yyyy).
  - Club (select list of about 66 clubs).
  - Email, phone.
  - Motorcycle make/model („Марка и вид МПС“).
  - **Blood group** (A+ … AB-, "don't know").
  - Class, GPS make/model (Garmin models list or "other").
  - Race number (hidden field).
- **Per-event online entry** (rideon-XXX.html): the race number only. The public list of entries shows Номер, Клас, Клуб.
- **Taken-numbers registry columns:** #, Номер, Име, Клас, Клуб, МПС.
- **ADV extra data:** driving licence category A/A2, registration plate, civil liability insurance (App.3).
- **Entry deadline and fees:**
  - Online entry by Thursday 23:59 before the event (FAQ, and Р IV p.3); order printed number stickers by Tuesday 23:59.
  - Minimum entry fee 70 EUR. „Ако състезател няма online заявка до 23:59 в четвъртък … таксата му участие е + 25 евро“: without an online entry by Thursday 23:59 the fee is +25 EUR (Р IV p.3). The FAQ's "+10лв" is outdated.
  - Women, Mini Junior and Junior ride free. 2026 events charged 80 EUR, late fee 100–200 EUR.
  - The organiser pays BG X 20% of the entry fee (Р II.6).
- **Organiser registration sheet template** (https://bgx.bg/d/file/registerations-2022-1.pdf): columns #, Старт№, Клас, Такса, GPS.
- **Club–rider contract template:** https://bgx.bg/d/file/dogovor-sastezatel.docx (name, ЕГН, period).

## 9. Flags and signals

The rulebook defines very little:
- **Solo start** (navigation): „Старт се дава от стартерът със специализиран флаг“, a designated flag (Р XII.4 p.7).
- **Mass or group start:** „Старт се дава от стартерът със зелен флаг“ (Р XII.8).
- **Start-gate failure procedure** (Р XVI p.13): the race director shows a static, not waved, **green flag**, which starts the final phase. Dropping the green flag starts the race.
- **Red flag:** stops an enduro-cross heat, with the restart or result rules in §3 (Р XVI p.11–12).
- A rider with a technical problem on the gate must raise a hand.
- **No yellow, black, blue or chequered flag** meanings are defined anywhere on bgx.bg or in the rulebook.
- Course signage used instead: tape colours per class, class-named arrow signs (App.1), and GPS waypoints STOP / ATTENTION / DANGER / SS_START / SS_FINAL / GATE.
- **Implication:** TodorovNET's Event flag state (Green/Yellow/Red/Black) has no BG-X rule basis beyond green (start) and red (heat stopped). It is a product decision, not a rule.

## 10. Required documents, result formats, officials

- **Supplementary regulation („Допълнителен регламент“)** (Р IV p.2–3):
  - Mandatory, published at least 20 days before the event, approved by BG X and BFM, on a common template.
  - Must contain: programme; course info (length, difficulty); safety conditions; refuel points; entry fee; organiser and contacts.
  - Template: https://bgx.bg/common/d_images/src/file/dopalnitelen-reglament.doc. Its fields:
    - Announcement.
    - Officials with phone numbers: Директор на състезанието, Трасе координатор, Връзка със състезателите, Времеизмерване, GPS контрол.
    - Entry deadline and fee; administrative/technical control time and place.
    - Friday/Saturday/Sunday schedule with GPS coordinates.
    - Course lengths per class and refuel km.
    - Day 2 enduro-cross description.
    - Class start order.
    - Specific rules; accommodation.
  - Logos of BG X and BFM are mandatory (downloads on page-130).
- **Officials named on every 2026 event page:**
  - Организатор (club), Директор на състезанието, Трасе координатор(и).
  - **Времеизмерване: „Пантев Продукшън ЕООД“** (www.pantev.net) for all 2026 rounds.
  - GPS Контрол: Николай Куков.
  - Технически съдия/контрол (some events).
  - Жури към BGX (3 people).
- **Technical official** at the start (Р X.5), plus a start corridor fenced with tape (Р X.6). Technical control can be done right before each rider's start (Botevgrad 2026, citing Р IX). The helmet is inspected and marked with a sticker (Р IX.1).
- **Result documents published per round** (page-131 pattern). All PDFs are signed or labelled:
  - Navigation: "Chief referee:".
  - MyLaps enduro-cross sheets: "Chief of Timing & Scoring", "Race Director", "Licensed to: BFM".
  - Each sheet has a print timestamp and the pantev.net footer.

  | Document | Contents / columns |
  |---|---|
  | Предварителен стартов списък | Draft start list (some events) |
  | Стартов списък навигация (Ден1/Ден2) | Per class: Поз, Старт clock time, Ст.№, name, Moto, Отбор, Рейтинг |
  | Класиране навигация (Ден1/Ден2) | Per class: Поз, Ст.№, name/moto/club, elapsed, start, finish, GPS penalty, CP split, laps, total (0.1 s), gap, points; DNF list |
  | Класиране пролог | MyLaps "ПоВремеЗаОбиколка": Pos, No, Name, Class, Overall BestTm, session |
  | Класиране XCross / ендурокрос | Per class: qualifying sorted on best lap (Best Tm, Diff, Best Speed, In Lap, NAT, "Not classified" block); each race sorted on laps (Laps, Diff, Total Tm, Best Tm, Points, Club; margin of victory, avg speed, best lap by); Overall (Total points, R1, R2, Club, Make) |
  | Крайно класиране (round) | Page 1 team classification (club, per-class rider numbers Стандарт/Експерт/Профи, total, points); then per class Rnk, No, Rider, Moto, Entrant, ДЕН2, ДЕН1, Total |
  | Временно класиране след N-ти кръг / Крайно класиране BG-X <year> | Team season table, then per class N, Ст.№, name, club, bike, Общо, per round Кр/Нв |

- **Live data precedent:** Buhovo 2025 (page-189) published „On-Line резултати от контролите и финала“ in a Google Sheet. Р X.4 recommends an internet-connected control that reports passages in real time to race control and timing.
- **Medical minimum** (Р XXI p.19–20): navigation needs an ICU ambulance plus a 4x4 ambulance; enduro-cross needs an ICU ambulance plus an ambulance.

## 11. Calendar, clubs, other data

**2026 calendar** (page-130 sidebar and event pages), with the format and whether results were published by 2026-09-13:

| # | Event | Date | Place | Format | Results published |
|---|---|---|---|---|---|
| 1 | Хард Ендуро Кърнаре | 28–29.03 | Кърнаре | Навигация + Ендурокрос | yes |
| 2 | Hard Enduro Buhovo | 25–26.04 | Бухово | 2 дни навигация | yes |
| 3 | Hard Enduro Botevgrad | 09–10.05 | Ботевград | 2 дни навигация | yes |
| 4 | Disaster Forest Hard Enduro | 06–07.06 | Горна Малина (Осойца) | 2 дни навигация | yes |
| 5 | EnduroX Alba-Damascena | 20–21.06 | Скобелево | Навигация + Ендурокрос (+ADV) | yes |
| 6 | Hard Enduro Vratsa | 04–05.07 | Враца | 2 дни навигация | yes |
| 7 | Three Mountains Hard Enduro Bansko | 18–19.07 | Банско | 2 дни навигация | yes |
| 8 | Hard Enduro Uzana Gabrovo | 21–23.08 | Габрово | 2 дни навигация | yes; interim standings after round 8 |
| 9 | Uran Enduro | 11–13.09 | Сеславци | Пролог + навигация + GNCC | Prologue and Day 1 only so far |
| 10 | Хард Ендуро Кирково | 26–27.09 | Кирково | Навигация + Ендурокрос | "Очаквайте повече информация" (more info to come) |
| – | Отборно Копринка (team fun event) | 31.10 | яз. Копринка | team, non-championship | – |

- **Older calendars:** cat-22 (2019) … cat-32 (2025). Every round 2019–2025 has start-list, navigation, enduro-cross and final PDFs linked on page-131.
- The 2025 final standings cover 7 rounds: Кърнаре, Ст. Загора/CrazyJob, Бухово, Г. Малина, Дамасцена, Six Days Crazy Job (Габрово), Кирково.
- Inconsistency in the site's own data: page-131 dates Kirkovo 2025 as 20–21.09, while the final standings header says 08–09/11.
- 2018 standings are on pantev.net (not bgx.bg).
- **"Весело отборно състезание" team events** (page-134, 156, 169, 176, 186, 194, 205) use their own rules: whole team at every control, a control stamp or card, and „Контролата има право да ви даде DNF“ (the control marshal may give a DNF on the spot). They are not championship rounds.
- **Clubs:**
  - page-132 lists 21 clubs as "Клубове участници".
  - The race-number form has a longer list of about 66 club names (§8).
  - 2026 team standings list 38 clubs, including Masterbike Club Romania, Go Racing Club Romania and ΑΜΟΤΟΕ (Greek). Foreign riders do appear.
- **Rider registry:** https://bgx.bg/racenumbers.html, a table of taken numbers (number, name, class, club, bike). Number 1 is "Резервиран" (reserved, champion).
- **Other rules worth modelling:**
  - Riding the course before the event is banned. Buhovo 2026: a licensed rider seen on the tracks between 18.04 and 24.04 „няма да получи старт“ (will not be allowed to start).
  - Closed park (parc fermé) rules per event: no repairs; a bike cannot leave before 08:00.
  - Quiet hours 22:00–06:00; a fire extinguisher of at least 3 kg in each box; no children under 7 or dogs in the pre-start area (App.4).
  - Rounds must be in the BFM calendar. Organisers apply by 15 December. A postponed round needs 14 days of spacing (Р II).

---

## What I read vs. what I could not access or is missing

**Read in full:**
- The 2026 Правилник (27 p., all appendices).
- ИНФОРМАЦИЯ 26-001 (BFM licensing), 2026 licence and insurance prices, minors' declaration, registration sheet template, supplementary-regulation template (.doc), club contract (.docx).
- page-130 (Documents / participation), page-133 (FAQ), page-131 (results index), page-132 (clubs), page-128 (about), racenumbers.html, the getnumber and rideon forms.
- All 2026 event pages (195–205).
- All 2019–2025 event pages: grep for penalty, time-limit, protest and prologue wording, plus full reads of several.
- Result PDFs sampled for format: Gabrovo 2026 start list, day and final sheets; Gorna Malina 2026 navigation; Buhovo 2026 D2; Damascena 2026 X-Cross and final; Uran 2026 prologue, start list and navigation; interim standings after round 8, 2026; 2025 final standings.

**Not accessed or not on bgx.bg:**
- **БФМ Наредба 2026** (general competition regulation, referenced by Р III and XXIII) and **the BFM Disciplinary Code** (appeals, Р XX.8, XIX.23). Both are on bfm.bg/documents; not read.
- BFM Technical Bulletin 2026 (helmet standards, Р IX.1).
- Attachment "Класове и възрастови групи 2026" (a BFM age-group list).
- Р Appendix 2 (number colours) is an image only; the colours are taken from the text in Р VI.4.
- uran-enduro.com: GNCC and prologue rules for round 9.
- Kirkovo 2026 supplementary regulation (not yet published).
- Google Drive track folders; historic Google Sheets entry lists.
- Not every one of the ~140 result PDFs was read individually.

**Rules the site simply does not define** (gaps the system must treat as configurable or product decisions):
- Time controls with early/late arrival windows (classic enduro TC) do not exist in this format.
- Required timing precision is not stated. Observed: 0.1 s for navigation, 0.001 s for MyLaps.
- No tie-break for equal navigation *times*.
- No explicit DNS definition or DNS handling in points.
- No yellow, black or blue flag.
- No definition of "overall" across classes.
- No minimum number of rounds to appear in season standings.
- Handling of riders placed 21st+ (navigation) or 13th+ (Day 2) is implicit: 0 points.
- Special stages have no separate time: they are pass/fail with a time penalty.
- Penalty values for bypasses, STOP signs and tape exits are set per event, not in the rulebook.
- There is an "Adventure" class but ADV results on sheets appear under navigation Day 2 headings. Its scoring is not separately defined.

## Direct implications for the TodorovNET data model

1. **Standings must be points-based.**
   - Day 1 navigation: rank by (elapsed + penalties), then the 25-scale.
   - Day 2: enduro-cross heats (laps desc, time asc), heat points on the 15-scale, overall by points sum with 2nd heat as tie-break, then the 15-scale again. Or navigation Day 2 on the 15-scale.
   - Round total by points, with the tie-break chain.
   - Season: sum minus worst round (a missed round counts as worst).
   - A separate team standing (Pro/Expert/Standard best per club, 30-25-22… scale).
2. **Classes to seed:** Про, Експерт, Стандарт, Сеньор 40+, Сеньор 50+, Жени, Джуниър-Стандарт, Джуниър, Мини Джуниър, Адвенчър. Each needs min/max age, engine limits, number colours, licence type (PROMO/A/B), free-entry flag, team-eligible flag. Class start order is per event, not a class property.
3. **Segments:**
   - Navigation (per class track length, refuel km, time limit or course-close clock time, cut-offs, neutralised time).
   - Enduro-cross (qualifying sessions and groups A/B, 2 heats, heat length "N min + 1 lap" per class, gate of 12).
   - Prologue (no points, sets start order).
   - SS as mandatory *controls* with penalty, not timed stages.
   - Control points (CP) with split times, for live timing.
4. **Result statuses:** Finished/Classified, Not classified (enduro-cross heat with no timed lap, or navigation finish outside time limit), DNF, DSQ with scope (day / heat / event / event + next-round ban). DNS is implicit.
5. **Penalties:** a time-penalty catalogue with defaults from Р XIX (distance brackets for deviation and GPS gap, 1 h bypass, 1 h missed control, 1 min per km/h speeding, 30 s missed enduro-cross obstacle, 15 min tape exit), per-event overrides, DSQ-type penalties, monetary fines. The jury is the applier. Track and screenshot evidence must be attached before publishing.
6. **Protests:** 80 EUR fee, refunded if upheld; type-specific deadlines (30 min / 2 h after publication of results and penalised tracks / 30 min before first start); one fact per protest; decision in writing within 24 h; jury of 3 voting members; appeal under the BFM Disciplinary Code.
7. **Result lifecycle:** Provisional, then Protest window, then Official (approved by jury chairman), then Interim season standings.
8. **Rider fields:**
   - Race number (registry, confirmation), name, birth date (drives class age checks), club (required, BFM-licensed), email, phone, bike, blood group, GPS model.
   - Licence type (annual PROMO/A/B, ONE EVENT, foreign licence + starting permission).
   - ADV: driving licence category, plate, insurance.
   - Minor: parental declaration.
