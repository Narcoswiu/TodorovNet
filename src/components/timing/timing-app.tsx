"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, stageName } from "@/i18n/localize";
import { formatClock } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { correctedNow, measureClockOffset, storedClockOffset } from "@/lib/timing/clock";
import { enqueue, listItems, loadSnapshot, persistStorage, retryRejected, saveSnapshot, syncQueue, voidOnServer, type QueueItem } from "@/lib/timing/queue";
import { eventLocalToIso, isoToEventLocal } from "@/lib/timezone";

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
    red_flag_at: string | null;
  }[];
  classes: { id: number; name: string; name_en: string | null }[];
  entries: { id: number; race_number: number; class_id: number; first_name: string; last_name: string }[];
};

const EVENT_KEY = "todorovnet.timing.event";
const USER_KEY = "todorovnet.timing.user";
// The Supabase client retries a failed read for several seconds; on a weak connection the app
// stops waiting after this and shows the data saved on the phone.
const READ_TIMEOUT_MS = 4000;
const SYNC_EVERY_MS = 10_000;
const STATUS_TONE = { synced: "text-good", rejected: "text-bad", pending: "text-warn", voided: "text-muted" } as const;
const CLOCK_EVERY_MS = 5 * 60_000;
const SUN_KEY = "todorovnet.timing.sun";
const SELECTION_KEY = "todorovnet.timing.selection";
// Event handlers only; kept outside the component so render stays pure.
const msNow = () => Date.now();

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
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState<{ text: string; tone: "good" | "bad"; key: number } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [sun, setSun] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const recording = useRef(false);
  const lastRecord = useRef<{ key: string; at: number } | null>(null);
  const confirmShownAt = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => undefined);

  // Every result is felt as well as seen: a timekeeper looks at the rider, not the screen.
  const setMessage = useCallback((next: { text: string; tone: "good" | "bad" } | null) => {
    setFlash(next ? { ...next, key: Date.now() } : null);
    if (!next) return;
    try {
      navigator.vibrate?.(next.tone === "good" ? 60 : [120, 80, 120]);
    } catch {
      // No vibration motor or not allowed.
    }
    try {
      audio.current ??= new AudioContext();
      const tone = audio.current.createOscillator();
      const gain = audio.current.createGain();
      tone.frequency.value = next.tone === "good" ? 1320 : 330;
      gain.gain.value = 0.15;
      tone.connect(gain).connect(audio.current.destination);
      tone.start();
      tone.stop(audio.current.currentTime + (next.tone === "good" ? 0.09 : 0.3));
    } catch {
      // No audio: vibration and colour still tell the story.
    }
  }, []);

  function toggleSun() {
    setSun((current) => {
      try {
        localStorage.setItem(SUN_KEY, current ? "0" : "1");
      } catch {
        // Private mode: the choice lasts until the page closes.
      }
      return !current;
    });
  }

  // ── Clock, saved theme, physical keyboards ──
  useEffect(() => {
    const tick = () => setNow(new Date(Date.now() + storedClockOffset()));
    const first = setTimeout(() => {
      tick();
      try {
        setSun(localStorage.getItem(SUN_KEY) === "1");
      } catch {
        // Keep the default theme.
      }
    }, 0);
    const timer = setInterval(tick, 1000);
    persistStorage();
    const onKey = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  // ── Session, service worker, connectivity ──
  useEffect(() => {
    // Offline, the auth client may never confirm the session. The app then continues as the last signed-in
    // timekeeper: that only unlocks the local queue, and the database still checks every record on sync.
    const cachedUser = () => {
      try {
        return localStorage.getItem(USER_KEY);
      } catch {
        return null;
      }
    };
    const rememberUser = (id: string | null) => {
      try {
        if (id) localStorage.setItem(USER_KEY, id);
        else localStorage.removeItem(USER_KEY);
      } catch {
        // Private mode: nothing to remember.
      }
    };

    const fallback = setTimeout(() => setUserId((current) => (current === undefined ? cachedUser() : current)), 2500);
    supabase.auth
      .getSession()
      .then(({ data: session }) => {
        const id = session.session?.user.id ?? null;
        if (id) rememberUser(id);
        // A phone that shows signal bars but has no data cannot refresh the session: keep working as the
        // last signed-in timekeeper. Records wait in the queue until a real sign-in succeeds.
        setUserId(id ?? cachedUser());
      })
      .catch(() => setUserId(cachedUser()));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        rememberUser(null);
        setUserId(null);
      } else if (session?.user.id) {
        rememberUser(session.user.id);
        setUserId(session.user.id);
      }
    });

    // Register the worker and hand it this page plus the scripts already loaded, so a reload works offline
    // even when the app was opened by an in-app navigation rather than a full page load.
    navigator.serviceWorker
      ?.register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const assets = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(`${location.origin}/_next/static/`));
        registration.active?.postMessage({ type: "cache-shell", urls: [location.pathname, ...assets] });
      })
      .catch(() => undefined);

    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearTimeout(fallback);
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
      // Offline, skip the network entirely and use what was saved on the phone.
      const response = navigator.onLine
        ? await withTimeout(
            Promise.all([
              supabase.from("event_staff").select("role, events(id, name, location, date_from, status)").eq("user_id", userId),
              supabase.from("profiles").select("is_super_admin").eq("id", userId).maybeSingle(),
            ]),
            READ_TIMEOUT_MS,
          )
        : null;
      let rows = response && !response[0].error ? response[0].data : null;
      const superAdmin = !!response?.[1].data?.is_super_admin;
      if (response) setIsAdmin(superAdmin);
      // Super admins may time any event (the database allows it), so they don't have to add themselves as staff.
      if (rows && superAdmin) {
        const { data: all } = await supabase
          .from("events")
          .select("id, name, location, date_from, status")
          .neq("status", "finished");
        rows = [...rows, ...(all ?? []).map((event) => ({ role: "organizer" as const, events: event }))];
      }

      let list: StaffEvent[];
      if (!rows) {
        list = (await loadSnapshot<StaffEvent[]>(key))?.data ?? [];
      } else {
        const byEvent = new Map<number, StaffEvent>();
        for (const row of rows) {
          if (!row.events || row.events.status === "finished") continue;
          const current = byEvent.get(row.events.id) ?? { ...row.events, roles: [] };
          if (!current.roles.includes(row.role)) current.roles.push(row.role);
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
      const fresh = navigator.onLine
        ? await withTimeout(fetchEventData(supabase, eventId), READ_TIMEOUT_MS).catch(() => null)
        : null;
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
    // Re-runs when the connection comes back, replacing saved data with fresh data.
  }, [supabase, eventId, online]);

  // Stage, point and heat are remembered per event, so a reload on the course keeps the timekeeper's place.
  useEffect(() => {
    if (eventId == null) return;
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(`${SELECTION_KEY}.${eventId}`) ?? "null");
        if (saved) {
          setStageId(saved.stageId ?? null);
          setPoint(saved.point ?? "finish");
          setSessionId(saved.sessionId ?? null);
        }
      } catch {
        // Nothing saved.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [eventId]);

  function choose(next: { stageId?: number; point?: string; sessionId?: number | null }) {
    // A new stage starts at its finish and first heat: an old checkpoint belongs to another stage.
    const selection = {
      stageId: next.stageId ?? stageId,
      point: next.stageId !== undefined && next.stageId !== stageId ? "finish" : (next.point ?? point),
      sessionId: next.stageId !== undefined && next.stageId !== stageId ? null : next.sessionId !== undefined ? next.sessionId : sessionId,
    };
    setStageId(selection.stageId);
    setPoint(selection.point);
    setSessionId(selection.sessionId);
    try {
      localStorage.setItem(`${SELECTION_KEY}.${eventId}`, JSON.stringify(selection));
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
  }

  // Default to the first stage once data arrives.
  const stage = data?.stages.find((s) => s.id === stageId) ?? data?.stages[0] ?? null;

  // ── Sync loop ──
  const sync = useCallback(async () => {
    if (eventId == null) return;
    if (!navigator.onLine) {
      setOnline(false);
      setItems(await listItems(eventId));
      return;
    }
    const result = await syncQueue(supabase);
    if (result.offline) setOnline(false);
    setSignedOut(result.signedOut);
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
    const measure = () =>
      (navigator.onLine ? measureClockOffset(supabase) : Promise.resolve(null)).then((value) =>
        setOffset(value ?? storedClockOffset()),
      );
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
  const activePoint = point.startsWith("cp:") && !checkpoints.some((cp) => `cp:${cp.id}` === point) ? "finish" : point;
  const wrongClass = stage?.type === "enduro_cross" && !!session && !!typedEntry && typedEntry.class_id !== session.class_id;

  function sessionLabel(s: EventData["sessions"][number]) {
    const cls = classById.get(s.class_id);
    const kind = s.kind === "qualifying" ? "Q" : `H${s.number}`;
    return `${cls ? localizedName(cls, lang) : ""} ${kind}${s.group_label ? ` ${s.group_label}` : ""}`;
  }

  function pointLabel(): string {
    if (activePoint === "start") return dict.timing.start;
    if (activePoint === "finish") return dict.timing.finish;
    return checkpoints.find((cp) => `cp:${cp.id}` === activePoint)?.code ?? "";
  }

  async function record() {
    if (recording.current) return; // A double tap or a held Enter records once.
    recording.current = true;
    try {
      await recordOnce();
    } finally {
      recording.current = false;
    }
  }

  async function recordOnce() {
    if (!stage || eventId == null || typedNumber == null) return;
    if (!typedEntry) {
      setMessage({ text: t(dict.timing.unknownNumber, { n: typedNumber }), tone: "bad" });
      return;
    }
    if (wrongClass) {
      setMessage({ text: dict.timing.wrongClass, tone: "bad" });
      return;
    }
    const key = `${stage.id}:${stage.type === "enduro_cross" ? session?.id : activePoint}:${typedEntry.id}`;
    if (lastRecord.current && lastRecord.current.key === key && msNow() - lastRecord.current.at < 2000) {
      setMessage({ text: dict.timing.justRecorded, tone: "bad" });
      return;
    }
    // A time typed from a paper sheet wins over the stamp and the clock.
    let at: Date;
    if (manualTime) {
      const today = isoToEventLocal(new Date().toISOString()).slice(0, 10);
      const iso = eventLocalToIso(`${manualDate || today}T${manualTime}`);
      if (!iso) {
        setMessage({ text: dict.timing.invalidTime, tone: "bad" });
        return;
      }
      at = new Date(iso);
    } else {
      at = stampedAt ?? correctedNow(offset ?? storedClockOffset());
    }
    const source = manualTime ? "manual" : "device";

    try {
    if (stage.type === "enduro_cross") {
      if (!session) return;
      await enqueue({
        table: "laps",
        event_id: eventId,
        label: `#${typedNumber} · ${sessionLabel(session)}`,
        payload: { event_id: eventId, session_id: session.id, entry_id: typedEntry.id, crossed_at: at.toISOString(), source },
      });
    } else {
      const isCheckpoint = activePoint.startsWith("cp:");
      await enqueue({
        table: "passings",
        event_id: eventId,
        label: `#${typedNumber} · ${pointLabel()}`,
        payload: {
          event_id: eventId,
          stage_id: stage.id,
          entry_id: typedEntry.id,
          point: isCheckpoint ? "checkpoint" : (activePoint as "start" | "finish"),
          checkpoint_id: isCheckpoint ? Number(activePoint.slice(3)) : null,
          passed_at: at.toISOString(),
          source,
        },
      });
    }

    } catch {
      // The phone could not store the record (storage full or blocked): say so loudly, keep the number typed.
      setMessage({ text: dict.timing.saveFailed, tone: "bad" });
      return;
    }

    lastRecord.current = { key, at: msNow() };
    setMessage({ text: t(dict.timing.recorded, { n: typedNumber, time: formatClock(at) }), tone: "good" });
    setDigits("");
    setStampedAt(null);
    setManualTime("");
    setManualDate("");
    setItems(await listItems(eventId));
    sync();
  }

  async function redFlag() {
    if (!session || !data) return;
    const flaggedAt = correctedNow(offset ?? storedClockOffset()).toISOString();
    const { error } = await supabase
      .from("sessions")
      .update({ red_flag_at: flaggedAt, red_flag_decision: null })
      .eq("id", session.id);
    if (error) {
      setMessage({ text: error.message, tone: "bad" });
      return;
    }
    setData({ ...data, sessions: data.sessions.map((s) => (s.id === session.id ? { ...s, red_flag_at: flaggedAt } : s)) });
  }

  /** Location of this phone, if the browser allows it within a few seconds. Never blocks sending. */
  function currentPosition(): Promise<GeolocationPosition | null> {
    if (!("geolocation" in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 2500, maximumAge: 120_000 });
    });
  }

  async function sendMessage(kind: "sos" | "info") {
    if (eventId == null) return;
    const position = await currentPosition();
    const number = typedNumber != null && typedEntry ? typedNumber : null;
    const isCheckpoint = activePoint.startsWith("cp:");
    await enqueue({
      table: "marshal_messages",
      event_id: eventId,
      label: `${kind === "sos" ? dict.timing.sosLabel : dict.timing.infoLabel}${number ? ` · #${number}` : ""}`,
      payload: {
        event_id: eventId,
        stage_id: stage?.id ?? null,
        checkpoint_id: isCheckpoint && stage?.type === "navigation" ? Number(activePoint.slice(3)) : null,
        kind,
        race_number: number,
        body: messageText.trim(),
        lat: position?.coords.latitude ?? null,
        lon: position?.coords.longitude ?? null,
        accuracy_m: position?.coords.accuracy ?? null,
        sent_at: correctedNow(offset ?? storedClockOffset()).toISOString(),
      },
    });
    setMessage({ text: kind === "sos" ? dict.timing.sosQueued : dict.timing.infoQueued, tone: kind === "sos" ? "bad" : "good" });
    setSosOpen(false);
    setMessageText("");
    setItems(await listItems(eventId));
    sync();
  }

  async function voidItem(item: QueueItem) {
    // The confirm button appears where "Void" was: a double tap must not confirm by accident.
    if (msNow() - confirmShownAt.current < 700) return;
    setConfirmVoid(null);
    if (eventId == null) return;
    if (!navigator.onLine) {
      setMessage({ text: dict.timing.voidNeedsConnection, tone: "bad" });
      return;
    }
    const voided = await voidOnServer(supabase, item, dict.timing.voidReason);
    if (!voided) setMessage({ text: dict.timing.voidFailed, tone: "bad" });
    setItems(await listItems(eventId));
  }

  async function startSession() {
    if (!session || !data) return;
    const startedAt = correctedNow(offset ?? storedClockOffset()).toISOString();
    const { error } = await supabase.from("sessions").update({ started_at: startedAt }).eq("id", session.id);
    if (error) {
      setMessage({ text: error.message, tone: "bad" });
      return;
    }
    setData({ ...data, sessions: data.sessions.map((s) => (s.id === session.id ? { ...s, started_at: startedAt } : s)) });
  }

  function press(key: string) {
    setMessage(null);
    if (key === "back") {
      // A time fixed for one rider must not carry over to the next number.
      if (digits.length <= 1) setStampedAt(null);
      setDigits((d) => d.slice(0, -1));
    }
    else if (key === "clear") {
      setDigits("");
      setStampedAt(null);
    } else setDigits((d) => (d.length < 4 ? d + key : d));
  }

  // Bluetooth keypads and laptops: digits, Backspace, Escape and Enter work like the on-screen keys.
  useEffect(() => {
    keyHandler.current = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat) return;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("back");
      else if (event.key === "Escape") press("clear");
      else if (event.key === "Enter" && typedEntry) {
        event.preventDefault();
        record();
      }
    };
  });

  // ── Render ──
  const shell = (children: React.ReactNode) => (
    <div className={`${sun ? "timing-sun" : ""} flex min-h-dvh flex-1 flex-col bg-background text-foreground`}>
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-2">
          <Link href={`/${lang}`} className="text-lg font-bold tracking-tight">
            Todorov<span className="text-accent">NET</span>
          </Link>
          <span className="font-mono text-2xl font-bold tabular-nums" suppressHydrationWarning>
            {now ? formatClock(now) : "--:--:--"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSun}
              aria-pressed={sun}
              aria-label={dict.timing.sunMode}
              title={dict.timing.sunMode}
              className={`grid size-10 place-items-center rounded-full border-2 text-lg ${sun ? "border-foreground bg-foreground text-background" : "border-border"}`}
            >
              ☀
            </button>
            <LanguageSwitcher lang={lang} label={dict.common.language} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );

  if (userId === undefined) return shell(<p className="text-muted">{dict.common.loading}</p>);

  if (userId === null) {
    return shell(
      <div className="mt-10 space-y-6 text-center">
        <p className="text-lg">{dict.timing.signInToRecord}</p>
        <Link
          href={`/${lang}/login?next=/${lang}/t`}
          className="block rounded-2xl bg-accent px-5 py-4 text-xl font-bold text-accent-foreground"
        >
          {dict.common.signIn}
        </Link>
        <InstallApp dict={dict} />
      </div>,
    );
  }

  if (eventId == null || !data) {
    return shell(
      <div>
        <h1 className="mb-4 text-2xl font-bold">{dict.timing.chooseEvent}</h1>
        {events === null && <p className="text-muted">{dict.common.loading}</p>}
        {events?.length === 0 && (
          <div className="space-y-4 rounded-2xl border-2 border-dashed border-border p-5">
            <p className="text-lg font-semibold">{dict.timing.noEvents}</p>
            <p className="text-muted">{isAdmin ? dict.timing.noEventsAdmin : dict.timing.noEventsStaff}</p>
            {isAdmin && (
              <Link
                href={`/${lang}/admin/events/new`}
                className="block rounded-2xl bg-accent px-5 py-4 text-center text-lg font-bold text-accent-foreground"
              >
                {dict.timing.createEvent}
              </Link>
            )}
          </div>
        )}
        <ul className="space-y-3">
          {events?.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => setEventId(event.id)}
                className="w-full rounded-2xl border-2 border-border bg-card p-5 text-left active:border-accent"
              >
                <div className="text-lg font-bold">{event.name}</div>
                <div className="text-muted">{event.location}</div>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <InstallApp dict={dict} />
        </div>
      </div>,
    );
  }

  const pending = items.filter((item) => item.status === "pending").length;
  const chip = (active: boolean) =>
    `shrink-0 rounded-xl border-2 px-4 py-3 text-base font-bold ${
      active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card"
    }`;

  return shell(
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span
          className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 ${online ? "border-good text-good" : "border-warn text-warn"}`}
        >
          <span className={`size-2.5 rounded-full ${online ? "bg-good" : "bg-warn"}`} aria-hidden />
          {online ? dict.common.live : dict.common.offline}
        </span>
        <span className={`rounded-full border-2 px-3 py-1 ${pending ? "border-warn text-warn" : "border-border text-muted"}`}>
          {pending ? t(dict.timing.pending, { n: pending }) : dict.timing.allSynced}
        </span>
        {offset != null && <span className="text-xs text-muted">{t(dict.timing.clockOffset, { ms: Math.round(offset) })}</span>}
      </div>

      {signedOut && (
        <Link
          href={`/${lang}/login?next=/${lang}/t`}
          className="mb-3 block rounded-xl border-2 border-bad px-3 py-2 text-sm font-bold text-bad"
        >
          {dict.timing.signedOut}
        </Link>
      )}

      {snapshotTime && (
        <p className="mb-3 rounded-xl border-2 border-warn px-3 py-2 text-sm font-medium text-warn">
          {t(dict.timing.savedOffline, { time: formatClock(new Date(snapshotTime)) })}
        </p>
      )}

      <label className="mb-2 block text-sm font-semibold text-muted">
        {dict.timing.stage}
        <select
          className="mt-1 block w-full rounded-xl border-2 border-border bg-card px-3 py-3 text-lg font-semibold text-foreground"
          value={stage?.id ?? ""}
          onChange={(e) => choose({ stageId: Number(e.target.value) })}
        >
          {data.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {stageName(s, lang, { day: dict.event.day, stageType: dict.stageType })}
            </option>
          ))}
        </select>
      </label>

      {stage?.type === "enduro_cross" ? (
        <label className="mb-3 block text-sm font-semibold text-muted">
          {dict.timing.point}
          <select
            className="mt-1 block w-full rounded-xl border-2 border-border bg-card px-3 py-3 text-lg font-semibold text-foreground"
            value={session?.id ?? ""}
            onChange={(e) => choose({ sessionId: Number(e.target.value) })}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionLabel(s)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="-mx-4 mb-3 overflow-x-auto px-4" role="group" aria-label={dict.timing.point}>
          <div className="flex gap-2">
            <button type="button" aria-pressed={activePoint === "start"} onClick={() => choose({ point: "start" })} className={chip(activePoint === "start")}>
              {dict.timing.start}
            </button>
            {checkpoints.map((cp) => (
              <button
                key={cp.id}
                type="button"
                aria-pressed={activePoint === `cp:${cp.id}`}
                onClick={() => choose({ point: `cp:${cp.id}` })}
                className={chip(activePoint === `cp:${cp.id}`)}
                title={localizedName(cp, lang)}
              >
                {cp.code}
              </button>
            ))}
            <button type="button" aria-pressed={activePoint === "finish"} onClick={() => choose({ point: "finish" })} className={chip(activePoint === "finish")}>
              {dict.timing.finish}
            </button>
          </div>
        </div>
      )}

      {stage?.type === "enduro_cross" && session && !session.started_at && (
        <button
          type="button"
          onClick={startSession}
          disabled={!online}
          className="mb-3 h-14 w-full rounded-xl border-2 border-good text-lg font-bold text-good disabled:opacity-50"
        >
          ▶ {dict.timing.start} · {sessionLabel(session)}
        </button>
      )}

      {stage?.type === "enduro_cross" && session?.started_at && (
        session.red_flag_at ? (
          <p className="mb-3 rounded-xl bg-bad px-3 py-3 text-center text-lg font-bold text-white">
            {t(dict.timing.redFlagSet, { time: formatClock(session.red_flag_at) })}
          </p>
        ) : (
          <button
            type="button"
            onClick={redFlag}
            disabled={!online}
            className="mb-3 h-14 w-full rounded-xl border-2 border-bad text-lg font-bold text-bad disabled:opacity-50"
          >
            ⚑ {dict.timing.redFlag} · {sessionLabel(session)}
          </button>
        )
      )}

      <div
        className={`relative mb-3 overflow-hidden rounded-2xl border-2 bg-card px-4 pb-3 pt-2 text-center ${
          flash ? (flash.tone === "good" ? "border-good" : "border-bad") : "border-border"
        }`}
      >
        <div className="flex items-center justify-between text-sm font-semibold text-muted">
          <span>{dict.timing.raceNumber}</span>
          <span>{stage?.type === "enduro_cross" ? (session ? sessionLabel(session) : "") : pointLabel()}</span>
        </div>
        <div className="font-mono text-6xl font-black leading-tight tabular-nums [@media(min-height:760px)]:text-7xl" aria-live="polite">
          {digits || "—"}
        </div>
        <div className="min-h-7 text-lg font-semibold">
          {typedEntry && wrongClass ? (
            <span className="text-bad">{dict.timing.wrongClass}</span>
          ) : typedEntry ? (
            <span>
              {riderName(typedEntry.first_name, typedEntry.last_name, lang)}
              <span className="font-normal text-muted"> · {localizedName(classById.get(typedEntry.class_id) ?? { name: "" }, lang)}</span>
            </span>
          ) : typedNumber != null ? (
            <span className="text-bad">{t(dict.timing.unknownNumber, { n: typedNumber })}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setStampedAt(correctedNow(offset ?? storedClockOffset()))}
          className={`mt-2 w-full rounded-xl py-2.5 text-base font-bold ${
            stampedAt ? "bg-foreground text-background" : "border-2 border-border"
          }`}
        >
          ⏱ {stampedAt ? formatClock(stampedAt) : dict.timing.stampNow}
        </button>
        <details className="mt-2 text-left text-sm text-muted" open={!!manualTime}>
          <summary className="cursor-pointer select-none font-semibold">
            {dict.timing.manualTime}
            {manualTime ? `: ${manualTime}` : ""}
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              {dict.timing.date}
              <input
                type="date"
                name="manual_date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border-2 border-border bg-background px-2 py-2 text-base text-foreground"
              />
            </label>
            <label className="block">
              {dict.timing.manualTime}
              <input
                type="time"
                step={1}
                name="manual_time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border-2 border-border bg-background px-2 py-2 text-base text-foreground"
              />
            </label>
          </div>
          <p className="mt-1">{dict.timing.manualTimeHelp}</p>
        </details>
      </div>

      {flash && (
        <p
          role="status"
          key={flash.key}
          className={`timing-flash mb-3 rounded-2xl px-4 py-3 text-center text-xl font-black ${
            flash.tone === "good" ? "bg-good text-white" : "bg-bad text-white"
          }`}
        >
          {flash.text}
        </p>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "back" ? dict.timing.deleteDigit : key === "clear" ? dict.timing.clearNumber : undefined}
            className={`h-16 rounded-2xl border-2 [@media(min-height:800px)]:h-[4.5rem] font-mono text-4xl font-bold active:scale-95 active:bg-border ${
              key === "clear" || key === "back" ? "border-border bg-background text-muted" : "border-border bg-card"
            }`}
          >
            {key === "back" ? "⌫" : key === "clear" ? "C" : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={record}
        disabled={!typedEntry}
        className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 mb-4 h-20 w-full rounded-2xl bg-accent text-3xl font-black tracking-wide text-accent-foreground shadow-[0_12px_30px_-8px_rgb(0_0_0/0.6)] active:scale-[0.98] disabled:bg-card-2 disabled:text-muted disabled:shadow-none"
      >
        {dict.timing.record}
      </button>

      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{dict.timing.recent}</h2>
        {items.some((item) => item.status === "rejected") && eventId != null && (
          <button
            type="button"
            onClick={async () => {
              await retryRejected(eventId);
              sync();
            }}
            className="rounded-full border-2 border-bad px-3 py-1 text-xs font-bold text-bad"
          >
            {dict.timing.retryRejected}
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {items.slice(0, 30).map((item) => {
          const at =
            item.table === "passings" ? item.payload.passed_at : item.table === "laps" ? item.payload.crossed_at : item.payload.sent_at;
          const edge = { synced: "border-l-good", rejected: "border-l-bad", pending: "border-l-warn", voided: "border-l-border" }[item.status];
          return (
            <li key={item.client_id} className={`flex items-start justify-between gap-3 rounded-xl border-2 border-l-8 border-border bg-card px-3 py-2 ${edge}`}>
              <div>
                <div className={`text-lg font-bold ${item.status === "voided" ? "text-muted line-through" : ""}`}>{item.label}</div>
                {item.error && <div className="text-sm text-bad">{dict.timing.errors[item.error as keyof typeof dict.timing.errors] ?? item.error}</div>}
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold tabular-nums">{formatClock(at)}</div>
                <div className={`text-sm font-semibold ${STATUS_TONE[item.status]}`}>
                  {
                    {
                      synced: dict.timing.synced,
                      rejected: dict.timing.rejected,
                      pending: dict.timing.queued,
                      voided: dict.timing.voided,
                    }[item.status]
                  }
                </div>
                {item.status === "synced" &&
                  item.table !== "marshal_messages" &&
                  (confirmVoid === item.client_id ? (
                    <button type="button" onClick={() => voidItem(item)} className="mt-1 text-sm font-bold text-bad underline">
                      {dict.timing.voidConfirm}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        confirmShownAt.current = msNow();
                        setConfirmVoid(item.client_id);
                      }}
                      className="mt-1 text-sm text-muted underline"
                    >
                      {dict.timing.void}
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-2xl border-2 border-bad p-3">
        {sosOpen ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">{dict.timing.sosHelp}</p>
            <textarea
              name="course_message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={dict.timing.messagePlaceholder}
              rows={2}
              className="block w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-base text-foreground"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => sendMessage("sos")} className="h-16 rounded-xl bg-bad text-xl font-black text-white">
                {dict.timing.sosConfirm}
              </button>
              <button type="button" onClick={() => sendMessage("info")} className="h-16 rounded-xl border-2 border-border text-base font-bold">
                {dict.timing.sendInfo}
              </button>
            </div>
            <button type="button" onClick={() => setSosOpen(false)} className="w-full py-1 text-sm text-muted underline">
              {dict.common.cancel}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setSosOpen(true)} className="h-14 w-full rounded-xl text-xl font-black text-bad">
            🆘 {dict.timing.sos} / {dict.timing.message}
          </button>
        )}
      </div>

      <div className="mt-6">
        <InstallApp dict={dict} />
      </div>
    </>,
  );
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install the app" on Android/desktop Chrome, a short how-to on iPhone, nothing once installed. */
function InstallApp({ dict }: { dict: Dictionary }) {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = ios ? setTimeout(() => setMode("ios"), 0) : undefined;
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (mode === "hidden") return null;
  if (mode === "ios") {
    return (
      <p className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm">
        📲 <span className="font-bold">{dict.timing.install}</span>
        <br />
        {dict.timing.installIos}
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={async () => {
        await installEvent?.prompt();
        setMode("hidden");
      }}
      className="h-14 w-full rounded-2xl border-2 border-foreground text-lg font-bold"
    >
      📲 {dict.timing.install}
    </button>
  );
}

/** Resolves to null when the work takes longer than `ms`; a rejection still rejects. */
function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([Promise.resolve(work), new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
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
      .select("id, stage_id, class_id, kind, number, group_label, started_at, red_flag_at")
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
