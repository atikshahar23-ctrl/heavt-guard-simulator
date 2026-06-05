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

export type MarketNoteKind = "holiday" | "macro" | "expiry" | "weekend" | "info";

export interface MarketNote {
  label: string;
  kind: MarketNoteKind;
}

/** YYYY-MM-DD key in local time. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** US stock-market (NYSE) holidays — full-day closes. */
const HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "ראש השנה האזרחי — שוק המניות בארה״ב סגור",
  "2026-01-19": "יום מרטין לותר קינג — שוק המניות בארה״ב סגור",
  "2026-02-16": "יום הנשיאים — שוק המניות בארה״ב סגור",
  "2026-04-03": "יום שישי הטוב — שוק המניות בארה״ב סגור",
  "2026-05-25": "יום הזיכרון (Memorial Day) — שוק המניות בארה״ב סגור",
  "2026-06-19": "Juneteenth — שוק המניות בארה״ב סגור",
  "2026-07-03": "ערב יום העצמאות (נצפה) — שוק המניות בארה״ב סגור",
  "2026-09-07": "Labor Day — שוק המניות בארה״ב סגור",
  "2026-11-26": "חג ההודיה — שוק המניות בארה״ב סגור",
  "2026-12-25": "חג המולד — שוק המניות בארה״ב סגור",
};

/** Scheduled FOMC interest-rate decision days (2nd day of each meeting). */
const FOMC_2026: Record<string, string> = {
  "2026-01-28": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
  "2026-03-18": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
  "2026-04-29": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
  "2026-06-17": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
  "2026-07-29": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
  "2026-09-16": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
  "2026-10-28": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
  "2026-12-16": "החלטת ריבית של הפד (FOMC) — תנודתיות צפויה",
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
export function getMarketNotes(date: Date): MarketNote[] {
  const notes: MarketNote[] = [];
  const key = ymd(date);
  const dow = date.getDay(); // 0 = Sun .. 6 = Sat
  const month = date.getMonth() + 1;

  if (HOLIDAYS_2026[key]) notes.push({ label: HOLIDAYS_2026[key], kind: "holiday" });
  if (FOMC_2026[key]) notes.push({ label: FOMC_2026[key], kind: "macro" });

  // Weekend — stocks closed, crypto keeps trading.
  if (dow === 0 || dow === 6) {
    notes.push({ label: "סוף שבוע — שוק המניות סגור, הקריפטו ממשיך לסחור 24/7", kind: "weekend" });
  }

  // First Friday → US Non-Farm Payrolls (jobs report).
  if (dow === 5 && weekdayOccurrence(date) === 1) {
    notes.push({ label: "דו״ח התעסוקה בארה״ב (NFP) — צפויה תנודתיות בפתיחה", kind: "macro" });
  }

  // Third Friday → monthly options expiry; quarterly months → triple witching.
  if (dow === 5 && weekdayOccurrence(date) === 3) {
    if (month === 3 || month === 6 || month === 9 || month === 12) {
      notes.push({ label: "תפוגה משולשת (Triple Witching) — מחזורי מסחר גבוהים", kind: "expiry" });
    } else {
      notes.push({ label: "תפוגת אופציות חודשית — ייתכנו תנודות חדות", kind: "expiry" });
    }
  }

  // Last trading day of the month → month-end rebalancing.
  if (isLastBusinessDayOfMonth(date)) {
    notes.push({ label: "סוף חודש — איזון תיקים מוסדי, ייתכנו תנועות חדות בסגירה", kind: "info" });
  }

  return notes;
}

/** Hebrew long-form date, e.g. "יום חמישי, 5 ביוני 2026". */
export function formatHebrewDate(date: Date): string {
  return date.toLocaleDateString("he-IL", {
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

/** A single cell in the calendar grid. */
export interface CalendarDay {
  day: number | null;
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
    cells.push({ day: prevMonthDays - i, notes: getMarketNotes(d), isToday: false, isCurrentMonth: false, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
  }

  // Current month
  const today = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({
      day: d,
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
    cells.push({ day: next, notes: getMarketNotes(d), isToday: false, isCurrentMonth: false, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
    next++;
  }

  return cells.slice(0, 42);
}
