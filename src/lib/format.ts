export const EVENT_TIME_ZONE = "Europe/Sofia";

/** 4:23:59 or 4:23:59.8. Tenths are truncated, like the official sheets. */
export function formatDuration(
  seconds: number | null | undefined,
  { tenths = false }: { tenths?: boolean } = {},
): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const sign = seconds < 0 ? "-" : "";
  const totalTenths = Math.floor(Math.abs(seconds) * 10 + 1e-6);
  const h = Math.floor(totalTenths / 36000);
  const m = Math.floor((totalTenths % 36000) / 600);
  const s = Math.floor((totalTenths % 600) / 10);
  const t = totalTenths % 10;
  const clock = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return sign + clock + (tenths ? `.${t}` : "");
}

/** Lap times: 1:16.517 */
export function formatLap(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const ms = Math.round(seconds * 1000);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${pad(s)}.${String(ms % 1000).padStart(3, "0")}`;
}

export function formatGap(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  if (seconds === 0) return "";
  return `+${formatDuration(seconds)}`;
}

const clockFormatter = new Intl.DateTimeFormat("bg-BG", {
  timeZone: EVENT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock time at the event: 10:01:30 */
export function formatClock(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return clockFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateRange(from: string, to: string, locale: "bg" | "en"): string {
  const formatter = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return from === to ? formatter.format(start) : formatter.formatRange(start, end);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
