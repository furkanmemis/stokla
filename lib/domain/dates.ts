// Dates in Stokla are Türkiye calendar days (UTC+3, no daylight saving). Pure helpers, no I/O.

const TR_OFFSET_MS = 3 * 3600_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DAYS_BACK = 365;

/** Today's date in Türkiye as YYYY-MM-DD. */
export function todayTR(now = new Date()): string {
  return new Date(now.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of today in Türkiye as an ISO timestamp (21:00 UTC the day before). */
export function startOfTodayTR(now = new Date()): string {
  return new Date(Date.parse(`${todayTR(now)}T00:00:00Z`) - TR_OFFSET_MS).toISOString();
}

/** Hour of day (0–23) in Türkiye for a timestamp. */
export function hourTR(iso: string): number {
  return new Date(Date.parse(iso) + TR_OFFSET_MS).getUTCHours();
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export function isIsoDay(v: unknown): v is string {
  return typeof v === "string" && ISO_DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
}

export type DayCheck = { ok: true; day: string } | { ok: false; error: string };

/** The day goods arrived or a batch was made: today if empty, never in the future, at most a year back. */
export function checkMovementDay(input: string | null | undefined, now = new Date()): DayCheck {
  const today = todayTR(now);
  if (!input) return { ok: true, day: today };
  if (!isIsoDay(input)) return { ok: false, error: "Tarihi kontrol et." };
  if (input > today) return { ok: false, error: "Gelecek bir tarih girilemez." };
  if (input < addDays(today, -MAX_DAYS_BACK)) return { ok: false, error: "Tarih bir yıldan eski olamaz." };
  return { ok: true, day: input };
}

export type ExpiryCheck = { ok: true; expiresOn: string | null } | { ok: false; error: string };

/** Optional expiry date; when given it cannot be before the day the goods arrived or were made. */
export function checkExpiry(input: string | null | undefined, day: string): ExpiryCheck {
  if (!input) return { ok: true, expiresOn: null };
  if (!isIsoDay(input)) return { ok: false, error: "Son kullanma tarihini kontrol et." };
  if (input < day) return { ok: false, error: "Son kullanma tarihi, alış ya da üretim tarihinden önce olamaz." };
  return { ok: true, expiresOn: input };
}

/** Days from `today` until `day` (negative when already past). */
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** "Bugün", "Yarın", "3 gün sonra", "2 gün önce geçti". */
export function expiryLabel(day: string, today: string): string {
  const d = daysUntil(day, today);
  if (d === 0) return "Bugün";
  if (d === 1) return "Yarın";
  return d > 1 ? `${d} gün sonra` : `${-d} gün önce geçti`;
}

/** "8 Kas" style short day for tables. */
export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
}
