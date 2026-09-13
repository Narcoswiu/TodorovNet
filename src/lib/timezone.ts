import { EVENT_TIME_ZONE } from "@/lib/format";

// Officials type wall-clock times at the event ("09:30"), the database stores instants.
// These convert between the two for a named time zone, including the summer-time switch.

/** "2026-09-26T09:30" at the event → ISO instant. */
export function eventLocalToIso(local: string, timeZone = EVENT_TIME_ZONE): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const wallClock = Date.UTC(y, mo - 1, d, h, mi, s || 0);

  let instant = wallClock - offsetMs(wallClock, timeZone);
  const corrected = wallClock - offsetMs(instant, timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant).toISOString();
}

/** ISO instant → "2026-09-26T09:30" at the event, for datetime-local inputs. */
export function isoToEventLocal(iso: string | null | undefined, timeZone = EVENT_TIME_ZONE): string {
  if (!iso) return "";
  const parts = partsAt(new Date(iso).getTime(), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function offsetMs(instant: number, timeZone: string): number {
  const p = partsAt(instant, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

function partsAt(instant: number, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => formatted.find((part) => part.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}
