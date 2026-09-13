"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, stageName } from "@/i18n/localize";
import { formatClock } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { correctedNow, measureClockOffset, storedClockOffset } from "@/lib/timing/clock";
import { enqueue, listItems, loadSnapshot, saveSnapshot, syncQueue, type QueueItem } from "@/lib/timing/queue";

type StaffEvent = { id: number; name: string; location: string; date_from: string; roles: string[] };

type EventData = {
  stages: { id: number; name: string; name_en: string | null; type: string; day_number: number }[];
  checkpoints: { id: number; stage_id: number; code: string; name: string; name_en: string | null }[];
  sessions: {
    id: number;
    stage_id: number;
    class_id: number;
    kind: string;
    number: number;
    group_label: string | null;
    started_at: string | null;
  }[];
  classes: { id: number; name: string; name_en: string | null }[];
  entries: { id: number; race_number: number; class_id: number; first_name: string; last_name: string }[];
};

const EVENT_KEY = "todorovnet.timing.event";
const SYNC_EVERY_MS = 10_000;
const CLOCK_EVERY_MS = 5 * 60_000;

export function TimingApp({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [events, setEvents] = useState<StaffEvent[] | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [data, setData] = useState<EventData | null>(null);
  const [snapshotTime, setSnapshotTime] = useState<number | null>(null);

  const [stageId, setStageId] = useState<number | null>(null);
  const [point, setPoint] = useState("finish");
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [digits, setDigits] = useState("");
  const [stampedAt, setStampedAt] = useState<Date | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<{ text: string; tone: "good" | "bad" } | null>(null);

  // ── Session, service worker, connectivity ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: session }) => setUserId(session.session?.user.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));

    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);

    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [supabase]);

  // ── Events this user works on ──
  useEffect(() => {
    if (!userId) return;
    const key = `staff-events:${userId}`;
    (async () => {
      const { data: rows, error } = await supabase
        .from("event_staff")
        .select("role, events(id, name, location, date_from, status)")
        .eq("user_id", userId);

      let list: StaffEvent[];
      if (error || !rows) {
        list = (await loadSnapshot<StaffEvent[]>(key))?.data ?? [];
      } else {
        const byEvent = new Map<number, StaffEvent>();
        for (const row of rows) {
          if (!row.events || row.events.status === "finished") continue;
          const current = byEvent.get(row.events.id) ?? { ...row.events, roles: [] };
          current.roles.push(row.role);
          byEvent.set(row.events.id, current);
        }
        list = [...byEvent.values()].sort((a, b) => a.date_from.localeCompare(b.date_from));
        await saveSnapshot(key, list);
      }
      setEvents(list);

      const remembered = Number(localStorage.getItem(EVENT_KEY));
      if (list.some((event) => event.id === remembered)) setEventId(remembered);
      else if (list.length === 1) setEventId(list[0].id);
    })();
  }, [supabase, userId]);

  // ── Event data: live when possible, last snapshot otherwise ──
  useEffect(() => {
    if (eventId == null) return;
    localStorage.setItem(EVENT_KEY, String(eventId));
    const key = `event:${eventId}`;
    (async () => {
      const fresh = await fetchEventData(supabase, eventId).catch(() => null);
      if (fresh) {
        await saveSnapshot(key, fresh);
        setData(fresh);
        setSnapshotTime(null);
      } else {
        const saved = await loadSnapshot<EventData>(key);
        setData(saved?.data ?? null);
        setSnapshotTime(saved?.saved_at ?? null);
      }
      setItems(await listItems(eventId));
    })();
  }, [supabase, eventId]);

  // Default to the first stage once data arrives.
  const stage = data?.stages.find((s) => s.id === stageId) ?? data?.stages[0] ?? null;

  // ── Sync loop ──
  const sync = useCallback(async () => {
    if (eventId == null) return;
    const result = await syncQueue(supabase);
    if (result.offline) setOnline(false);
    setItems(await listItems(eventId));
  }, [supabase, eventId]);

  useEffect(() => {
    const first = setTimeout(sync, 0);
    const timer = setInterval(sync, SYNC_EVERY_MS);
    window.addEventListener("online", sync);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [sync]);

  // ── Clock offset: measured while online, last known value while offline ──
  useEffect(() => {
    const measure = () => measureClockOffset(supabase).then((value) => setOffset(value ?? storedClockOffset()));
    const first = setTimeout(measure, 0);
    const timer = setInterval(measure, CLOCK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [supabase]);

  const entryByNumber = useMemo(
    () => new Map((data?.entries ?? []).map((entry) => [entry.race_number, entry])),
    [data],
  );
  const typedNumber = digits ? Number(digits) : null;
  const typedEntry = typedNumber != null ? entryByNumber.get(typedNumber) : undefined;
  const classById = useMemo(() => new Map((data?.classes ?? []).map((c) => [c.id, c])), [data]);

  const checkpoints = (data?.checkpoints ?? []).filter((cp) => cp.stage_id === stage?.id);
  const sessions = (data?.sessions ?? []).filter((s) => s.stage_id === stage?.id);
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0] ?? null;

  function sessionLabel(s: EventData["sessions"][number]) {
    const cls = classById.get(s.class_id);
    const kind = s.kind === "qualifying" ? "Q" : `H${s.number}`;
    return `${cls ? localizedName(cls, lang) : ""} ${kind}${s.group_label ? ` ${s.group_label}` : ""}`;
  }

  function pointLabel(): string {
    if (point === "start") return dict.timing.start;
    if (point === "finish") return dict.timing.finish;
    return checkpoints.find((cp) => `cp:${cp.id}` === point)?.code ?? "";
  }

  async function record() {
    if (!stage || eventId == null || typedNumber == null) return;
    if (!typedEntry) {
      setMessage({ text: t(dict.timing.unknownNumber, { n: typedNumber }), tone: "bad" });
      return;
    }
    const at = stampedAt ?? correctedNow(offset ?? 0);

    if (stage.type === "enduro_cross") {
      if (!session) return;
      await enqueue({
        table: "laps",
        event_id: eventId,
        label: `#${typedNumber} · ${sessionLabel(session)}`,
        payload: { event_id: eventId, session_id: session.id, entry_id: typedEntry.id, crossed_at: at.toISOString(), source: "device" },
      });
    } else {
      const isCheckpoint = point.startsWith("cp:");
      await enqueue({
        table: "passings",
        event_id: eventId,
        label: `#${typedNumber} · ${pointLabel()}`,
        payload: {
          event_id: eventId,
          stage_id: stage.id,
          entry_id: typedEntry.id,
          point: isCheckpoint ? "checkpoint" : (point as "start" | "finish"),
          checkpoint_id: isCheckpoint ? Number(point.slice(3)) : null,
          passed_at: at.toISOString(),
          source: "device",
        },
      });
    }

    setMessage({ text: t(dict.timing.recorded, { n: typedNumber, time: formatClock(at) }), tone: "good" });
    setDigits("");
    setStampedAt(null);
    setItems(await listItems(eventId));
    sync();
  }

  async function startSession() {
    if (!session || !data) return;
    const startedAt = correctedNow(offset ?? 0).toISOString();
    const { error } = await supabase.from("sessions").update({ started_at: startedAt }).eq("id", session.id);
    if (error) {
      setMessage({ text: error.message, tone: "bad" });
      return;
    }
    setData({ ...data, sessions: data.sessions.map((s) => (s.id === session.id ? { ...s, started_at: startedAt } : s)) });
  }

  function press(key: string) {
    setMessage(null);
    if (key === "back") setDigits((d) => d.slice(0, -1));
    else if (key === "clear") {
      setDigits("");
      setStampedAt(null);
    } else setDigits((d) => (d.length < 4 ? d + key : d));
  }

  // ── Render ──
  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-6">
      <header className="flex items-center justify-between py-3">
        <Link href={`/${lang}`} className="font-semibold">
          Todorov<span className="text-accent">NET</span>
        </Link>
        <LanguageSwitcher lang={lang} label={dict.common.language} />
      </header>
      {children}
    </div>
  );

  if (userId === undefined) return shell(<p className="text-muted">{dict.common.loading}</p>);

  if (userId === null) {
    return shell(
      <div className="mt-10 space-y-4 text-center">
        <p>{dict.timing.signInToRecord}</p>
        <Link
          href={`/${lang}/login?next=/${lang}/t`}
          className="inline-block rounded-md bg-accent px-5 py-2.5 font-medium text-accent-foreground"
        >
          {dict.common.signIn}
        </Link>
      </div>,
    );
  }

  if (eventId == null || !data) {
    return shell(
      <div className="mt-4">
        <h1 className="mb-3 text-lg font-semibold">{dict.timing.chooseEvent}</h1>
        {events === null && <p className="text-muted">{dict.common.loading}</p>}
        {events?.length === 0 && <p className="text-muted">{dict.timing.noEvents}</p>}
        <ul className="space-y-2">
          {events?.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => setEventId(event.id)}
                className="w-full rounded-lg border border-border bg-card p-4 text-left hover:border-accent"
              >
                <div className="font-medium">{event.name}</div>
                <div className="text-sm text-muted">{event.location}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>,
    );
  }

  const pending = items.filter((item) => item.status === "pending").length;
  const select =
    "w-full rounded-md border border-border bg-card px-3 py-2.5 text-base outline-none focus:border-accent";

  return shell(
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={`flex items-center gap-1.5 ${online ? "text-good" : "text-warn"}`}>
          <span className={`size-2 rounded-full ${online ? "bg-good" : "bg-warn"}`} aria-hidden />
          {online ? dict.common.live : dict.common.offline}
        </span>
        <span className={pending ? "text-warn" : "text-muted"}>
          {pending ? t(dict.timing.pending, { n: pending }) : dict.timing.allSynced}
        </span>
        {offset != null && <span className="text-muted">{t(dict.timing.clockOffset, { ms: Math.round(offset) })}</span>}
      </div>

      {snapshotTime && (
        <p className="mb-3 rounded-md bg-card px-3 py-2 text-xs text-warn">
          {t(dict.timing.savedOffline, { time: formatClock(new Date(snapshotTime)) })}
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          {dict.timing.stage}
          <select className={select} value={stage?.id ?? ""} onChange={(e) => setStageId(Number(e.target.value))}>
            {data.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {stageName(s, lang, { day: dict.event.day, stageType: dict.stageType })}
              </option>
            ))}
          </select>
        </label>

        {stage?.type === "enduro_cross" ? (
          <label className="text-xs text-muted">
            {dict.timing.point}
            <select className={select} value={session?.id ?? ""} onChange={(e) => setSessionId(Number(e.target.value))}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-xs text-muted">
            {dict.timing.point}
            <select className={select} value={point} onChange={(e) => setPoint(e.target.value)}>
              <option value="start">{dict.timing.start}</option>
              {checkpoints.map((cp) => (
                <option key={cp.id} value={`cp:${cp.id}`}>
                  {cp.code} · {localizedName(cp, lang)}
                </option>
              ))}
              <option value="finish">{dict.timing.finish}</option>
            </select>
          </label>
        )}
      </div>

      {stage?.type === "enduro_cross" && session && !session.started_at && (
        <button
          type="button"
          onClick={startSession}
          disabled={!online}
          className="mb-3 w-full rounded-md border border-good py-2 text-sm font-medium text-good disabled:opacity-50"
        >
          ▶ {dict.timing.start} · {sessionLabel(session)}
        </button>
      )}

      <div className="mb-3 rounded-lg border border-border bg-card p-4 text-center">
        <div className="text-xs text-muted">{dict.timing.raceNumber}</div>
        <div className="font-mono text-5xl font-semibold tabular-nums" aria-live="polite">
          {digits || "—"}
        </div>
        <div className="mt-1 h-5 text-sm">
          {typedEntry ? (
            <span>
              {riderName(typedEntry.first_name, typedEntry.last_name, lang)}
              <span className="text-muted"> · {localizedName(classById.get(typedEntry.class_id) ?? { name: "" }, lang)}</span>
            </span>
          ) : typedNumber != null ? (
            <span className="text-bad">{t(dict.timing.unknownNumber, { n: typedNumber })}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setStampedAt(correctedNow(offset ?? 0))}
          className={`mt-3 w-full rounded-md py-2 text-sm font-medium ${
            stampedAt ? "bg-foreground text-background" : "border border-border"
          }`}
        >
          ⏱ {stampedAt ? formatClock(stampedAt) : formatClock(correctedNow(offset ?? 0)).slice(0, 5)}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="h-16 rounded-lg border border-border bg-card font-mono text-2xl font-medium active:bg-border"
          >
            {key === "back" ? "⌫" : key === "clear" ? "C" : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={record}
        disabled={!typedEntry}
        className="mb-2 h-16 w-full rounded-lg bg-accent text-xl font-semibold text-accent-foreground disabled:opacity-40"
      >
        {dict.timing.record}
      </button>

      {message && (
        <p role="status" className={`mb-3 text-center text-sm ${message.tone === "good" ? "text-good" : "text-bad"}`}>
          {message.text}
        </p>
      )}

      <h2 className="mb-2 mt-4 text-sm font-medium text-muted">{dict.timing.recent}</h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.slice(0, 30).map((item) => {
          const at = item.table === "passings" ? item.payload.passed_at : item.payload.crossed_at;
          return (
            <li key={item.client_id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{item.label}</div>
                {item.error && <div className="text-xs text-bad">{item.error}</div>}
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums">{formatClock(at)}</div>
                <div
                  className={`text-xs ${
                    item.status === "synced" ? "text-good" : item.status === "rejected" ? "text-bad" : "text-warn"
                  }`}
                >
                  {item.status === "synced"
                    ? dict.timing.synced
                    : item.status === "rejected"
                      ? dict.timing.rejected
                      : dict.timing.queued}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>,
  );
}

async function fetchEventData(supabase: ReturnType<typeof createClient>, eventId: number): Promise<EventData> {
  const [stages, checkpoints, sessions, classes, entries] = await Promise.all([
    supabase
      .from("stages")
      .select("id, name, name_en, type, day_number")
      .eq("event_id", eventId)
      .order("day_number")
      .order("sort_order"),
    supabase.from("checkpoints").select("id, stage_id, code, name, name_en").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("sessions")
      .select("id, stage_id, class_id, kind, number, group_label, started_at")
      .eq("event_id", eventId)
      .order("class_id")
      .order("kind")
      .order("number"),
    supabase.from("event_classes").select("start_order, classes(id, name, name_en)").eq("event_id", eventId).order("start_order"),
    supabase
      .from("entries")
      .select("id, race_number, class_id, riders(first_name, last_name)")
      .eq("event_id", eventId)
      .eq("withdrawn", false),
  ]);
  for (const result of [stages, checkpoints, sessions, classes, entries]) {
    if (result.error) throw result.error;
  }
  return {
    stages: stages.data ?? [],
    checkpoints: checkpoints.data ?? [],
    sessions: sessions.data ?? [],
    classes: (classes.data ?? []).flatMap((row) => (row.classes ? [row.classes] : [])),
    entries: (entries.data ?? []).map((entry) => ({
      id: entry.id,
      race_number: entry.race_number,
      class_id: entry.class_id,
      first_name: entry.riders?.first_name ?? "",
      last_name: entry.riders?.last_name ?? "",
    })),
  };
}
