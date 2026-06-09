import { useMemo, useState } from "react";
import {
  CalendarDays,
  Bell,
  RefreshCw,
  Newspaper,
  Landmark,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Bot,
} from "lucide-react";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import {
  getCalendarMonth,
  monthNames,
  weekdayShort,
} from "@/lib/market-calendar";
import {
  parseEventDate,
  relativeDayLabel,
  daysUntil,
  type CalendarEvent,
  type EventImpact,
} from "@/lib/news-calendar-bot";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";

const IMPACT_DOT: Record<EventImpact, string> = {
  high: "bg-rose-400",
  medium: "bg-[#cdbfa4]",
  low: "bg-sky-400/70",
};

const IMPACT_LABEL_KEY: Record<EventImpact, string> = {
  high: "calendar.impactHigh",
  medium: "calendar.impactMedium",
  low: "calendar.impactLow",
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarPage() {
  const { lang, dir } = useLanguage();
  const { events, upcoming, isLoading, fetchedAt, refetch } = useCalendarEvents(lang);
  const today = new Date();
  const dateLocale = lang === "en" ? "en-US" : "he-IL";
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(ymd(today));

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => getCalendarMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedEvents = eventsByDate.get(selected) ?? [];
  const newsCount = events.filter((e) => e.source === "news").length;
  const macroCount = events.filter((e) => e.source === "macro").length;

  const upcoming14 = useMemo(() => {
    const limit = new Date(today);
    limit.setHours(0, 0, 0, 0);
    limit.setDate(limit.getDate() + 14);
    const t0 = new Date(today);
    t0.setHours(0, 0, 0, 0);
    return events
      .filter((e) => {
        const d = parseEventDate(e.date);
        return d >= t0 && d <= limit;
      })
      .slice(0, 30);
  }, [events]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div dir={dir} className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[#cdbfa4]/25 bg-[#cdbfa4]/5">
            <CalendarDays className="h-5 w-5 text-[#cdbfa4]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="uhnw-heading text-xl md:text-2xl text-foreground flex items-center gap-2">
              {t("calendar.title", lang)}
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-[#cdbfa4]/80 border border-[#cdbfa4]/25 rounded px-1.5 py-0.5">
                <Bot className="h-3 w-3" /> {t("calendar.autoBot", lang)}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide mt-0.5">
              {t("calendar.subtitle", lang)}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-[#cdbfa4]/40 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          {t("leaderboard.refresh", lang)}
        </button>
      </header>

      {/* Bot status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Landmark className="h-4 w-4 text-[#cdbfa4]" />} label={t("calendar.statMacro", lang)} value={macroCount} />
        <StatCard icon={<Newspaper className="h-4 w-4 text-sky-400" />} label={t("calendar.statNews", lang)} value={newsCount} />
        <StatCard icon={<Bell className="h-4 w-4 text-rose-400" />} label={t("calendar.statUpcoming", lang)} value={upcoming.length} />
        <StatCard
          icon={<RefreshCw className="h-4 w-4 text-emerald-400" />}
          label={t("calendar.statUpdated", lang)}
          value={fetchedAt ? new Date(fetchedAt).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" }) : "—"}
        />
      </div>

      {/* 2-day alert banner */}
      {upcoming.filter((e) => e.impact !== "low").length > 0 && (
        <div className="rounded-md border border-rose-400/25 bg-rose-400/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-rose-400" />
            <span className="text-sm font-medium text-foreground">{t("calendar.alertTitle", lang)}</span>
          </div>
          <div className="space-y-2">
            {upcoming
              .filter((e) => e.impact !== "low")
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground/90 leading-snug">{e.title}</span>
                  <span className="shrink-0 text-xs font-medium text-rose-300">{relativeDayLabel(e, today)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <section className="lg:col-span-2 uhnw-panel p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" aria-label={t("calendar.prevMonth", lang)}>
              <ChevronRight className="h-4 w-4" />
            </button>
            <h2 className="uhnw-heading text-lg text-foreground">
              {monthNames(lang)[viewMonth]} {viewYear}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" aria-label={t("calendar.nextMonth", lang)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdayShort(lang).map((d) => (
              <div key={d} className="text-center text-[10px] font-mono text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => {
              if (cell.day === null) return <div key={i} />;
              const key = `${cell.year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
              const dayEvents = eventsByDate.get(key) ?? [];
              const isSelected = key === selected;
              const topImpact: EventImpact | null = dayEvents.some((e) => e.impact === "high")
                ? "high"
                : dayEvents.some((e) => e.impact === "medium")
                  ? "medium"
                  : dayEvents.length
                    ? "low"
                    : null;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={`relative min-h-[3.2rem] md:min-h-[4rem] rounded-md border p-1.5 text-right transition-all ${
                    isSelected
                      ? "border-[#cdbfa4]/60 bg-[#cdbfa4]/[0.08]"
                      : cell.isToday
                        ? "border-[#cdbfa4]/30 bg-white/[0.02]"
                        : "border-white/[0.04] hover:border-white/10 hover:bg-white/[0.02]"
                  } ${!cell.isCurrentMonth ? "opacity-35" : ""}`}
                >
                  <span className={`text-xs ${cell.isToday ? "text-[#cdbfa4] font-semibold" : "text-foreground/80"}`}>
                    {cell.day}
                  </span>
                  {topImpact && (
                    <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                      {dayEvents.slice(0, 3).map((e, j) => (
                        <span key={j} className={`h-1.5 w-1.5 rounded-full ${IMPACT_DOT[e.impact]}`} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
            <Legend className="bg-rose-400" label={t("calendar.legendHigh", lang)} />
            <Legend className="bg-[#cdbfa4]" label={t("calendar.legendMedium", lang)} />
            <Legend className="bg-sky-400/70" label={t("calendar.legendLow", lang)} />
          </div>
        </section>

        {/* Side panels */}
        <div className="space-y-6">
          {/* Selected day */}
          <section className="uhnw-panel p-5">
            <h3 className="uhnw-heading text-base text-foreground mb-1">
              {parseEventDate(selected).toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            <p className="text-[11px] text-muted-foreground mb-4">{t("calendar.eventsCount", lang).replace("{n}", String(selectedEvents.length))}</p>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">{t("calendar.noEventsDay", lang)}</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((e) => (
                  <EventRow key={e.id} event={e} now={today} />
                ))}
              </div>
            )}
          </section>

          {/* Upcoming */}
          <section className="uhnw-panel p-5">
            <h3 className="uhnw-heading text-base text-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#cdbfa4]" /> {t("calendar.next2weeks", lang)}
            </h3>
            {upcoming14.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">{t("calendar.noUpcoming", lang)}</p>
            ) : (
              <div className="space-y-3">
                {upcoming14.map((e) => (
                  <EventRow key={e.id} event={e} now={today} showRelative />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/70 text-center pt-2">
        {t("calendar.footer", lang)}
      </p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="uhnw-panel p-3 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded bg-white/[0.03] shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-base font-semibold text-foreground leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground tracking-wide mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function EventRow({ event, now, showRelative }: { event: CalendarEvent; now: Date; showRelative?: boolean }) {
  const { lang } = useLanguage();
  const soon = daysUntil(event, now) <= 2;
  return (
    <div className="border-r-2 pr-3 pl-1 py-0.5" style={{ borderColor: event.impact === "high" ? "rgb(251 113 133)" : event.impact === "medium" ? "#cdbfa4" : "rgb(56 189 248 / 0.6)" }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-foreground/90 leading-snug">{event.title}</span>
        {event.url && (
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-[#cdbfa4] transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {event.source === "news" ? <Newspaper className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
          {event.category}
        </span>
        <span className="opacity-30">·</span>
        <span>{t(IMPACT_LABEL_KEY[event.impact], lang)}</span>
        {showRelative && (
          <>
            <span className="opacity-30">·</span>
            <span className={soon ? "text-rose-300 font-medium" : "text-[#cdbfa4]/80"}>{relativeDayLabel(event, now)}</span>
          </>
        )}
      </div>
    </div>
  );
}
