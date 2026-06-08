import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock, AlertTriangle, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, X,
} from "lucide-react";
import {
  getMarketNotes, formatHebrewDate, formatClock, type MarketNoteKind, type MarketNote,
  getCalendarMonth, HEB_MONTH_NAMES, HEB_WEEKDAY_SHORT, type CalendarDay,
} from "@/lib/market-calendar";

const KIND_COLOR: Record<MarketNoteKind, string> = {
  holiday: "0 72% 60%",
  macro: "207 30% 70%",
  expiry: "276 60% 65%",
  weekend: "190 70% 55%",
  info: "152 50% 50%",
};

const KIND_LABEL: Record<MarketNoteKind, string> = {
  holiday: "חג",
  macro: "FOMC/NFP",
  expiry: "תפוגה",
  weekend: "סוף שבוע",
  info: "סוף חודש",
};

const DOT_PRIORITY: Record<MarketNoteKind, number> = {
  holiday: 5,
  macro: 4,
  expiry: 3,
  weekend: 1,
  info: 2,
};

/** Notes sorted by market impact (most impactful first). */
function sortedNotes(notes: MarketNote[]): MarketNote[] {
  return [...notes].sort((a, b) => DOT_PRIORITY[b.kind] - DOT_PRIORITY[a.kind]);
}

/**
 * Live digital clock with seconds + Hebrew date, plus a note about any special
 * market day. Clicking the date opens a full calendar with month/year navigation
 * and the events shown inside each day cell.
 * Educational calendar only — not live data and not advice.
 */
export function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selected, setSelected] = useState<{ year: number; month: number; day: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const notes = getMarketNotes(now);
  const top = notes[0];
  const cells = getCalendarMonth(viewYear, viewMonth);

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelected({ year: t.getFullYear(), month: t.getMonth(), day: t.getDate() });
  };

  // The notes for the currently selected day (shown in the detail panel).
  const selectedNotes = useMemo(() => {
    if (!selected) return null;
    const d = new Date(selected.year, selected.month, selected.day);
    return { date: d, notes: sortedNotes(getMarketNotes(d)) };
  }, [selected]);

  return (
    <div className="w-full flex flex-col items-center gap-1 relative" dir="rtl">
      <div className="flex items-center gap-1.5">
        <CalendarClock className="h-3 w-3 text-primary/80" />
        <span
          className="font-mono text-lg short:text-base font-black tabular-nums tracking-[0.12em] text-primary"
          style={{ textShadow: "0 0 12px hsl(207 30% 70% / 0.45)" }}
        >
          {formatClock(now)}
        </span>
      </div>
      <button
        type="button"
        className="text-[9px] short:text-[8px] text-muted-foreground tracking-wide cursor-pointer hover:text-primary transition-colors"
        onClick={() => {
          const t = new Date();
          setViewYear(t.getFullYear());
          setViewMonth(t.getMonth());
          setSelected({ year: t.getFullYear(), month: t.getMonth(), day: t.getDate() });
          setOpen(true);
        }}
      >
        {formatHebrewDate(now)}
      </button>
      {top && (
        <div
          className="mt-0.5 flex items-start gap-1 rounded-md px-2 py-1 w-full"
          style={{ background: `hsl(${KIND_COLOR[top.kind]} / 0.1)`, border: `1px solid hsl(${KIND_COLOR[top.kind]} / 0.3)` }}
          title={notes.map((n) => n.label).join(" · ")}
        >
          <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" style={{ color: `hsl(${KIND_COLOR[top.kind]})` }} />
          <span className="text-[8.5px] leading-tight text-foreground/85">
            {top.label}
            {notes.length > 1 && <span className="text-muted-foreground"> +{notes.length - 1}</span>}
          </span>
        </div>
      )}

      {/* ── Full calendar modal ── */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          dir="rtl"
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/70 bg-card shadow-2xl"
            style={{ boxShadow: "0 8px 48px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: navigation */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-card/95 backdrop-blur-md px-4 py-3">
              <div className="flex items-center gap-1">
                <button
                  className="rounded-lg p-1.5 hover:bg-primary/10 transition-colors"
                  onClick={() => setViewYear((y) => y - 1)}
                  title="שנה קודמת"
                >
                  <ChevronsRight className="h-4 w-4 text-primary" />
                </button>
                <button
                  className="rounded-lg p-1.5 hover:bg-primary/10 transition-colors"
                  onClick={prevMonth}
                  title="חודש קודם"
                >
                  <ChevronRight className="h-4 w-4 text-primary" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-base font-black text-primary tabular-nums min-w-[140px] text-center">
                  {HEB_MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                  onClick={goToday}
                >
                  היום
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  className="rounded-lg p-1.5 hover:bg-primary/10 transition-colors"
                  onClick={nextMonth}
                  title="חודש הבא"
                >
                  <ChevronLeft className="h-4 w-4 text-primary" />
                </button>
                <button
                  className="rounded-lg p-1.5 hover:bg-primary/10 transition-colors"
                  onClick={() => setViewYear((y) => y + 1)}
                  title="שנה הבאה"
                >
                  <ChevronsLeft className="h-4 w-4 text-primary" />
                </button>
                <button
                  className="rounded-lg p-1.5 hover:bg-secondary transition-colors mr-1"
                  onClick={() => setOpen(false)}
                  title="סגירה"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {HEB_WEEKDAY_SHORT.map((w) => (
                  <div key={w} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">{w}</div>
                ))}
              </div>

              {/* Day grid — events inside each cell */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  const isSel = selected && day.day != null && selected.day === day.day &&
                    selected.month === day.month && selected.year === day.year;
                  const ns = sortedNotes(day.notes);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => day.day != null && setSelected({ year: day.year, month: day.month, day: day.day })}
                      className={`relative flex flex-col items-stretch gap-0.5 rounded-lg p-1 min-h-[56px] sm:min-h-[68px] text-right border transition-colors
                        ${day.isCurrentMonth ? "bg-secondary/20 hover:bg-secondary/40" : "bg-transparent opacity-40 hover:opacity-70"}
                        ${day.isToday ? "border-primary/70 ring-1 ring-primary/40" : "border-border/30"}
                        ${isSel ? "ring-2 ring-primary bg-primary/10" : ""}`}
                    >
                      <span
                        className={`text-[11px] leading-none font-bold tabular-nums px-0.5
                          ${day.isToday ? "text-primary" : day.isCurrentMonth ? "text-foreground/90" : "text-muted-foreground/60"}
                          ${day.isWeekend && day.isCurrentMonth ? "text-[#9fb4c7]/80" : ""}`}
                      >
                        {day.day}
                      </span>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {ns.slice(0, 2).map((n, j) => (
                          <span
                            key={j}
                            className="truncate rounded px-1 py-0.5 text-[7.5px] sm:text-[8.5px] leading-tight font-medium"
                            style={{
                              background: `hsl(${KIND_COLOR[n.kind]} / 0.18)`,
                              color: `hsl(${KIND_COLOR[n.kind]})`,
                            }}
                            title={n.label}
                          >
                            {n.short}
                          </span>
                        ))}
                        {ns.length > 2 && (
                          <span className="text-[7.5px] text-muted-foreground px-1">+{ns.length - 2}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-2.5 border-t border-border/40 pt-3">
                {(Object.keys(KIND_LABEL) as MarketNoteKind[]).map((k) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${KIND_COLOR[k]})` }} />
                    <span className="text-[9px] text-muted-foreground">{KIND_LABEL[k]}</span>
                  </div>
                ))}
              </div>

              {/* Selected-day details */}
              {selectedNotes && (
                <div className="mt-3 rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <div className="text-xs font-bold text-primary mb-2">
                    {formatHebrewDate(selectedNotes.date)}
                  </div>
                  {selectedNotes.notes.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">אין אירועים מיוחדים ביום זה — מסחר רגיל.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedNotes.notes.map((n, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-lg bg-card/60 px-2 py-1.5">
                          <span
                            className="h-2 w-2 mt-1 rounded-full shrink-0"
                            style={{ background: `hsl(${KIND_COLOR[n.kind]})` }}
                          />
                          <span className="text-[11px] leading-snug text-foreground/85">{n.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 text-center text-[8.5px] text-muted-foreground/70">
                לוח חינוכי בלבד — תאריכים ידועים מראש, לא נתונים חיים ולא ייעוץ פיננסי.
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
