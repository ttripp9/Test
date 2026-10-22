import { describe, expect, it } from "vitest";
import { availableSlots, zonedTimeToUtc } from "@/lib/booking";

describe("time zones", () => {
  it("converts wall-clock time to UTC across DST", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 15, 9, 0, "Asia/Tokyo").toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });
});

describe("availableSlots", () => {
  const settings = { durationMinutes: 60, bufferMinutes: 0, weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "12:00", daysAhead: 7 };
  // Monday 2026-10-19 06:00 New York
  const now = new Date("2026-10-19T10:00:00Z");

  it("creates slots only on chosen weekdays and hours", () => {
    const slots = availableSlots({ settings, timeZone: "America/New_York", busy: [], now, minNoticeMinutes: 0 });
    expect(slots[0].start.toISOString()).toBe("2026-10-19T13:00:00.000Z");
    expect(slots.length).toBe(3 * 6); // Mon-Fri this week + Mon next week, 3 per day
    for (const s of slots) expect([0, 6]).not.toContain(new Date(s.start.getTime() - 4 * 3600_000).getUTCDay());
  });

  it("removes slots that overlap existing bookings", () => {
    const busy = [{ start: new Date("2026-10-19T13:30:00Z"), end: new Date("2026-10-19T14:30:00Z") }];
    const slots = availableSlots({ settings, timeZone: "America/New_York", busy, now, minNoticeMinutes: 0 });
    const starts = slots.map((s) => s.start.toISOString());
    expect(starts).not.toContain("2026-10-19T13:00:00.000Z");
    expect(starts).not.toContain("2026-10-19T14:00:00.000Z");
    expect(starts).toContain("2026-10-19T15:00:00.000Z");
  });

  it("respects minimum notice", () => {
    const slots = availableSlots({ settings, timeZone: "America/New_York", busy: [], now, minNoticeMinutes: 240 });
    expect(slots[0].start.toISOString()).toBe("2026-10-19T14:00:00.000Z");
  });

  it("does not skip days around a DST change", () => {
    const s = { ...settings, weekdays: [0, 1, 2, 3, 4, 5, 6], daysAhead: 3 };
    // Nov 1 2026 is the US fall-back day.
    const slots = availableSlots({ settings: s, timeZone: "America/New_York", busy: [], now: new Date("2026-10-31T03:30:00Z"), minNoticeMinutes: 0 });
    const days = new Set(slots.map((x) => x.start.toISOString().slice(0, 10)));
    // It's 11:30pm on Oct 30 in New York, so that day's slots are already past.
    expect(days).toEqual(new Set(["2026-10-31", "2026-11-01", "2026-11-02"]));
  });
});
