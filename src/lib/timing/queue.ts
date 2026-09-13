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

export type QueueStatus = "pending" | "synced" | "rejected";

type PassingRow = Omit<TablesInsert<"passings">, "client_id">;
type LapRow = Omit<TablesInsert<"laps">, "client_id">;

export type QueueItem =
  | (QueueItemBase & { table: "passings"; payload: PassingRow })
  | (QueueItemBase & { table: "laps"; payload: LapRow });

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
    | { table: "laps"; event_id: number; label: string; payload: LapRow },
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

export type SyncResult = { synced: number; rejected: number; pending: number; offline: boolean };

let syncing: Promise<SyncResult> | null = null;

/** Sends pending records oldest first. Safe to call often; concurrent calls share one run. */
export function syncQueue(supabase: SupabaseClient<Database>): Promise<SyncResult> {
  syncing ??= runSync(supabase).finally(() => {
    syncing = null;
  });
  return syncing;
}

async function runSync(supabase: SupabaseClient<Database>): Promise<SyncResult> {
  const db = await getDb();
  const pending = (await db.getAllFromIndex("items", "by_status", "pending")).sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );
  const result: SyncResult = { synced: 0, rejected: 0, pending: pending.length, offline: false };

  for (const item of pending) {
    const { error } =
      item.table === "passings"
        ? await supabase.from("passings").insert({ ...item.payload, client_id: item.client_id })
        : await supabase.from("laps").insert({ ...item.payload, client_id: item.client_id });

    if (error && isNetworkError(error)) {
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

/** Last known event data, so the app still opens and resolves race numbers without a connection. */
export async function saveSnapshot(key: string, data: unknown): Promise<void> {
  await (await getDb()).put("snapshots", { key, data, saved_at: Date.now() });
}

export async function loadSnapshot<T>(key: string): Promise<{ data: T; saved_at: number } | null> {
  const row = await (await getDb()).get("snapshots", key);
  return row ? { data: row.data as T, saved_at: row.saved_at } : null;
}

type DbError = { code?: string; message: string };

function isNetworkError(error: DbError): boolean {
  return !error.code && /fetch|network|load failed|timed? ?out/i.test(error.message);
}

function explain(error: DbError): string {
  if (error.code === "23505" && error.message.includes("one_active")) {
    return "Вече има запис за този участник на тази точка. Анулирайте стария, ако е грешен.";
  }
  if (error.code === "42501") return "Нямате права да записвате в това състезание.";
  if (error.code === "23503") return "Непознат участник, етап или контрола.";
  return error.message;
}
