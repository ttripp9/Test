import type { ProductSettings } from "./db/schema";

/** Offset (ms) between UTC and the given time zone at a specific instant. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. Handles DST changes. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - tzOffsetMs(new Date(guess), timeZone);
  // A second pass fixes the guess when it lands on the other side of a DST switch.
  ts = guess - tzOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** Calendar date (y, m, d, weekday) of an instant in a time zone. */
export function zonedDate(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday };
}

function parseHm(value: string | undefined, fallback: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? fallback) ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  return [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))];
}

export type Slot = { start: Date; end: Date };

export const DEFAULT_BOOKING: Required<
  Pick<ProductSettings, "durationMinutes" | "bufferMinutes" | "weekdays" | "startTime" | "endTime" | "daysAhead">
> = { durationMinutes: 30, bufferMinutes: 15, weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", daysAhead: 14 };

/**
 * List open slots for a booking product.
 * `busy` are existing bookings (held or confirmed) that block time.
 */
export function availableSlots(opts: {
  settings: ProductSettings;
  timeZone: string;
  busy: Slot[];
  now?: Date;
  minNoticeMinutes?: number;
}): Slot[] {
  const s = { ...DEFAULT_BOOKING, ...opts.settings };
  const now = opts.now ?? new Date();
  const earliest = now.getTime() + (opts.minNoticeMinutes ?? 120) * 60_000;
  const duration = Math.max(10, Math.min(s.durationMinutes, 480)) * 60_000;
  const step = duration + Math.max(0, s.bufferMinutes) * 60_000;
  const [sh, sm] = parseHm(s.startTime, "09:00");
  const [eh, em] = parseHm(s.endTime, "17:00");
  const slots: Slot[] = [];
  const days = Math.max(1, Math.min(s.daysAhead, 90));
  const today = zonedDate(now, opts.timeZone);
  for (let i = 0; i <= days; i++) {
    // Walk calendar days (not 24h steps) so DST changes never skip a day.
    const cal = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const year = cal.getUTCFullYear();
    const month = cal.getUTCMonth() + 1;
    const day = cal.getUTCDate();
    const weekday = cal.getUTCDay();
    if (!s.weekdays.includes(weekday)) continue;
    const dayStart = zonedTimeToUtc(year, month, day, sh, sm, opts.timeZone).getTime();
    const dayEnd = zonedTimeToUtc(year, month, day, eh, em, opts.timeZone).getTime();
    for (let t = dayStart; t + duration <= dayEnd; t += step) {
      if (t < earliest) continue;
      const start = new Date(t);
      const end = new Date(t + duration);
      const clash = opts.busy.some((b) => b.start.getTime() < end.getTime() && b.end.getTime() > start.getTime());
      if (!clash && !slots.some((x) => x.start.getTime() === t)) slots.push({ start, end });
    }
  }
  return slots;
}

export function formatSlot(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
