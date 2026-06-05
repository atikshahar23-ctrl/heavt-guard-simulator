import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getMarketNotes, formatHebrewDate, formatClock, type MarketNoteKind,
  getCalendarMonth, HEB_MONTH_NAMES, HEB_WEEKDAY_SHORT, type CalendarDay,
} from "@/lib/market-calendar";

const KIND_COLOR: Record<MarketNoteKind, string> = {
  holiday: "0 72% 60%",
  macro: "32 84% 55%",
  expiry: "276 60% 65%",
  weekend: "190 70% 55%",
  info: "152 50% 50%",
};

const DOT_PRIORITY: Record<MarketNoteKind, number> = {
  holiday: 5,
  macro: 4,
  expiry: 3,
  weekend: 1,
  info: 2,
};

function topNoteKind(day: CalendarDay): MarketNoteKind | null {
  if (!day.notes.length) return null;
  return day.notes.reduce((a, b) => (DOT_PRIORITY[a.kind] > DOT_PRIORITY[b.kind] ? a : b)).kind;
}

/**
 * Live digital clock with seconds + Hebrew date, plus a note about any special
 * market day. Hovering the date opens a mini calendar tooltip with all events.
 * Educational calendar only — not live data and not advice.
 */
export function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const containerRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const notes = getMarketNotes(now);
  const top = notes[0];
  const cells = getCalendarMonth(viewYear, viewMonth);
  const today = new Date();

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  // All upcoming events in the next 6 months
  const upcoming = useMemo(() => {
    const items: { date: string; label: string; kind: MarketNoteKind }[] = [];
    const seen = new Set<string>();
    for (let offset = 1; offset <= 180; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const ns = getMarketNotes(d);
      for (const n of ns) {
        const key = ymd(d) + "|" + n.label;
        if (seen.has(key)) continue;
        seen.add(key);
        const label = d.toLocaleDateString("he-IL", { day: "numeric", month: "short" }) + " — " + n.label;
        items.push({ date: ymd(d), label, kind: n.kind });
      }
    }
    return items;
  }, [today]);

  // Past events in the previous 6 months
  const pastEvents = useMemo(() => {
    const items: { date: string; label: string; kind: MarketNoteKind }[] = [];
    const seen = new Set<string>();
    for (let offset = 1; offset <= 180; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      const ns = getMarketNotes(d);
      for (const n of ns) {
        const key = ymd(d) + "|" + n.label;
        if (seen.has(key)) continue;
        seen.add(key);
        const label = d.toLocaleDateString("he-IL", { day: "numeric", month: "short" }) + " — " + n.label;
        items.push({ date: ymd(d), label, kind: n.kind });
      }
    }
    return items.reverse();
  }, [today]);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center gap-1 relative" dir="rtl">
      <div className="flex items-center gap-1.5">
        <CalendarClock className="h-3 w-3 text-primary/80" />
        <span
          className="font-mono text-lg short:text-base font-black tabular-nums tracking-[0.12em] text-primary"
          style={{ textShadow: "0 0 12px hsl(43 74% 52% / 0.45)" }}
        >
          {formatClock(now)}
        </span>
      </div>
      <span
        ref={dateRef}
        className="text-[9px] short:text-[8px] text-muted-foreground tracking-wide cursor-pointer hover:text-primary transition-colors"
        onMouseEnter={() => { hoverRef.current = true; setOpen(true); }}
        onMouseLeave={() => { hoverRef.current = false; setTimeout(() => { if (!hoverRef.current) setOpen(false); }, 300); }}
        onClick={() => setOpen((v) => !v)}
      >
        {formatHebrewDate(now)}
      </span>
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

      {/* ── Calendar tooltip ── */}
      {open && createPortal(
        <div
          ref={(el) => {
            if (!el || !dateRef.current) return;
            const rect = dateRef.current.getBoundingClientRect();
            const tipWidth = 260;
            const left = rect.left + rect.width / 2 - tipWidth / 2;
            el.style.position = "fixed";
            el.style.top = `${rect.bottom + 8}px`;
            el.style.left = `${Math.max(8, left)}px`;
          }}
          className="z-50 w-[260px] rounded-xl border border-border/70 bg-card/95 backdrop-blur-md shadow-2xl p-3"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.55)" }}
          onMouseEnter={() => { hoverRef.current = true; }}
          onMouseLeave={() => { hoverRef.current = false; setTimeout(() => { if (!hoverRef.current) setOpen(false); }, 300); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button className="rounded p-0.5 hover:bg-primary/10 transition-colors" onClick={prevMonth}>
              <ChevronRight className="h-3.5 w-3.5 text-primary" />
            </button>
            <span className="text-xs font-bold text-primary">
              {HEB_MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button className="rounded p-0.5 hover:bg-primary/10 transition-colors" onClick={nextMonth}>
              <ChevronLeft className="h-3.5 w-3.5 text-primary" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {HEB_WEEKDAY_SHORT.map((w) => (
              <div key={w} className="text-center text-[8px] font-bold text-muted-foreground uppercase">{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1.5 gap-x-1">
            {cells.map((day, i) => {
              const kind = topNoteKind(day);
              return (
                <div key={i} className="relative flex flex-col items-center justify-center gap-0.5 py-1 rounded">
                  <span
                    className={`text-[10px] leading-none ${day.isCurrentMonth ? (day.isToday ? "font-bold text-primary" : "text-foreground/90") : "text-muted-foreground/50"}`}
                  >
                    {day.day}
                  </span>
                  {kind && (
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: `hsl(${KIND_COLOR[kind]})` }}
                      title={day.notes.map((n) => n.label).join(" · ")}
                    />
                  )}
                  {day.isToday && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-primary/80" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(
              [
                ["holiday", "חג"],
                ["macro", "FOMC/NFP"],
                ["expiry", "תפוגה"],
                ["weekend", "סוף שבוע"],
                ["info", "סוף חודש"],
              ] as [MarketNoteKind, string][]
            ).map(([k, label]) => (
              <div key={k} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${KIND_COLOR[k]})` }} />
                <span className="text-[8px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* אירועים בגואה עומדים + הבאים */}
          <div className="mt-2 border-t border-border/40 pt-2 space-y-1">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">אירועים חוזרים ועתידים</div>
            <div className="max-h-[140px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
              {pastEvents.length > 0 && (
                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider pt-1">חוזרים</div>
              )}
              {pastEvents.map((ev, i) => (
                <div key={"past-" + i} className="flex items-start gap-1.5 rounded-md bg-secondary/20 px-1.5 py-1 opacity-60">
                  <span className="h-1.5 w-1.5 mt-0.5 rounded-full shrink-0" style={{ background: `hsl(${KIND_COLOR[ev.kind]})` }} />
                  <span className="text-[9px] text-foreground/80 leading-snug">{ev.label}</span>
                </div>
              ))}
              {upcoming.length > 0 && (
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pt-1">עתידים</div>
              )}
              {upcoming.map((ev, i) => (
                <div key={"up-" + i} className="flex items-start gap-1.5 rounded-md bg-secondary/20 px-1.5 py-1">
                  <span className="h-1.5 w-1.5 mt-0.5 rounded-full shrink-0" style={{ background: `hsl(${KIND_COLOR[ev.kind]})` }} />
                  <span className="text-[9px] text-foreground/80 leading-snug">{ev.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

/** helper for YYYY-MM-DD */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
