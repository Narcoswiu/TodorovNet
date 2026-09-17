import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const OFFSET_KEY = "todorovnet.clockOffsetMs";

/**
 * Measures how far this device's clock is from the server's. Phones drift by seconds, and a
 * navigation time is only as good as the clock that stamped it. Uses the midpoint of the
 * round trip, so the error is at most half the network latency.
 */
export async function measureClockOffset(supabase: SupabaseClient<Database>): Promise<number | null> {
  const sentAt = Date.now();
  const { data, error } = await supabase.rpc("server_time");
  const receivedAt = Date.now();
  if (error || !data) return null;

  const offset = new Date(data).getTime() - (sentAt + receivedAt) / 2;
  try {
    localStorage.setItem(OFFSET_KEY, String(offset));
  } catch {
    // Private mode: the offset still applies for this session.
  }
  return offset;
}

export function storedClockOffset(): number {
  try {
    const value = Number(localStorage.getItem(OFFSET_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function correctedNow(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs);
}
