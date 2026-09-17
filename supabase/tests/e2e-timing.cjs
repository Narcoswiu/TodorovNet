// End-to-end check of the timing flow through the real API, as the app uses it.
// Needs the local stack with the demo seed: `npx supabase db reset`, then `npm run e2e`.
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);

async function signedIn(email) {
  const client = createClient(URL, KEY, opts);
  const { error } = await client.auth.signInWithPassword({ email, password: "demo-todorovnet" });
  if (error) throw new Error(`${email}: ${error.message}`);
  return client;
}

(async () => {
  const anon = createClient(URL, KEY, opts);
  const { data: event } = await anon.from("events").select("id").eq("name", "Демо Хард Ендуро").single();
  const eventId = event.id;

  // A public viewer subscribes to live changes before anything is recorded.
  let liveEvent = null;
  let resolveLive;
  const gotLive = new Promise((resolve) => (resolveLive = resolve));
  await new Promise((subscribed) => {
    anon
      .channel("e2e")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "passings", filter: `event_id=eq.${eventId}` }, (payload) => {
        liveEvent = payload;
        resolveLive();
      })
      .subscribe((status) => status === "SUBSCRIBED" && subscribed());
  });
  // The server confirms the join before the change listener is attached; right after
  // `supabase db reset` Realtime also rebuilds its replication slot, which takes a few seconds.
  await new Promise((r) => setTimeout(r, 3000));

  const timer = await signedIn("timer@demo.local");
  const gps = await signedIn("gps@demo.local");
  const jury = await signedIn("jury@demo.local");

  const { data: onCourse } = await anon
    .from("navigation_results")
    .select("entry_id, stage_id, race_number")
    .eq("event_id", eventId)
    .eq("result_status", "on_course")
    .limit(1);
  check("public sees riders on course", onCourse?.length === 1, onCourse?.[0] && `#${onCourse[0].race_number}`);
  const rider = onCourse[0];

  const clientId = crypto.randomUUID();
  const row = {
    client_id: clientId,
    event_id: eventId,
    stage_id: rider.stage_id,
    entry_id: rider.entry_id,
    point: "finish",
    passed_at: new Date().toISOString(),
    source: "device",
  };

  const first = await timer.from("passings").insert(row);
  check("timekeeper records a finish", !first.error, first.error?.message);

  const retry = await timer.from("passings").insert(row);
  check(
    "offline retry with the same client_id is not duplicated",
    retry.error?.code === "23505" && retry.error.message.includes("client_id"),
    retry.error?.message,
  );

  const second = await timer.from("passings").insert({ ...row, client_id: crypto.randomUUID() });
  check(
    "second active finish for the same rider is rejected",
    second.error?.code === "23505" && second.error.message.includes("one_active"),
    second.error?.message,
  );

  const anonWrite = await anon.from("passings").insert({ ...row, client_id: crypto.randomUUID() });
  check("public cannot write timing", !!anonWrite.error, anonWrite.error?.code);

  await Promise.race([gotLive, new Promise((r) => setTimeout(r, 8000))]);
  check("public receives the finish live (realtime)", liveEvent?.new?.client_id === clientId);

  const { data: after } = await anon
    .from("navigation_results")
    .select("result_status, position, total_s")
    .eq("stage_id", rider.stage_id)
    .eq("entry_id", rider.entry_id)
    .single();
  check(
    "standings update from the new finish",
    after?.result_status === "classified" || after?.result_status === "nc",
    JSON.stringify(after),
  );

  // Penalty review: the GPS judge proposes but cannot confirm; the jury confirms.
  const { data: missedControl } = await gps
    .from("penalty_types")
    .select("id")
    .is("event_id", null)
    .eq("code", "missed_control")
    .single();
  const { data: proposed, error: proposeError } = await gps
    .from("penalties")
    .insert({ event_id: eventId, stage_id: rider.stage_id, entry_id: rider.entry_id, penalty_type_id: missedControl.id, note: "e2e" })
    .select("id, status, seconds");
  check(
    "GPS judge proposes a penalty (seconds frozen from the catalogue)",
    proposed?.[0]?.status === "proposed" && Number(proposed[0].seconds) === 3600,
    proposeError?.message,
  );
  const gpsConfirm = await gps.from("penalties").update({ status: "confirmed" }).eq("id", proposed[0].id);
  check("GPS judge cannot confirm a penalty", !!gpsConfirm.error, gpsConfirm.error?.message);
  const publicBefore = await anon.from("penalties").select("id").eq("id", proposed[0].id);
  check("public does not see the proposed penalty", publicBefore.data?.length === 0);
  const juryConfirm = await jury
    .from("penalties")
    .update({ status: "confirmed" })
    .eq("id", proposed[0].id)
    .select("status, reviewed_by");
  check(
    "jury confirms the penalty",
    juryConfirm.data?.[0]?.status === "confirmed" && !!juryConfirm.data[0].reviewed_by,
    juryConfirm.error?.message,
  );

  // Correction path: the timekeeper voids the test finish.
  const voided = await timer
    .from("passings")
    .update({ voided_at: new Date().toISOString(), void_reason: "e2e test" })
    .eq("client_id", clientId)
    .select("id");
  check("timekeeper can void a record", voided.data?.length === 1, voided.error?.message);

  const { data: serverTime, error: rpcError } = await anon.rpc("server_time");
  check("server_time RPC", !rpcError && Math.abs(new Date(serverTime).getTime() - Date.now()) < 5000);

  console.log(results.join("\n"));
  process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
