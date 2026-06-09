/**
 * Free, fully-static market calendar — no API, no keys. Given a date it returns
 * Hebrew notes about anything market-relevant happening that day: US stock-market
 * holidays, scheduled FOMC decision days, recurring macro events (NFP / options
 * expiry / triple-witching) and the weekend stock close. Crypto trades 24/7, so
 * weekend/holiday notes are framed as "stocks closed" only.
 *
 * Educational context only — dates are scheduled/known calendar items, not live
 * data and not financial advice.
 */

import type { Lang } from "./i18n";

export type MarketNoteKind = "holiday" | "macro" | "expiry" | "weekend" | "info";

export interface MarketNote {
  label: string;
  /** Short tag for display inside a compact calendar cell. */
  short: string;
  kind: MarketNoteKind;
}

/** Pick the language-appropriate string from a bilingual pair. */
function pick(pair: { he: string; en: string }, lang: Lang): string {
  return lang === "en" ? pair.en : pair.he;
}

/** YYYY-MM-DD key in local time. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** US stock-market (NYSE) holidays — full-day closes. */
const HOLIDAYS_2026: Record<string, { he: string; en: string }> = {
  "2026-01-01": { he: "ראש השנה האזרחי — שוק המניות בארה״ב סגור", en: "New Year's Day — US stock market closed" },
  "2026-01-19": { he: "יום מרטין לותר קינג — שוק המניות בארה״ב סגור", en: "Martin Luther King Jr. Day — US stock market closed" },
  "2026-02-16": { he: "יום הנשיאים — שוק המניות בארה״ב סגור", en: "Presidents' Day — US stock market closed" },
  "2026-04-03": { he: "יום שישי הטוב — שוק המניות בארה״ב סגור", en: "Good Friday — US stock market closed" },
  "2026-05-25": { he: "יום הזיכרון (Memorial Day) — שוק המניות בארה״ב סגור", en: "Memorial Day — US stock market closed" },
  "2026-06-19": { he: "Juneteenth — שוק המניות בארה״ב סגור", en: "Juneteenth — US stock market closed" },
  "2026-07-03": { he: "ערב יום העצמאות (נצפה) — שוק המניות בארה״ב סגור", en: "Independence Day (observed) — US stock market closed" },
  "2026-09-07": { he: "Labor Day — שוק המניות בארה״ב סגור", en: "Labor Day — US stock market closed" },
  "2026-11-26": { he: "חג ההודיה — שוק המניות בארה״ב סגור", en: "Thanksgiving — US stock market closed" },
  "2026-12-25": { he: "חג המולד — שוק המניות בארה״ב סגור", en: "Christmas — US stock market closed" },
};

/** Scheduled FOMC interest-rate decision days (2nd day of each meeting). */
const FOMC_LABEL = { he: "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה", en: "Fed interest-rate decision (FOMC) — volatility expected" };
const FOMC_2026: Record<string, { he: string; en: string }> = {
  "2026-01-28": FOMC_LABEL,
  "2026-03-18": FOMC_LABEL,
  "2026-04-29": FOMC_LABEL,
  "2026-06-17": FOMC_LABEL,
  "2026-07-29": FOMC_LABEL,
  "2026-09-16": FOMC_LABEL,
  "2026-10-28": FOMC_LABEL,
  "2026-12-16": FOMC_LABEL,
};

/** Which occurrence of a weekday this date is within its month (1 = first). */
function weekdayOccurrence(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7) + 1;
}

/** Is this the last business (Mon-Fri) day of the month — no later weekday remains? */
function isLastBusinessDayOfMonth(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // weekends are never the last business day
  const month = d.getMonth();
  const probe = new Date(d);
  probe.setDate(d.getDate() + 1);
  while (probe.getMonth() === month) {
    const pdow = probe.getDay();
    if (pdow !== 0 && pdow !== 6) return false; // a later weekday still exists this month
    probe.setDate(probe.getDate() + 1);
  }
  return true;
}

/**
 * Resolve all market notes for a given date. Static + computed; safe to call
 * every render. The most market-moving note is returned first.
 */
export function getMarketNotes(date: Date, lang: Lang = "he"): MarketNote[] {
  const notes: MarketNote[] = [];
  const key = ymd(date);
  const dow = date.getDay(); // 0 = Sun .. 6 = Sat
  const month = date.getMonth() + 1;

  if (HOLIDAYS_2026[key]) notes.push({ label: pick(HOLIDAYS_2026[key], lang), short: "חג · שוק סגור", kind: "holiday" });
  if (FOMC_2026[key]) notes.push({ label: pick(FOMC_2026[key], lang), short: "ריבית הפד", kind: "macro" });

  // Weekend — stocks closed, crypto keeps trading.
  if (dow === 0 || dow === 6) {
    notes.push({ label: pick({ he: "סוף שבוע — שוק המניות סגור, הקריפטו ממשיך לסחור 24/7", en: "Weekend — stock market closed, crypto keeps trading 24/7" }, lang), short: "סופ״ש", kind: "weekend" });
  }

  // First Friday → US Non-Farm Payrolls (jobs report).
  if (dow === 5 && weekdayOccurrence(date) === 1) {
    notes.push({ label: pick({ he: "דו״ח התעסוקה בארה״ב (NFP) — צפויה תנודתיות בפתיחה", en: "US jobs report (NFP) — volatility expected at the open" }, lang), short: "NFP תעסוקה", kind: "macro" });
  }

  // Third Friday → monthly options expiry; quarterly months → triple witching.
  if (dow === 5 && weekdayOccurrence(date) === 3) {
    if (month === 3 || month === 6 || month === 9 || month === 12) {
      notes.push({ label: pick({ he: "תפוגה משולשת (Triple Witching) — מחזורי מסחר גבוהים", en: "Triple Witching — elevated trading volumes" }, lang), short: "תפוגה משולשת", kind: "expiry" });
    } else {
      notes.push({ label: pick({ he: "תפוגת אופציות חודשית — ייתכנו תנודות חדות", en: "Monthly options expiry — sharp moves possible" }, lang), short: "תפוגת אופציות", kind: "expiry" });
    }
  }

  // Last trading day of the month → month-end rebalancing.
  if (isLastBusinessDayOfMonth(date)) {
    notes.push({ label: pick({ he: "סוף חודש — איזון תיקים מוסדי, ייתכנו תנועות חדות בסגירה", en: "Month-end — institutional rebalancing, sharp moves possible into the close" }, lang), short: "סוף חודש", kind: "info" });
  }

  return notes;
}

/** Long-form date, e.g. "יום חמישי, 5 ביוני 2026" / "Thursday, June 5, 2026". */
export function formatHebrewDate(date: Date, lang: Lang = "he"): string {
  return date.toLocaleDateString(lang === "en" ? "en-US" : "he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** HH:MM:SS in 24h, zero-padded. */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Hebrew month names for the calendar header. */
export const HEB_MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

/** Hebrew weekday short names for the calendar header. */
export const HEB_WEEKDAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** English month names for the calendar header. */
export const EN_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** English weekday short names for the calendar header (Sun-first). */
export const EN_WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Language-aware month names for the calendar header. */
export function monthNames(lang: Lang): string[] {
  return lang === "en" ? EN_MONTH_NAMES : HEB_MONTH_NAMES;
}

/** Language-aware weekday short names for the calendar header. */
export function weekdayShort(lang: Lang): string[] {
  return lang === "en" ? EN_WEEKDAY_SHORT : HEB_WEEKDAY_SHORT;
}

/** A single cell in the calendar grid. */
export interface CalendarDay {
  day: number | null;
  /** Absolute calendar year this cell belongs to (may differ from the viewed month). */
  year: number;
  /** Absolute calendar month (0-11) this cell belongs to. */
  month: number;
  notes: MarketNote[];
  isToday: boolean;
  isCurrentMonth: boolean;
  isWeekend: boolean;
}

/** Build a full 7×6 week grid for a given month (year, month 0-11). */
export function getCalendarMonth(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: CalendarDay[] = [];

  // Pad with previous-month trailing days
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    cells.push({ day: prevMonthDays - i, year: d.getFullYear(), month: d.getMonth(), notes: getMarketNotes(d), isToday: false, isCurrentMonth: false, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
  }

  // Current month
  const today = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({
      day: d,
      year,
      month,
      notes: getMarketNotes(date),
      isToday: today.getDate() === d && today.getMonth() === month && today.getFullYear() === year,
      isCurrentMonth: true,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  // Pad with next-month leading days to fill the grid (max 42 cells)
  let next = 1;
  while (cells.length < 42) {
    const d = new Date(year, month + 1, next);
    cells.push({ day: next, year: d.getFullYear(), month: d.getMonth(), notes: getMarketNotes(d), isToday: false, isCurrentMonth: false, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
    next++;
  }

  return cells.slice(0, 42);
}
