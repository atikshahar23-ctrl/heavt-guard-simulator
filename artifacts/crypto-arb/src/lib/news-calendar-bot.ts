/**
 * News Calendar Bot — a 100% free, rule-based engine (NO paid AI) that reads the
 * live news feed, extracts the dates it mentions, classifies how market-moving
 * each item is, and merges them with the static macro calendar so the app can
 * fill a calendar and warn the user a couple of days before important events.
 *
 * Educational context only — scheduled/known calendar items and headline parsing,
 * not live financial data and not financial advice.
 */

import { getMarketNotes } from "./market-calendar";
import type { Lang } from "./i18n";

export type EventImpact = "high" | "medium" | "low";
export type EventSource = "news" | "macro";

export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD in local time. */
  date: string;
  title: string;
  impact: EventImpact;
  /** Hebrew category label for display. */
  category: string;
  source: EventSource;
  url?: string;
  /** Original (English) headline, kept for the news source line. */
  rawHeadline?: string;
}

interface NewsLike {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_RE =
  "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december";

/** Importance + category lexicon. First match wins (most market-moving first). */
const CAT_MACRO = { he: "מאקרו", en: "Macro" };
const CAT_REGULATION = { he: "רגולציה", en: "Regulation" };
const CAT_CRYPTO = { he: "קריפטו", en: "Crypto" };
const CAT_STOCKS = { he: "מניות", en: "Stocks" };
const KEYWORDS: { re: RegExp; impact: EventImpact; category: { he: string; en: string } }[] = [
  { re: /fomc|rate decision|interest rate|federal reserve|\bfed\b|rate cut|rate hike/i, impact: "high", category: CAT_MACRO },
  { re: /\bcpi\b|inflation|\bppi\b|pce\b/i, impact: "high", category: CAT_MACRO },
  { re: /jobs report|non-?farm|payrolls|\bnfp\b|unemployment/i, impact: "high", category: CAT_MACRO },
  { re: /\betf\b/i, impact: "high", category: CAT_REGULATION },
  { re: /\bsec\b|securities and exchange|\bcftc\b|regulat|lawsuit|\bsues?\b|court|settlement|\bban\b|approval|deadline/i, impact: "high", category: CAT_REGULATION },
  { re: /halving|hard fork|mainnet|token unlock|\bunlock\b|airdrop|token generation|\btge\b|snapshot/i, impact: "high", category: CAT_CRYPTO },
  { re: /hack|exploit|breach|stolen|drained/i, impact: "high", category: CAT_CRYPTO },
  { re: /earnings|guidance|quarterly results|revenue/i, impact: "medium", category: CAT_STOCKS },
  { re: /upgrade|launch|listing|partnership|integration|rollout|release|conference|summit/i, impact: "medium", category: CAT_CRYPTO },
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Parse a YYYY-MM-DD key back into a local-midnight Date. */
export function parseEventDate(key: string): Date {
  return startOfDay(new Date(`${key}T00:00:00`));
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/** Google News appends " - Publisher"; drop it for a cleaner calendar label. */
function cleanTitle(title: string): string {
  return title.replace(/\s+-\s+[^-]+$/, "").trim() || title.trim();
}

function classify(title: string, lang: Lang = "he"): { impact: EventImpact; category: string } {
  for (const k of KEYWORDS) {
    if (k.re.test(title)) return { impact: k.impact, category: lang === "en" ? k.category.en : k.category.he };
  }
  return { impact: "low", category: lang === "en" ? "News" : "חדשות" };
}

/** Build a local-midnight Date only if y/m/d survive without JS rollover. */
function safeDate(year: number, month0: number, day: number): Date | null {
  if (month0 < 0 || month0 > 11 || day < 1 || day > 31) return null;
  const d = startOfDay(new Date(year, month0, day));
  if (d.getFullYear() !== year || d.getMonth() !== month0 || d.getDate() !== day) {
    return null; // e.g. Feb 31 rolled into March — reject it
  }
  return d;
}

/** Pick the year that places a bare "Month DD" nearest in the (recent) future. */
function resolveMonthDay(month0: number, day: number, ref: Date): Date | null {
  if (day < 1 || day > 31) return null;
  const refStart = startOfDay(ref);
  const weekAgo = new Date(refStart);
  weekAgo.setDate(weekAgo.getDate() - 7);
  let cand = safeDate(refStart.getFullYear(), month0, day);
  if (cand && cand < weekAgo) {
    cand = safeDate(refStart.getFullYear() + 1, month0, day);
  }
  return cand;
}

function parsePublished(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

/** Extract a future-ish date mentioned in a headline, relative to its publish time. */
function extractDate(title: string, ref: Date): Date | null {
  const lower = title.toLowerCase();

  if (/\btoday\b/.test(lower)) return startOfDay(ref);
  if (/\btomorrow\b/.test(lower)) {
    const d = startOfDay(ref);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const iso = title.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return safeDate(+iso[1], +iso[2] - 1, +iso[3]);

  const md = title.match(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"));
  if (md) {
    const mo = MONTHS[md[1].toLowerCase()];
    if (mo !== undefined) return resolveMonthDay(mo, parseInt(md[2], 10), ref);
  }

  const dm = title.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b`, "i"));
  if (dm) {
    const mo = MONTHS[dm[2].toLowerCase()];
    if (mo !== undefined) return resolveMonthDay(mo, parseInt(dm[1], 10), ref);
  }

  return null;
}

/** Turn raw news headlines into dated calendar events. */
export function extractEventsFromNews(news: NewsLike[], now: Date, lang: Lang = "he"): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const today = startOfDay(now);
  const maxFuture = new Date(today);
  maxFuture.setFullYear(maxFuture.getFullYear() + 1);

  for (const item of news) {
    if (!item || typeof item.title !== "string" || !item.title.trim()) continue;
    const ref = parsePublished(item.publishedAt, now);
    const date = extractDate(item.title, ref);
    if (!date) continue;
    if (date < today || date > maxFuture) continue;

    const { impact, category } = classify(item.title, lang);
    out.push({
      id: `news:${ymd(date)}:${hash(item.title)}`,
      date: ymd(date),
      title: cleanTitle(item.title),
      impact,
      category,
      source: "news",
      url: item.url,
      rawHeadline: item.title,
    });
  }
  return out;
}

/** Pull the static macro calendar (FOMC / NFP / expiry / holidays) over a window. */
export function getMacroEvents(now: Date, lang: Lang = "he", daysAhead = 60): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const start = startOfDay(now);
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    for (const n of getMarketNotes(d, lang)) {
      if (n.kind === "weekend") continue; // too noisy for a curated calendar
      const impact: EventImpact = n.kind === "macro" ? "high" : n.kind === "expiry" ? "medium" : "low";
      const category =
        n.kind === "macro"
          ? (lang === "en" ? "Macro" : "מאקרו")
          : n.kind === "expiry"
            ? (lang === "en" ? "Derivatives" : "נגזרים")
            : n.kind === "holiday"
              ? (lang === "en" ? "Holidays" : "חגים")
              : (lang === "en" ? "General" : "כללי");
      out.push({ id: `macro:${ymd(d)}:${n.short}`, date: ymd(d), title: n.label, impact, category, source: "macro" });
    }
  }
  return out;
}

function impactRank(i: EventImpact): number {
  return i === "high" ? 3 : i === "medium" ? 2 : 1;
}

/** Merge macro + news events, de-dupe, and sort by date then importance. */
export function buildCalendarEvents(news: NewsLike[] | undefined, now: Date, lang: Lang = "he"): CalendarEvent[] {
  const merged = [...getMacroEvents(now, lang), ...extractEventsFromNews(news ?? [], now, lang)];
  const seen = new Set<string>();
  const deduped = merged.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  deduped.sort((a, b) => a.date.localeCompare(b.date) || impactRank(b.impact) - impactRank(a.impact));
  return deduped;
}

/** Events from today through `days` days ahead (inclusive). */
export function eventsWithinDays(events: CalendarEvent[], now: Date, days: number): CalendarEvent[] {
  const today = startOfDay(now);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return events.filter((e) => {
    const d = parseEventDate(e.date);
    return d >= today && d <= limit;
  });
}

/** Whole-day difference between an event and today (0 = today, 1 = tomorrow…). */
export function daysUntil(event: CalendarEvent, now: Date): number {
  const today = startOfDay(now).getTime();
  const d = parseEventDate(event.date).getTime();
  return Math.round((d - today) / 86_400_000);
}

/** Relative-day label for an event. */
export function relativeDayLabel(event: CalendarEvent, now: Date, lang: Lang = "he"): string {
  const n = daysUntil(event, now);
  if (lang === "en") {
    if (n <= 0) return "Today";
    if (n === 1) return "Tomorrow";
    if (n === 2) return "In 2 days";
    return `In ${n} days`;
  }
  if (n <= 0) return "היום";
  if (n === 1) return "מחר";
  if (n === 2) return "בעוד יומיים";
  return `בעוד ${n} ימים`;
}
