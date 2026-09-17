import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/database.types";

/**
 * Offline-first queue for timing facts.
 *
 * Every record is written to IndexedDB first and only then sent. Each carries a client_id that
 * the database keeps unique, so resending after a dropped connection can never create a
 * duplicate. A record is shown as saved only once the server has accepted it; a record the
 * server rejects stays visible with the reason instead of silently disappearing.
 */

export type QueueStatus = "pending" | "synced" | "rejected" | "voided";

type PassingRow = Omit<TablesInsert<"passings">, "client_id">;
type LapRow = Omit<TablesInsert<"laps">, "client_id">;
type MessageRow = Omit<TablesInsert<"marshal_messages">, "client_id">;

export type QueueItem =
  | (QueueItemBase & { table: "passings"; payload: PassingRow })
  | (QueueItemBase & { table: "laps"; payload: LapRow })
  | (QueueItemBase & { table: "marshal_messages"; payload: MessageRow });

type QueueItemBase = {
  client_id: string;
  event_id: number;
  label: string;
  recorded_at: string;
  status: QueueStatus;
  error: string | null;
  attempts: number;
};

interface TimingDB extends DBSchema {
  items: {
    key: string;
    value: QueueItem;
    indexes: { by_status: QueueStatus; by_event: number };
  };
  snapshots: {
    key: string;
    value: { key: string; data: unknown; saved_at: number };
  };
}

let dbPromise: Promise<IDBPDatabase<TimingDB>> | null = null;

function getDb() {
  dbPromise ??= openDB<TimingDB>("todorovnet-timing", 1, {
    upgrade(db) {
      const items = db.createObjectStore("items", { keyPath: "client_id" });
      items.createIndex("by_status", "status");
      items.createIndex("by_event", "event_id");
      db.createObjectStore("snapshots", { keyPath: "key" });
    },
  });
  return dbPromise;
}

export async function enqueue(
  item:
    | { table: "passings"; event_id: number; label: string; payload: PassingRow }
    | { table: "laps"; event_id: number; label: string; payload: LapRow }
    | { table: "marshal_messages"; event_id: number; label: string; payload: MessageRow },
): Promise<QueueItem> {
  const stored = {
    ...item,
    client_id: crypto.randomUUID(),
    recorded_at: new Date().toISOString(),
    status: "pending",
    error: null,
    attempts: 0,
  } as QueueItem;
  await (await getDb()).put("items", stored);
  return stored;
}

export async function listItems(eventId: number): Promise<QueueItem[]> {
  const items = await (await getDb()).getAllFromIndex("items", "by_event", eventId);
  return items.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

export async function removeItem(clientId: string): Promise<void> {
  await (await getDb()).delete("items", clientId);
}

/** Records that a synced record was voided on the server, so the phone's list shows it struck out. */
export async function markVoided(clientId: string): Promise<void> {
  const db = await getDb();
  const item = await db.get("items", clientId);
  if (item) await db.put("items", { ...item, status: "voided" });
}

/**
 * Voids a record on the server. Needs a connection: a void is a decision about an existing record,
 * so it must not be replayed later against data that may have changed.
 */
export async function voidOnServer(
  supabase: SupabaseClient<Database>,
  item: QueueItem,
  reason: string,
): Promise<boolean> {
  if (item.table === "marshal_messages") return false;
  const values = { voided_at: new Date().toISOString(), void_reason: reason };
  const { data, error } =
    item.table === "passings"
      ? await supabase.from("passings").update(values).eq("client_id", item.client_id).is("voided_at", null).select("id")
      : await supabase.from("laps").update(values).eq("client_id", item.client_id).is("voided_at", null).select("id");
  if (error || !data?.length) return false;
  await markVoided(item.client_id);
  return true;
}

export type SyncResult = { synced: number; rejected: number; pending: number; offline: boolean; signedOut: boolean };

let syncing: Promise<SyncResult> | null = null;

/** Sends pending records oldest first. Safe to call often; concurrent calls share one run. */
export function syncQueue(supabase: SupabaseClient<Database>): Promise<SyncResult> {
  syncing ??= runSync(supabase).finally(() => {
    syncing = null;
  });
  return syncing;
}

const SEND_TIMEOUT_MS = 15_000;

async function runSync(supabase: SupabaseClient<Database>): Promise<SyncResult> {
  const db = await getDb();
  // SOS and course messages go first; timing records keep their recorded order.
  const pending = (await db.getAllFromIndex("items", "by_status", "pending")).sort(
    (a, b) =>
      Number(b.table === "marshal_messages") - Number(a.table === "marshal_messages") || a.recorded_at.localeCompare(b.recorded_at),
  );
  const result: SyncResult = { synced: 0, rejected: 0, pending: pending.length, offline: false, signedOut: false };
  if (!pending.length) return result;

  // Without a valid session the database would refuse every record as "no permission". That is not the
  // record's fault: keep everything pending and ask the timekeeper to sign in again.
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    result.signedOut = true;
    return result;
  }

  for (const item of pending) {
    const signal = AbortSignal.timeout(SEND_TIMEOUT_MS);
    let error: DbError | null;
    try {
      ({ error } =
        item.table === "passings"
          ? await supabase.from("passings").insert({ ...item.payload, client_id: item.client_id }).abortSignal(signal)
          : item.table === "laps"
            ? await supabase.from("laps").insert({ ...item.payload, client_id: item.client_id }).abortSignal(signal)
            : await supabase.from("marshal_messages").insert({ ...item.payload, client_id: item.client_id }).abortSignal(signal));
    } catch (thrown) {
      error = { message: thrown instanceof Error ? thrown.message : "network error" };
    }

    if (error && !isPermanentError(error)) {
      await db.put("items", { ...item, attempts: item.attempts + 1 });
      result.offline = true;
      break; // No connection: keep the order, try again later.
    }

    // A client_id conflict means an earlier attempt reached the server before the connection dropped.
    const alreadyStored = error?.code === "23505" && error.message.includes("client_id");
    if (!error || alreadyStored) {
      await db.put("items", { ...item, status: "synced", error: null, attempts: item.attempts + 1 });
      result.synced += 1;
    } else {
      await db.put("items", { ...item, status: "rejected", error: explain(error), attempts: item.attempts + 1 });
      result.rejected += 1;
    }
    result.pending -= 1;
  }

  return result;
}

/** Puts rejected records of an event back in the queue, e.g. after the jury fixed an entry. */
export async function retryRejected(eventId: number): Promise<number> {
  const db = await getDb();
  const rejected = (await db.getAllFromIndex("items", "by_event", eventId)).filter((item) => item.status === "rejected");
  for (const item of rejected) await db.put("items", { ...item, status: "pending", error: null });
  return rejected.length;
}

/** Asks the browser not to evict the queue when the phone runs low on space. */
export async function persistStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported: IndexedDB is still used, just without the guarantee.
  }
}

/** Last known event data, so the app still opens and resolves race numbers without a connection. */
export async function saveSnapshot(key: string, data: unknown): Promise<void> {
  await (await getDb()).put("snapshots", { key, data, saved_at: Date.now() });
}

export async function loadSnapshot<T>(key: string): Promise<{ data: T; saved_at: number } | null> {
  const row = await (await getDb()).get("snapshots", key);
  return row ? { data: row.data as T, saved_at: row.saved_at } : null;
}

type DbError = { code?: string; message: string };

/**
 * Only a verdict about the record itself is final: a duplicate, an unknown rider or checkpoint, a value the
 * database refuses. Anything else (no signal, a timeout, a 502 page from a captive portal, an expired
 * login) is temporary, and the record stays in the queue to be sent again.
 */
function isPermanentError(error: DbError): boolean {
  return !!error.code && /^(23|22)/.test(error.code);
}

/** A short code the app translates (see dictionaries timing.errors); unknown errors keep the database text. */
function explain(error: DbError): string {
  if (error.code === "23505" && error.message.includes("one_active")) return "duplicate";
  if (error.code === "42501") return "forbidden";
  if (error.code === "23503") return "unknown";
  if (error.code === "23514") return "wrongClass";
  return error.message;
}
