import { useId, useMemo } from "react";
import {
  Brain, Gauge, TrendingUp, TrendingDown, BarChart3, Cpu, Sparkles,
  Clock, CalendarDays, Timer, Zap, Target, Activity,
  RotateCcw, AlertTriangle,
} from "lucide-react";
import { usePortfolio, type ClosedTrade, STARTING_BALANCE } from "@/contexts/portfolio-context";
import { useAutoTrader } from "@/contexts/autotrader-context";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";

/* Display labels (lang-aware) */
const BOT_LABEL_IDS = new Set(["dipbuyer", "breakout", "dca", "scalp", "momentum", "stock", "smart", "poly"]);
function botLabel(id: string, lang: Lang): string {
  return BOT_LABEL_IDS.has(id) ? t(`trade.taBot.${id}`, lang) : id;
}

function typeLabel(type: ClosedTrade["type"], lang: Lang): string {
  return t(`trade.taType.${type}`, lang);
}

const DAY_KEYS = new Set(["0", "1", "2", "3", "4", "5", "6"]);
function dayLabel(d: string, lang: Lang): string {
  return DAY_KEYS.has(d) ? t(`trade.taDay.${d}`, lang) : d;
}

function usd(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function groupStats(arr: ClosedTrade[]) {
  const n = arr.length;
  const wins = arr.filter((t) => t.pnl > 0).length;
  const net = arr.reduce((a, t) => a + t.pnl, 0);
  return { n, wins, winRate: n ? (wins / n) * 100 : 0, net };
}

export function Sparkline({ pts, className = "w-full h-24" }: { pts: number[]; className?: string }) {
  const gid = useId();
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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="hsl(0 0% 100% / 0.12)" strokeWidth="1" strokeDasharray="4 4" />
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BreakdownRow({ label, s }: { label: string; s: ReturnType<typeof groupStats> }) {
  const { lang } = useLanguage();
  if (s.n === 0) return null;
  const net = s.net;
  const color = net > 0 ? "#22c55e" : net < 0 ? "#ef4444" : "#a1a1aa";
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
      <span className="text-foreground/80">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{s.n} {t("trade.taTradesWord", lang)}</span>
        <span className="text-muted-foreground">{s.winRate.toFixed(0)}% {t("trade.taSuccessWord", lang)}</span>
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
  const { lang } = useLanguage();

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
      { key: "TP", label: t("ta.tp", lang) },
      { key: "SL", label: t("ta.sl", lang) },
      { key: "LIQ", label: t("ta.liq", lang) },
      { key: "MANUAL", label: t("ta.manual", lang) },
    ];
    return reasons.map((r) => ({
      ...r,
      s: groupStats(tradeHistory.filter((x) => (x.exit ?? "MANUAL") === r.key)),
    }));
  }, [tradeHistory, lang]);

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

  /* ── Drawdown (percent + absolute USD) ── */
  const drawdown = useMemo(() => {
    if (equity.length < 2) return { max: 0, current: 0, peak: 0, maxAbs: 0, currentAbs: 0 };
    const base = totalDeposited || STARTING_BALANCE;
    let peak = 0;
    let maxDD = 0;
    let maxAbs = 0;
    for (const v of equity) {
      const bal = base + v;
      if (bal > peak) peak = bal;
      const dd = peak > 0 ? ((peak - bal) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      const abs = peak - bal;
      if (abs > maxAbs) maxAbs = abs;
    }
    const last = equity[equity.length - 1];
    const currentBal = base + last;
    const currentDD = peak > 0 ? ((peak - currentBal) / peak) * 100 : 0;
    const currentAbs = peak - currentBal;
    return { max: maxDD, current: currentDD, peak, maxAbs, currentAbs };
  }, [equity, totalDeposited]);

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
      label: dayLabel(d, lang),
      n: s.n,
      wr: s.n ? (s.w / s.n) * 100 : 0,
    })).sort((a, b) => Number(a.day) - Number(b.day));
    return { avgHolding, days, totalTrades: trades.length };
  }, [tradeHistory, lang]);

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
      out.push(t("ta.noData", lang));
      return out;
    }
    const ranked = [...byType].filter((x) => x.s.n > 0).sort((a, b) => b.s.net - a.s.net);
    if (ranked.length) {
      const best = ranked[0];
      out.push(`${t("ta.bestProfitable", lang)}: ${typeLabel(best.key, lang)} (${best.s.net >= 0 ? "+" : ""}$${usd(best.s.net)}).`);
      const worst = ranked[ranked.length - 1];
      if (ranked.length > 1 && worst.s.net < 0) {
        out.push(`${t("trade.taWorstChannel", lang)}: ${typeLabel(worst.key, lang)} ($${usd(worst.s.net)}) — ${t("trade.taWorstNote", lang)}`);
      }
    }
    const tp = byExit.find((r) => r.key === "TP")?.s.n ?? 0;
    const sl = byExit.find((r) => r.key === "SL")?.s.n ?? 0;
    if (tp + sl > 0) {
      out.push(`${t("ta.tpSlRatio", lang)}: ${tp} TP / ${sl} SL.`);
    }
    if (expectancy.n >= 10 && expectancy.winRate < 45) {
      out.push(t("ta.lowWinRate", lang));
    }
    if (bySource.auto.n > 0 && bySource.manual.n > 0) {
      const diff = bySource.auto.winRate - bySource.manual.winRate;
      out.push(
        t("trade.taAutoVsManual", lang)
          .replace("{a}", bySource.auto.winRate.toFixed(0))
          .replace("{m}", bySource.manual.winRate.toFixed(0))
          .replace("{diff}", `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}`),
      );
    }
    if (streaks.maxLoss >= 3) {
      out.push(`${t("ta.maxLossStreak", lang)}: ${streaks.maxLoss} ${t("ta.lossStreakNote", lang)}`);
    }
    if (drawdown.max >= 20) {
      out.push(t("trade.taMaxDDInsight", lang).replace("{dd}", drawdown.max.toFixed(1)));
    }
    return out;
  }, [tradeHistory, byType, byExit, bySource, expectancy, streaks, drawdown, lang]);

  const hasData = tradeHistory.length > 0;

  return (
    <div dir="rtl" className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black tracking-tight">{t("ta.title", lang)}</h2>
        </div>
        {/* Reset wallet button */}
        <button
          onClick={() => {
            if (confirm(`${t("ta.resetConfirm", lang)} ($${STARTING_BALANCE.toLocaleString()}). ${t("ta.resetSuffix", lang)}`))
              resetPortfolio();
          }}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-mono font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors flex-shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {t("ta.reset", lang)}
        </button>
      </div>

      {/* ── Equity curve ── */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> {t("ta.equityCurve", lang)}
        </div>
        {equity.length > 1 ? (
          <Sparkline pts={equity} />
        ) : (
          <p className="text-[11px] text-muted-foreground py-6 text-center">{t("ta.noClosed", lang)}</p>
        )}
      </div>

      {/* ── Core metrics grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Expectancy */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Gauge className="h-3 w-3" /> {t("trade.taExpectancy", lang)}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("trade.taExpPerTrade", lang)}</span>
              <span className="font-bold tabular-nums" style={{ color: expectancy.exp >= 0 ? "#22c55e" : "#ef4444" }}>
                {expectancy.exp >= 0 ? "+" : ""}${usd(expectancy.exp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("trade.taWinPct", lang)}</span>
              <span className="font-bold tabular-nums">{expectancy.winRate.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ta.avgWin", lang)}</span>
              <span className="font-bold tabular-nums text-[#22c55e]">+${usd(expectancy.avgWin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ta.avgLoss", lang)}</span>
              <span className="font-bold tabular-nums text-[#ef4444]">-${usd(expectancy.avgLoss)}</span>
            </div>
          </div>
          <div className="h-px bg-border/50" />
          <div className="space-y-1.5">
            {byType.map(({ key, s }) => (
              <BreakdownRow key={key} label={typeLabel(key, lang)} s={s} />
            ))}
          </div>
        </div>

        {/* Exit reasons + source */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="h-3 w-3" /> {t("trade.taByExit", lang)}
          </div>
          <div className="space-y-1.5">
            {byExit.map((r) => (
              <BreakdownRow key={r.key} label={r.label} s={r.s} />
            ))}
          </div>
          <div className="h-px bg-border/50" />
          <div className="space-y-1.5">
            <BreakdownRow label={t("trade.taAuto", lang)} s={bySource.auto} />
            <BreakdownRow label={t("trade.taManual", lang)} s={bySource.manual} />
          </div>
        </div>

        {/* Streaks + Drawdown + Risk */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3" /> {t("trade.taStreaks", lang)}
          </div>
          <div className="space-y-1.5">
            <StatBar label={t("trade.taMaxWinStreak", lang)} value={String(streaks.maxWin)} color="#22c55e" />
            <StatBar label={t("trade.taMaxLossStreak", lang)} value={String(streaks.maxLoss)} color="#ef4444" />
            <StatBar label={t("trade.taCurLossStreak", lang)} value={String(streaks.curLoss)} color={streaks.curLoss >= 2 ? "#ef4444" : "#a1a1aa"} />
            <div className="h-px bg-border/50" />
            <StatBar label={t("trade.taMaxDD", lang)} value={`${drawdown.max.toFixed(1)}%`} color={drawdown.max >= 20 ? "#ef4444" : "#a1a1aa"} />
            <StatBar label={t("trade.taMaxDDAbs", lang)} value={hasData ? `-$${usd(drawdown.maxAbs)}` : "—"} color={drawdown.maxAbs >= 1000 ? "#ef4444" : "#a1a1aa"} />
            <StatBar label={t("trade.taCurDD", lang)} value={`${drawdown.current.toFixed(1)}%`} color={drawdown.current >= 10 ? "#ef4444" : "#a1a1aa"} />
            <StatBar label={t("trade.taCurDDAbs", lang)} value={hasData ? `-$${usd(drawdown.currentAbs)}` : "—"} color={drawdown.currentAbs >= 500 ? "#ef4444" : "#a1a1aa"} />
            <StatBar label={t("trade.taPeakEquity", lang)} value={hasData ? `$${usd(drawdown.peak)}` : "—"} />
            <StatBar label={t("trade.taRR", lang)} value={riskMetrics.rr > 0 ? `${riskMetrics.rr.toFixed(2)}:1` : "—"} color={riskMetrics.rr >= 1.5 ? "#22c55e" : "#a1a1aa"} />
          </div>
          {drawdown.max >= 20 && (
            <p className="text-[10px] text-red-400/80 flex items-center gap-1" dir="rtl">
              <AlertTriangle className="h-3 w-3" /> {t("trade.taDDWarn", lang)}
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
              <Clock className="h-3 w-3" /> {t("trade.taHoldingTime", lang)}
            </div>
            <div className="text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <Timer className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("trade.taAvgTradeOpened", lang)}</span>
                <span className="font-bold">{timeStats.avgHolding}</span>
                {timeStats.avgHolding.includes(":") && (
                  <span className="text-[10px] text-muted-foreground">
                    {timeStats.avgHolding.split(":")[0].length <= 2 ? t("trade.taMinutes", lang) : t("trade.taHours", lang)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("trade.taTradesWithTime", lang)}</span>
                <span className="font-bold">{timeStats.totalTrades}</span>
              </div>
            </div>
          </div>

          {/* Win rate by day */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> {t("trade.taWinRateByDay", lang)}
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
                  <span className="text-muted-foreground w-10 text-left">{d.n} {t("trade.taTradesAbbr", lang)}</span>
                  <span className="font-bold w-10 text-left" style={{ color: d.wr >= 60 ? "#22c55e" : d.wr >= 40 ? "#f59e0b" : "#ef4444" }}>
                    {d.wr.toFixed(0)}%
                  </span>
                </div>
              ))}
              {timeStats.days.length === 0 && (
                <p className="text-[11px] text-muted-foreground">{t("trade.taNoDataDaily", lang)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Agent learning ── */}
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Brain className="h-3 w-3 text-primary" /> {t("trade.taAgentLearning", lang).replace("{state}", settings.adaptiveEnabled ? t("trade.taAgentEnabled", lang) : t("trade.taAgentDisabled", lang))}
        </div>
        {bots.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-2">
            {t("trade.taNoAdaptiveData", lang)}
          </p>
        ) : (
          <div className="space-y-2">
            {bots.map(([id, st]) => {
              const wr = st.trades ? (st.wins / st.trades) * 100 : 0;
              const tighter = st.edge > 1.0;
              const looser = st.edge < 1.0;
              const note = tighter
                ? t("trade.taTighter", lang)
                : looser
                ? t("trade.taLoser", lang)
                : t("trade.taNeutral", lang);
              const noteColor = tighter ? "#f59e0b" : looser ? "#22c55e" : "#a1a1aa";
              return (
                <div key={id} className="rounded-md border border-border/60 bg-secondary/20 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] font-mono font-bold">{botLabel(id, lang)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                      <span>{st.trades} {t("trade.taTrades", lang)}</span>
                      <span>{wr.toFixed(0)}% {t("trade.taSuccess", lang)}</span>
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
                    <span className="text-[9px] font-mono text-muted-foreground">{t("trade.taSelectivity", lang).replace("{edge}", st.edge.toFixed(2))}</span>
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
          <Sparkles className="h-3 w-3" /> {t("trade.taInsights", lang)}
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
