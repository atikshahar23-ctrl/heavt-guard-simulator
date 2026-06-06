import { useMemo } from "react";
import {
  Brain, Gauge, TrendingUp, TrendingDown, BarChart3, Cpu, Sparkles,
  Clock, CalendarDays, Timer, Zap, Target, Activity,
  RotateCcw, AlertTriangle,
} from "lucide-react";
import { usePortfolio, type ClosedTrade, STARTING_BALANCE } from "@/contexts/portfolio-context";
import { useAutoTrader } from "@/contexts/autotrader-context";

/* Hebrew display labels */
const BOT_LABELS: Record<string, string> = {
  dipbuyer: "קונה ירידות",
  breakout: "צייד פריצות",
  dca: "צבירת בלו-צ'יפ",
  scalp: "סקאלפ",
  momentum: "מומנטום",
  stock: "כסף חכם",
  smart: "כסף חכם",
  poly: "הימורי קריפטו",
};

const TYPE_LABEL_HE: Record<ClosedTrade["type"], string> = {
  BINANCE: "פיוצ'רס",
  STOCK: "מניות",
  POLYMARKET: "הימורי שוק",
  FUNDING: "מימון דלתא-נייטרל",
};

const DAY_LABELS: Record<string, string> = {
  "0": "יום א'", "1": "יום ב'", "2": "יום ג'",
  "3": "יום ד'", "4": "יום ה'", "5": "יום ו'", "6": "יום שבת",
};

function usd(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function groupStats(arr: ClosedTrade[]) {
  const n = arr.length;
  const wins = arr.filter((t) => t.pnl > 0).length;
  const net = arr.reduce((a, t) => a + t.pnl, 0);
  return { n, wins, winRate: n ? (wins / n) * 100 : 0, net };
}

function Sparkline({ pts }: { pts: number[] }) {
  if (pts.length < 2) return null;
  const W = 600;
  const H = 120;
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, 0);
  const span = max - min || 1;
  const stepX = W / (pts.length - 1);
  const toY = (v: number) => H - ((v - min) / span) * H;
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const stroke = last >= 0 ? "#22c55e" : "#ef4444";
  const zeroY = toY(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-24">
      <defs>
        <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="hsl(0 0% 100% / 0.12)" strokeWidth="1" strokeDasharray="4 4" />
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#eqfill)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BreakdownRow({ label, s }: { label: string; s: ReturnType<typeof groupStats> }) {
  if (s.n === 0) return null;
  const net = s.net;
  const color = net > 0 ? "#22c55e" : net < 0 ? "#ef4444" : "#a1a1aa";
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
      <span className="text-foreground/80">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{s.n} עסקאות</span>
        <span className="text-muted-foreground">{s.winRate.toFixed(0)}% הצלחה</span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {net >= 0 ? "+" : ""}${usd(net)}
        </span>
      </div>
    </div>
  );
}

function StatBar({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums" style={{ color: color ?? "#a1a1aa" }}>{value}</span>
    </div>
  );
}

export function TradeAnalytics() {
  const { tradeHistory, cash, totalDeposited, resetPortfolio } = usePortfolio();
  const { settings } = useAutoTrader();

  /* ── Equity curve ── */
  const equity = useMemo(() => {
    const chrono = [...tradeHistory].reverse();
    let cum = 0;
    const pts = [0];
    for (const t of chrono) {
      cum += t.pnl;
      pts.push(cum);
    }
    return pts;
  }, [tradeHistory]);

  /* ── Expectancy ── */
  const expectancy = useMemo(() => {
    const n = tradeHistory.length;
    const winsArr = tradeHistory.filter((t) => t.pnl > 0);
    const lossArr = tradeHistory.filter((t) => t.pnl < 0);
    const avgWin = winsArr.length ? winsArr.reduce((a, t) => a + t.pnl, 0) / winsArr.length : 0;
    const avgLoss = lossArr.length ? Math.abs(lossArr.reduce((a, t) => a + t.pnl, 0) / lossArr.length) : 0;
    const winRate = n ? winsArr.length / n : 0;
    const exp = n ? tradeHistory.reduce((a, t) => a + t.pnl, 0) / n : 0;
    return { avgWin, avgLoss, winRate: winRate * 100, exp, n };
  }, [tradeHistory]);

  /* ── By type / exit / source ── */
  const byType = useMemo(() => {
    const t: ClosedTrade["type"][] = ["BINANCE", "STOCK", "POLYMARKET"];
    return t.map((k) => ({ key: k, s: groupStats(tradeHistory.filter((x) => x.type === k)) }));
  }, [tradeHistory]);

  const byExit = useMemo(() => {
    const reasons: { key: ClosedTrade["exit"] | "MANUAL"; label: string }[] = [
      { key: "TP", label: "יעד רווח (TP)" },
      { key: "SL", label: "עצירת הפסד (SL)" },
      { key: "LIQ", label: "חיסול (LIQ)" },
      { key: "MANUAL", label: "סגירה ידנית" },
    ];
    return reasons.map((r) => ({
      ...r,
      s: groupStats(tradeHistory.filter((x) => (x.exit ?? "MANUAL") === r.key)),
    }));
  }, [tradeHistory]);

  const bySource = useMemo(() => ({
    auto: groupStats(tradeHistory.filter((t) => t.auto)),
    manual: groupStats(tradeHistory.filter((t) => !t.auto)),
  }), [tradeHistory]);

  /* ── Streaks ── */
  const streaks = useMemo(() => {
    const chrono = [...tradeHistory].reverse();
    let maxWin = 0, maxLoss = 0;
    let curWin = 0, curLoss = 0;
    for (const t of chrono) {
      if (t.pnl > 0) { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
      else if (t.pnl < 0) { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
    }
    return { maxWin, maxLoss, curWin, curLoss };
  }, [tradeHistory]);

  /* ── Drawdown ── */
  const drawdown = useMemo(() => {
    if (equity.length < 2) return { max: 0, current: 0, peak: 0 };
    let peak = 0;
    let maxDD = 0;
    for (const v of equity) {
      if (v > peak) peak = v;
      const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
    }
    const last = equity[equity.length - 1];
    const currentDD = peak > 0 ? ((peak - last) / peak) * 100 : 0;
    return { max: maxDD, current: currentDD, peak };
  }, [equity]);

  /* ── Time-based ── */
  const timeStats = useMemo(() => {
    const trades = tradeHistory.filter((t) => t.openedAt && t.closedAt);
    const durations: number[] = [];
    const byDay: Record<string, { n: number; w: number }> = {};
    for (const t of trades) {
      const open = new Date(t.openedAt!);
      const close = new Date(t.closedAt);
      const ms = close.getTime() - open.getTime();
      durations.push(ms);
      const day = String(open.getDay());
      byDay[day] = { n: (byDay[day]?.n ?? 0) + 1, w: (byDay[day]?.w ?? 0) + (t.pnl > 0 ? 1 : 0) };
    }
    const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const avgH = Math.floor(avgMs / 3600_000);
    const avgM = Math.floor((avgMs % 3600_000) / 60000);
    const avgS = Math.floor((avgMs % 60000) / 1000);
    const avgHolding = avgMs > 3600_000 ? `${avgH}:‎${String(avgM).padStart(2, "0")}` : `${avgM}:‎${String(avgS).padStart(2, "0")}`;
    const days = Object.entries(byDay).map(([d, s]) => ({
      day: d,
      label: DAY_LABELS[d] ?? d,
      n: s.n,
      wr: s.n ? (s.w / s.n) * 100 : 0,
    })).sort((a, b) => Number(a.day) - Number(b.day));
    return { avgHolding, days, totalTrades: trades.length };
  }, [tradeHistory]);

  /* ── Risk/Reward ── */
  const riskMetrics = useMemo(() => {
    const n = tradeHistory.length;
    const wins = tradeHistory.filter((t) => t.pnl > 0);
    const losses = tradeHistory.filter((t) => t.pnl < 0);
    const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
    const avgCost = n ? tradeHistory.reduce((a, t) => a + t.cost, 0) / n : 0;
    const maxCost = n ? Math.max(...tradeHistory.map((t) => t.cost)) : 0;
    const minCost = n ? Math.min(...tradeHistory.map((t) => t.cost)) : 0;
    // R:R ratio — average winner / average loser
    const rr = expectancy.avgLoss > 0 ? expectancy.avgWin / expectancy.avgLoss : 0;
    // Recovery factor — total profit / max drawdown
    const recovery = drawdown.max > 0 ? Math.abs(grossWin - grossLoss) / drawdown.max : 0;
    return { grossWin, grossLoss, avgCost, maxCost, minCost, rr, recovery };
  }, [tradeHistory, expectancy, drawdown]);

  /* ── Per-bot adaptive stats ── */
  const bots = useMemo(
    () => Object.entries(settings.botStats).filter(([, st]) => st.trades > 0),
    [settings.botStats],
  );

  /* ── Insights ── */
  const insights = useMemo(() => {
    const out: string[] = [];
    if (tradeHistory.length === 0) {
      out.push("עדיין אין מספיק נתונים — הפעל את הבוטים כדי שהסוכן יתחיל ללמוד מהעסקאות.");
      return out;
    }
    const ranked = [...byType].filter((x) => x.s.n > 0).sort((a, b) => b.s.net - a.s.net);
    if (ranked.length) {
      const best = ranked[0];
      out.push(`האפיק הרווחי ביותר: ${TYPE_LABEL_HE[best.key]} (${best.s.net >= 0 ? "+" : ""}$${usd(best.s.net)}).`);
      const worst = ranked[ranked.length - 1];
      if (ranked.length > 1 && worst.s.net < 0) {
        out.push(`האפיק החלש ביותר: ${TYPE_LABEL_HE[worst.key]} ($${usd(worst.s.net)}) — הסוכן מהדק שם את הסלקטיביות.`);
      }
    }
    const tp = byExit.find((r) => r.key === "TP")?.s.n ?? 0;
    const sl = byExit.find((r) => r.key === "SL")?.s.n ?? 0;
    if (tp + sl > 0) {
      out.push(`יחס יעד-רווח מול עצירת-הפסד: ${tp} TP / ${sl} SL.`);
    }
    if (expectancy.n >= 10 && expectancy.winRate < 45) {
      out.push("אחוז ההצלחה נמוך — הסוכן מעלה את ספי הכניסה ומקטין חשיפה עד שהביצועים משתפרים.");
    }
    if (bySource.auto.n > 0 && bySource.manual.n > 0) {
      const diff = bySource.auto.winRate - bySource.manual.winRate;
      out.push(`מסחר אוטומטי לעומת ידני: ${bySource.auto.winRate.toFixed(0)}% מול ${bySource.manual.winRate.toFixed(0)}% הצלחה (פער ${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%).`);
    }
    if (streaks.maxLoss >= 3) {
      out.push(`רצף הפסדים הארוך ביותר: ${streaks.maxLoss} עסקאות רצופ — הסוכן מחזיר יותר זהירות.`);
    }
    if (drawdown.max >= 20) {
      out.push(`דד-דאון מקסימלי: ${drawdown.max.toFixed(1)}% — הסוכן עבור על האופציות האחרונות.`);
    }
    return out;
  }, [tradeHistory, byType, byExit, bySource, expectancy, streaks, drawdown]);

  const hasData = tradeHistory.length > 0;

  return (
    <div dir="rtl" className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black tracking-tight">ניתוח עסקאות ולמידת הסוכן</h2>
        </div>
        {/* Reset wallet button */}
        <button
          onClick={() => {
            if (confirm(`לאפס את תיק המסחר? הפעולה תמחק את כל ההיסטוריה, הפוזיציות הפתוחות, נתוני הלמידה והיתרה — ותוחזר אותו למצב פתיחה ($${STARTING_BALANCE.toLocaleString()}). פעולה בלת חזור.`))
              resetPortfolio();
          }}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-mono font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors flex-shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" /> הוזל אחורה לבסיס הארנק
        </button>
      </div>

      {/* ── Equity curve ── */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> עקומת הון (רווח/הפסד מצטבר)
        </div>
        {equity.length > 1 ? (
          <Sparkline pts={equity} />
        ) : (
          <p className="text-[11px] text-muted-foreground py-6 text-center">אין עדיין עסקאות סגורות להצגת עקומה.</p>
        )}
      </div>

      {/* ── Core metrics grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Expectancy */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Gauge className="h-3 w-3" /> תוחלת וביצועים
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">תוחלת לעסקה</span>
              <span className="font-bold tabular-nums" style={{ color: expectancy.exp >= 0 ? "#22c55e" : "#ef4444" }}>
                {expectancy.exp >= 0 ? "+" : ""}${usd(expectancy.exp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">אחוז הצלחה</span>
              <span className="font-bold tabular-nums">{expectancy.winRate.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">רווח ממוצע</span>
              <span className="font-bold tabular-nums text-[#22c55e]">+${usd(expectancy.avgWin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">הפסד ממוצע</span>
              <span className="font-bold tabular-nums text-[#ef4444]">-${usd(expectancy.avgLoss)}</span>
            </div>
          </div>
          <div className="h-px bg-border/50" />
          <div className="space-y-1.5">
            {byType.map(({ key, s }) => (
              <BreakdownRow key={key} label={TYPE_LABEL_HE[key]} s={s} />
            ))}
          </div>
        </div>

        {/* Exit reasons + source */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="h-3 w-3" /> פילוח לפי סיבת יציאה
          </div>
          <div className="space-y-1.5">
            {byExit.map((r) => (
              <BreakdownRow key={r.key} label={r.label} s={r.s} />
            ))}
          </div>
          <div className="h-px bg-border/50" />
          <div className="space-y-1.5">
            <BreakdownRow label="אוטומטי" s={bySource.auto} />
            <BreakdownRow label="ידני" s={bySource.manual} />
          </div>
        </div>

        {/* Streaks + Drawdown + Risk */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3" /> רצפים, דד-דאון וסיכון
          </div>
          <div className="space-y-1.5">
            <StatBar label="רצף ניצחונות ארוך" value={String(streaks.maxWin)} color="#22c55e" />
            <StatBar label="רצף הפסדים ארוך" value={String(streaks.maxLoss)} color="#ef4444" />
            <StatBar label="רצף הפסדים האחרון" value={String(streaks.curLoss)} color={streaks.curLoss >= 2 ? "#ef4444" : "#a1a1aa"} />
            <div className="h-px bg-border/50" />
            <StatBar label="דד-דאון מקסימלי" value={`${drawdown.max.toFixed(1)}%`} color={drawdown.max >= 20 ? "#ef4444" : "#a1a1aa"} />
            <StatBar label="דד-דאון נוכחי" value={`${drawdown.current.toFixed(1)}%`} color={drawdown.current >= 10 ? "#ef4444" : "#a1a1aa"} />
            <StatBar label="שווי שיאי הון" value={hasData ? `$${usd(riskMetrics.avgCost)}` : "—"} />
            <StatBar label="יחס R:R" value={riskMetrics.rr > 0 ? `${riskMetrics.rr.toFixed(2)}:1` : "—"} color={riskMetrics.rr >= 1.5 ? "#22c55e" : "#a1a1aa"} />
          </div>
          {drawdown.max >= 20 && (
            <p className="text-[10px] text-red-400/80 flex items-center gap-1" dir="rtl">
              <AlertTriangle className="h-3 w-3" /> דד-דאון מודגש — הסוכן הודיע ומבטל פתיחות חדשות.
            </p>
          )}
        </div>
      </div>

      {/* ── Time-based analytics ── */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Holding time */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" /> זמן החזקה ממוצע
            </div>
            <div className="text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <Timer className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">ממוצע עסקה נפתחה:</span>
                <span className="font-bold">{timeStats.avgHolding}</span>
                {timeStats.avgHolding.includes(":") && (
                  <span className="text-[10px] text-muted-foreground">
                    {timeStats.avgHolding.split(":")[0].length <= 2 ? "דקות" : "שעות"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">עסקאות עם זמן פתיחה/סגירה:</span>
                <span className="font-bold">{timeStats.totalTrades}</span>
              </div>
            </div>
          </div>

          {/* Win rate by day */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> אחוז הצלחה לפי יום בשבוע
            </div>
            <div className="space-y-1">
              {timeStats.days.map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-muted-foreground w-16">{d.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-background/60 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.wr}%`,
                        background: d.wr >= 60 ? "#22c55e" : d.wr >= 40 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground w-10 text-left">{d.n} עס</span>
                  <span className="font-bold w-10 text-left" style={{ color: d.wr >= 60 ? "#22c55e" : d.wr >= 40 ? "#f59e0b" : "#ef4444" }}>
                    {d.wr.toFixed(0)}%
                  </span>
                </div>
              ))}
              {timeStats.days.length === 0 && (
                <p className="text-[11px] text-muted-foreground">אין מספיק נתונים יומיים עדיין.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Agent learning ── */}
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Brain className="h-3 w-3 text-primary" /> למידת הסוכן (מנהל אדפטיבי {settings.adaptiveEnabled ? "פעיל" : "כבוי"})
        </div>
        {bots.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-2">
            המנהל האדפטיבי עדיין לא צבר נתונים. כשהבוטים יסגורו עסקאות, הסוכן יכוונן לכל בוט את רמת הסלקטיביות לפי אחוז ההצלחה המתגלגל שלו.
          </p>
        ) : (
          <div className="space-y-2">
            {bots.map(([id, st]) => {
              const wr = st.trades ? (st.wins / st.trades) * 100 : 0;
              const tighter = st.edge > 1.0;
              const looser = st.edge < 1.0;
              const note = tighter
                ? "מהדק כניסות — נעשה סלקטיבי יותר אחרי רצף חלש"
                : looser
                ? "מרחיב פעילות — ביצועים טובים מאפשרים יותר עסקאות"
                : "ניטרלי — אוסף נתונים";
              const noteColor = tighter ? "#f59e0b" : looser ? "#22c55e" : "#a1a1aa";
              return (
                <div key={id} className="rounded-md border border-border/60 bg-secondary/20 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] font-mono font-bold">{BOT_LABELS[id] ?? id}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                      <span>{st.trades} עסקאות</span>
                      <span>{wr.toFixed(0)}% הצלחה</span>
                      <span className="font-bold tabular-nums" style={{ color: st.netPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                        {st.netPnl >= 0 ? "+" : ""}${usd(st.netPnl)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (st.edge / 2) * 100)}%`, background: noteColor }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground">סלקטיביות ×{st.edge.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: noteColor }}>{note}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Rule-based insights ── */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" /> תובנות (מבוסס-חוקים, ללא AI בתשלום)
        </div>
        <ul className="space-y-1">
          {insights.map((s, i) => (
            <li key={i} className="text-[11px] text-foreground/90 leading-relaxed flex gap-1.5">
              <span className="text-primary">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
