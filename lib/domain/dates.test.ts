import { describe, expect, it } from "vitest";
import { addDays, checkExpiry, checkMovementDay, expiryLabel, hourTR, isIsoDay, startOfTodayTR, todayTR } from "./dates";

const NOW = new Date("2026-11-08T10:00:00Z"); // 13:00 in Türkiye

describe("Türkiye calendar day", () => {
  it("rolls over at 21:00 UTC", () => {
    expect(todayTR(new Date("2026-11-08T20:59:00Z"))).toBe("2026-11-08");
    expect(todayTR(new Date("2026-11-08T21:00:00Z"))).toBe("2026-11-09");
  });
  it("starts the day at 00:00 Türkiye time", () => {
    expect(startOfTodayTR(NOW)).toBe("2026-11-07T21:00:00.000Z");
  });
  it("reads the local hour", () => {
    expect(hourTR("2026-11-08T06:15:00Z")).toBe(9);
  });
  it("adds days across months", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
  it("validates calendar days", () => {
    expect(isIsoDay("2026-02-28")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("08.11.2026")).toBe(false);
  });
});

describe("checkMovementDay", () => {
  it("defaults to today", () => expect(checkMovementDay("", NOW)).toEqual({ ok: true, day: "2026-11-08" }));
  it("accepts past days", () => expect(checkMovementDay("2026-11-05", NOW)).toEqual({ ok: true, day: "2026-11-05" }));
  it("rejects the future", () => expect(checkMovementDay("2026-11-09", NOW).ok).toBe(false));
  it("rejects more than a year back", () => expect(checkMovementDay("2025-11-07", NOW).ok).toBe(false));
});

describe("checkExpiry", () => {
  it("is optional", () => expect(checkExpiry("", "2026-11-08")).toEqual({ ok: true, expiresOn: null }));
  it("cannot be before the day", () => expect(checkExpiry("2026-11-07", "2026-11-08").ok).toBe(false));
  it("can be the same day", () => expect(checkExpiry("2026-11-08", "2026-11-08")).toEqual({ ok: true, expiresOn: "2026-11-08" }));
});

describe("expiryLabel", () => {
  it("speaks in days", () => {
    expect(expiryLabel("2026-11-08", "2026-11-08")).toBe("Bugün");
    expect(expiryLabel("2026-11-09", "2026-11-08")).toBe("Yarın");
    expect(expiryLabel("2026-11-11", "2026-11-08")).toBe("3 gün sonra");
    expect(expiryLabel("2026-11-06", "2026-11-08")).toBe("2 gün önce geçti");
  });
});
