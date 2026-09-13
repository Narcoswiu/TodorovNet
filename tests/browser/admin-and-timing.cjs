// Real-browser test of the admin panel and the timing app. Needs `npx supabase db reset` (demo seed) and the app running.
// Run: APP=http://localhost:3000 npm run test:browser   (use a production build to test offline reopening)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const puppeteer = require("puppeteer-core");

const APP = process.env.APP ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const OUT = require("os").tmpdir();
const results = [];

const sql = (query) => execSync(`psql "${DB}" -Atc "${query.replace(/"/g, '\\"')}"`).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push(`PASS  ${name}${detail ? "  — " + detail : ""}`);
    return true;
  } catch (error) {
    results.push(`FAIL  ${name}  — ${String(error.message || error).split("\n")[0]}`);
    return false;
  }
}

const waitText = (page, text, timeout = 15000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);

const waitPath = (page, predicate, timeout = 15000) =>
  page.waitForFunction(predicate, { timeout });

/** Fill the form whose submit button has `buttonText`, then click it. */
async function submitForm(page, buttonText, values = {}, files = {}) {
  const formIndex = await page.evaluate(
    (label, values) => {
      const forms = [...document.querySelectorAll("form")];
      const index = forms.findIndex((form) =>
        [...form.querySelectorAll("button[type=submit]")].some((b) => b.textContent.trim() === label),
      );
      if (index < 0) throw new Error(`no form with button "${label}"`);
      const form = forms[index];
      for (const [name, value] of Object.entries(values)) {
        const fields = form.querySelectorAll(`[name="${name}"]`);
        if (!fields.length) throw new Error(`no field ${name}`);
        for (const field of fields) {
          if (field.type === "checkbox") field.checked = Array.isArray(value) ? value.includes(field.value) : !!value;
          else field.value = value;
        }
      }
      return index;
    },
    buttonText,
    values,
  );
  for (const [name, file] of Object.entries(files)) {
    const handles = await page.$$("form");
    const input = await handles[formIndex].$(`input[name="${name}"]`);
    await input.uploadFile(file);
  }
  await page.evaluate(
    (index, label) => {
      const form = document.querySelectorAll("form")[index];
      [...form.querySelectorAll("button[type=submit]")].find((b) => b.textContent.trim() === label).click();
    },
    formIndex,
    buttonText,
  );
}

async function clickButton(page, text, within) {
  await page.evaluate(
    (label, scope) => {
      const root = scope ? [...document.querySelectorAll("li, tr")].find((el) => el.innerText.includes(scope)) : document;
      if (!root) throw new Error(`no row containing "${scope}"`);
      const button = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
      if (!button) throw new Error(`no button "${label}"`);
      button.click();
    },
    text,
    within ?? null,
  );
}

async function login(context, email, next) {
  const page = await context.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(`${APP}/bg/login?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle2" });
  await submitForm(page, "Вход", { email, password: "demo-todorovnet" });
  await waitPath(page, `location.pathname === ${JSON.stringify(next)}`);
  return page;
}

// Windows-1251 CSV, the way Excel on Bulgarian Windows saves it.
function cp1251(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 128) bytes.push(code);
    else if (code >= 0x410 && code <= 0x44f) bytes.push(code - 0x410 + 0xc0);
    else if (char === "№") bytes.push(0xb9);
    else throw new Error(`no cp1251 byte for ${char}`);
  }
  return Buffer.from(bytes);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-first-run"] });
  const stamp = Date.now().toString().slice(-5);
  const eventName = `Тест събитие ${stamp}`;

  // ───────────── Administrator ─────────────
  const adminContext = await browser.createBrowserContext();
  let admin;
  await step("admin signs in through the login form", async () => {
    admin = await login(adminContext, "admin@demo.local", "/bg/admin");
  });

  let eventId;
  await step("create an event (redirects to classes)", async () => {
    await admin.goto(`${APP}/bg/admin/events/new`, { waitUntil: "networkidle2" });
    await submitForm(admin, "Създай", {
      name: eventName,
      location: "Тестово",
      date_from: "2026-10-10",
      date_to: "2026-10-11",
      kind: "championship_round",
      round_number: "11",
      status: "upcoming",
    });
    await waitPath(admin, `/\\/admin\\/events\\/\\d+\\/classes$/.test(location.pathname)`);
    eventId = Number(admin.url().match(/events\/(\d+)/)[1]);
    return `event ${eventId}`;
  });

  await step("choose classes Pro and Expert", async () => {
    const ids = sql(`select string_agg(id::text, ',') from classes where code in ('pro','exp') and season_id = (select id from seasons where year = 2026)`).split(",");
    await submitForm(admin, "Запази", { class_id: ids });
    await waitText(admin, "Запазено.");
    return `event_classes=${sql(`select count(*) from event_classes where event_id = ${eventId}`)}`;
  });

  await step("update event settings", async () => {
    await admin.goto(`${APP}/bg/admin/events/${eventId}/settings`, { waitUntil: "networkidle2" });
    await submitForm(admin, "Запази", { location: "Тестово поле" });
    await waitText(admin, "Запазено.");
    if (sql(`select location from events where id = ${eventId}`) !== "Тестово поле") throw new Error("location not saved");
  });

  await step("add one entry by hand", async () => {
    await admin.goto(`${APP}/bg/admin/events/${eventId}/entries`, { waitUntil: "networkidle2" });
    await submitForm(admin, "Добави участник", {
      race_number: "500",
      first_name: "Ръчен",
      last_name: "Участник",
      class: "pro",
      club: "Ръчен МК",
      birth_date: "1995-03-04",
    });
    await waitText(admin, "Запазено.");
    await waitText(admin, "Ръчен МК");
  });

  await step("import CSV in Windows-1251 with one bad row", async () => {
    const file = path.join(OUT, "entries-1251.csv");
    fs.writeFileSync(
      file,
      cp1251("Ст.№;Име;Фамилия;Клас;Клуб;Държава\r\n501;Тест;Първи;Про;Тест МК;BG\r\n502;Test;Second;Expert;Test MC;RO\r\n503;Грешен;Клас;Мотокрос;;BG\r\n"),
    );
    const input = await admin.$('input[type="file"]');
    await input.uploadFile(file);
    await waitText(admin, "3 реда са готови за импорт");
    await clickButton(admin, "Импортирай");
    await waitText(admin, "Добавени: 2 · Обновени: 0 · С грешки: 1");
    await waitText(admin, "Ред 3:");
    const names = sql(`select string_agg(r.first_name, ',' order by e.race_number) from entries e join riders r on r.id = e.rider_id where e.event_id = ${eventId} and e.race_number in (501,502)`);
    if (names !== "Тест,Test") throw new Error(`cyrillic decoded wrong: ${names}`);
    return "Cyrillic decoded correctly";
  });

  await step("import .xlsx (update existing number + new rider)", async () => {
    const writeXlsxFile = (await import("write-excel-file/node")).default;
    const file = path.join(OUT, "entries.xlsx");
    await writeXlsxFile([
      [{ value: "Номер" }, { value: "Състезател" }, { value: "Клас" }, { value: "Клуб" }, { value: "Рождена дата" }],
      [{ value: 501 }, { value: "Тест Първи-Обновен" }, { value: "pro" }, { value: "Тест МК" }, { value: "01.02.1990" }],
      [{ value: 504 }, { value: "Ексел Нов" }, { value: "exp" }, { value: "" }, { value: "" }],
    ]).toFile(file);
    if (!fs.existsSync(file)) throw new Error("test could not write the .xlsx file");
    await admin.reload({ waitUntil: "networkidle2" });
    const input = await admin.$('input[type="file"]');
    await input.uploadFile(file);
    await waitText(admin, "2 реда са готови за импорт");
    await clickButton(admin, "Импортирай");
    await waitText(admin, "Добавени: 1 · Обновени: 1 · С грешки: 0");
    const last = sql(`select r.last_name from entries e join riders r on r.id = e.rider_id where e.event_id = ${eventId} and e.race_number = 501`);
    if (last !== "Първи-Обновен") throw new Error(`full name split wrong: ${last}`);
  });

  await step("withdraw and reinstate an entry", async () => {
    await admin.reload({ waitUntil: "networkidle2" });
    await clickButton(admin, "Оттегли", "504");
    await admin.waitForFunction(() => [...document.querySelectorAll("tr")].some((tr) => tr.innerText.includes("504") && tr.innerText.includes("Върни")), { timeout: 15000 });
    if (sql(`select withdrawn from entries where event_id = ${eventId} and race_number = 504`) !== "t") throw new Error("not withdrawn");
    await clickButton(admin, "Върни", "504");
    await admin.waitForFunction(() => [...document.querySelectorAll("tr")].some((tr) => tr.innerText.includes("504") && tr.innerText.includes("Оттегли")), { timeout: 15000 });
  });

  let stageId;
  await step("create a navigation stage (redirects to stage page)", async () => {
    await admin.goto(`${APP}/bg/admin/events/${eventId}/stages`, { waitUntil: "networkidle2" });
    await submitForm(admin, "Създай", {
      day_number: "1",
      type: "navigation",
      name: "Ден 1 · Навигация",
      points_scale: "bgx_navigation_day1",
      first_start_at: "2026-10-10T09:00",
      course_closes_at: "2026-10-10T16:00",
      start_interval_seconds: "30",
      riders_per_slot: "2",
    });
    await waitPath(admin, `/\\/stages\\/\\d+$/.test(location.pathname)`);
    stageId = Number(admin.url().match(/stages\/(\d+)/)[1]);
    const start = sql(`select to_char(first_start_at at time zone 'Europe/Sofia', 'YYYY-MM-DD HH24:MI') from stages where id = ${stageId}`);
    if (start !== "2026-10-10 09:00") throw new Error(`time zone conversion wrong: ${start}`);
    return `first start stored as ${start} Sofia time`;
  });

  await step("per-class settings: Pro 1 per slot, Expert after 2 min gap", async () => {
    const [pro, exp] = sql(`select string_agg(c.id::text, ',' order by c.sort_order) from classes c where c.code in ('pro','exp') and c.season_id = (select id from seasons where year = 2026)`).split(",");
    const buttons = await admin.$$eval("form", (forms) => forms.length);
    if (buttons < 2) throw new Error("class settings form missing");
    await admin.evaluate(
      (pro, exp) => {
        const set = (name, value) => (document.querySelector(`[name="${name}"]`).value = value);
        set(`riders_per_slot_${pro}`, "1");
        set(`gap_${exp}`, "120");
        set(`distance_${pro}`, "62,5");
      },
      pro,
      exp,
    );
    // Second "Запази" on the page belongs to the class settings form.
    await admin.evaluate(() => {
      const form = [...document.querySelectorAll("form")].find((f) => f.querySelector('[name^="gap_"]'));
      [...form.querySelectorAll("button[type=submit]")][0].click();
    });
    await sleep(1500);
    const row = sql(`select riders_per_slot || '/' || distance_km from stage_classes where stage_id = ${stageId} and class_id = ${pro}`);
    if (row !== "1/62.5") throw new Error(`settings not saved: ${row}`);
    return "decimal comma accepted";
  });

  await step("add a checkpoint", async () => {
    await submitForm(admin, "Добави контрола", { code: "cp1", name: "Контрола 1" });
    await waitText(admin, "CP1");
  });

  await step("generate the start list", async () => {
    await submitForm(admin, "Генерирай стартовия списък");
    await waitText(admin, "Готово: 4 състезатели в стартовия списък.");
    const slots = sql(`select string_agg(e.race_number || '@' || to_char(ss.scheduled_start at time zone 'Europe/Sofia', 'HH24:MI:SS'), ' ' order by ss.position) from start_slots ss join entries e on e.id = ss.entry_id where ss.stage_id = ${stageId}`);
    if (slots !== "500@09:00:00 501@09:00:30 502@09:03:00 504@09:03:00") throw new Error(`unexpected slots ${slots}`);
    return slots;
  });

  await step("generating without a first start time is refused with a clear message", async () => {
    sql(`update stages set first_start_at = null where id = ${stageId}`);
    await admin.reload({ waitUntil: "networkidle2" });
    await submitForm(admin, "Генерирай стартовия списък");
    await waitText(admin, "Първо задайте час на първия старт.");
    sql(`update stages set first_start_at = '2026-10-10 09:00+03' where id = ${stageId}`);
  });

  await step("enduro-cross stage: create sessions", async () => {
    await admin.goto(`${APP}/bg/admin/events/${eventId}/stages`, { waitUntil: "networkidle2" });
    await submitForm(admin, "Създай", { day_number: "2", type: "enduro_cross", name: "Ден 2 · Ендурокрос", points_scale: "bgx_closed_course" });
    await waitPath(admin, `/\\/stages\\/\\d+$/.test(location.pathname)`);
    await submitForm(admin, "Създай квалификация и 2 манша за всеки клас");
    await waitText(admin, "Сесиите са създадени.");
    const sessions = sql(`select string_agg(kind::text || number || ':' || duration_minutes, ',' order by class_id, kind, number) from sessions s join stages st on st.id = s.stage_id where st.event_id = ${eventId}`);
    if (sessions !== "qualifying1:20,heat1:10,heat2:10,qualifying1:20,heat1:8,heat2:8") throw new Error(sessions);
    return "Pro 10 min, Expert 8 min, qualifying 20 min";
  });

  await step("staff: assign by email, unknown email explained, remove", async () => {
    await admin.goto(`${APP}/bg/admin/events/${eventId}/staff`, { waitUntil: "networkidle2" });
    await submitForm(admin, "Добави към екипа", { email: "nobody@demo.local", role: "timekeeper" });
    await waitText(admin, "Няма акаунт с този имейл.");
    await submitForm(admin, "Добави към екипа", { email: "timer@demo.local", role: "timekeeper" });
    await waitText(admin, "Демо Хронометрист");
    await clickButton(admin, "Премахни", "Демо Хронометрист");
    await admin.waitForFunction(() => !document.body.innerText.includes("Демо Хронометрист"), { timeout: 15000 });
  });

  await step("English admin page renders translated", async () => {
    await admin.goto(`${APP}/en/admin/events/${eventId}/entries`, { waitUntil: "networkidle2" });
    await waitText(admin, "Import from Excel or CSV");
  });

  // ───────────── GPS judge and jury on the demo event ─────────────
  const demoEvent = Number(sql(`select id from events where name = 'Демо Хард Ендуро'`));
  const demoStage = Number(sql(`select id from stages where event_id = ${demoEvent} and type = 'navigation'`));
  const raceNumber = sql(`select race_number from entries where event_id = ${demoEvent} and race_number = 307`);

  const gpsContext = await browser.createBrowserContext();
  let gps;
  await step("GPS judge proposes a penalty; cannot confirm", async () => {
    gps = await login(gpsContext, "gps@demo.local", "/bg/admin");
    await gps.goto(`${APP}/bg/admin/events/${demoEvent}/penalties`, { waitUntil: "networkidle2" });
    const typeId = sql(`select id from penalty_types where event_id is null and code = 'bypass_mandatory'`);
    await submitForm(gps, "Предложи наказание", { stage_id: String(demoStage), race_number: raceNumber, penalty_type_id: typeId, note: `browser test ${stamp}` });
    await waitText(gps, `browser test ${stamp}`);
    const hasConfirm = await gps.evaluate((s) => {
      const row = [...document.querySelectorAll("li")].find((li) => li.innerText.includes(s));
      return [...row.querySelectorAll("button")].some((b) => b.textContent.trim() === "Потвърди");
    }, `browser test ${stamp}`);
    if (hasConfirm) throw new Error("GPS judge was shown a confirm button");
  });

  await step("unknown race number is explained", async () => {
    const typeId = sql(`select id from penalty_types where event_id is null and code = 'missed_control'`);
    await submitForm(gps, "Предложи наказание", { stage_id: String(demoStage), race_number: "9999", penalty_type_id: typeId });
    await waitText(gps, "Няма участник с номер 9999.");
  });

  const juryContext = await browser.createBrowserContext();
  await step("jury confirms the proposed penalty and sets DNF", async () => {
    const jury = await login(juryContext, "jury@demo.local", "/bg/admin");
    await jury.goto(`${APP}/bg/admin/events/${demoEvent}/penalties`, { waitUntil: "networkidle2" });
    await clickButton(jury, "Потвърди", `browser test ${stamp}`);
    await jury.waitForFunction(
      (s) => [...document.querySelectorAll("li")].some((li) => li.innerText.includes(s) && li.innerText.includes("Потвърдено")),
      { timeout: 15000 },
      `browser test ${stamp}`,
    );
    const status = sql(`select status || '/' || seconds from penalties where note = 'browser test ${stamp}'`);
    if (status !== "confirmed/3600.000") throw new Error(status);
    await submitForm(jury, "Задай статус", { stage_id: String(demoStage), race_number: "308", status: "dnf", reason: "счупен мотор" });
    await waitText(jury, "счупен мотор");
    const result = sql(`select result_status from navigation_results where stage_id = ${demoStage} and race_number = 308`);
    if (result !== "dnf") throw new Error(`standings show ${result}`);
    return "public standings show DNF";
  });

  // ───────────── Timekeeper: timing app, offline and back ─────────────
  const timerContext = await browser.createBrowserContext();
  let timer;
  // Two riders with no finish yet, whatever earlier runs recorded.
  const riders = sql(
    `select string_agg(race_number::text, ',') from (select e.race_number from entries e where e.event_id = ${demoEvent} and not e.withdrawn and not exists (select 1 from passings p where p.entry_id = e.id and p.stage_id = ${demoStage} and p.point = 'finish' and p.voided_at is null) order by e.race_number limit 2) r`,
  ).split(",");
  if (riders.length < 2) throw new Error("demo data exhausted: run `npx supabase db reset`");

  const typeNumber = async (page, number) => {
    await clickButton(page, "C");
    for (const digit of number) await clickButton(page, digit);
  };

  await step("timekeeper records a finish in the timing app", async () => {
    timer = await login(timerContext, "timer@demo.local", "/bg/t");
    await timer.setViewport({ width: 400, height: 900 });
    await waitText(timer, "Запиши");
    await typeNumber(timer, riders[0]);
    await clickButton(timer, "Запиши");
    await waitText(timer, "Записано");
    const count = sql(`select count(*) from passings p join entries e on e.id = p.entry_id where p.stage_id = ${demoStage} and e.race_number = ${riders[0]} and p.point = 'finish' and p.voided_at is null and p.source = 'device'`);
    if (count !== "1") throw new Error(`finish rows ${count}`);
    return `#${riders[0]}`;
  });

  await step("offline: record is kept on the phone, sent when back online", async () => {
    await timer.setOfflineMode(true);
    await sleep(500);
    await typeNumber(timer, riders[1]);
    await clickButton(timer, "Запиши");
    await waitText(timer, "Чака връзка");
    await sleep(1500);
    const whileOffline = sql(`select count(*) from passings p join entries e on e.id = p.entry_id where p.stage_id = ${demoStage} and e.race_number = ${riders[1]} and p.point = 'finish' and p.voided_at is null`);
    if (whileOffline !== "0") throw new Error("reached the server while offline?");
    await timer.setOfflineMode(false);
    await timer.waitForFunction(() => !document.body.innerText.includes("Чака връзка"), { timeout: 30000 });
    const afterOnline = sql(`select count(*) from passings p join entries e on e.id = p.entry_id where p.stage_id = ${demoStage} and e.race_number = ${riders[1]} and p.point = 'finish' and p.voided_at is null`);
    if (afterOnline !== "1") throw new Error(`rows after reconnect ${afterOnline}`);
    return `#${riders[1]} synced once`;
  });

  await step("duplicate finish is shown as rejected, not saved", async () => {
    await typeNumber(timer, riders[0]);
    await clickButton(timer, "Запиши");
    await waitText(timer, "Вече има запис за този участник на тази точка");
  });

  await step("timing app reopens offline (service worker)", async () => {
    await sleep(1000);
    await timer.setOfflineMode(true);
    await timer.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await waitText(timer, "Запиши", 20000);
    await timer.setOfflineMode(false);
  });

  await timer?.screenshot({ path: path.join(OUT, "timing-app.png") }).catch(() => undefined);
  await browser.close();
  console.log(results.join("\n"));
  process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
})().catch(async (error) => {
  console.log(results.join("\n"));
  console.error("CRASH", error);
  process.exit(2);
});
