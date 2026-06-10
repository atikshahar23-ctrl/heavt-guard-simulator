import { useMemo, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useGetMarketOverview, getGetMarketOverviewQueryKey } from "@workspace/api-client-react";
import {
  History as HistoryIcon, TrendingUp, TrendingDown, Trophy, Target,
  Bot, Hand, Wallet, Activity, Cpu, LineChart as ChartIcon,
  Gauge, Rocket, Megaphone, Timer, Layers, Coins, Sparkles,
  ChevronDown, ChevronRight, ExternalLink, Share2,
} from "lucide-react";
import { usePortfolio, type ClosedTrade, type BinancePosition, type StockPosition, STARTING_BALANCE } from "@/contexts/portfolio-context";
import { toast } from "@/hooks/use-toast";
import { BotStatsPopover } from "@/components/bot-stats-popover";
import { CryptoIcon } from "@/components/crypto-icon";
import { StockIcon } from "@/components/stock-icon";
import { TradeAnalytics } from "@/components/trade-analytics";
import { TradeDetailModal } from "@/components/trade-detail-modal";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";

/** Share a winning paper-trade via Web Share API; falls back to clipboard. */
async function shareTrade(symbol: string, pnl: number, toastFn: (opts: { title: string; description: string }) => void, lang: Lang) {
  const text = t("history.share.text", lang)
    .replace("{amount}", Math.abs(pnl).toFixed(0))
    .replace("{symbol}", symbol);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: t("history.share.title", lang), text });
    } else {
      await navigator.clipboard.writeText(text);
      toastFn({ title: t("history.share.copiedTitle", lang), description: t("history.share.copiedDesc", lang) });
    }
  } catch {
    // user cancelled or API unavailable — silently ignore
  }
}

type TypeFilter = "ALL" | "BINANCE" | "STOCK" | "POLYMARKET" | "FUNDING" | "OPTION";
type ResultFilter = "ALL" | "WINS" | "LOSSES";
type SourceFilter = "ALL" | "AUTO" | "MANUAL";
type BotFilter = "ALL" | "scalp" | "momentum" | "smart" | "poly" | "dipbuyer" | "breakout" | "dca" | "funding" | "options";

const BOT_SOURCE_LABEL: Record<string, string> = {
  "Dip Buyer": "Dip Buyer",
  "Breakout Hunter": "Breakout Hunter",
  "Blue-Chip DCA": "Blue-Chip DCA",
  "Scalp signal": "Scalp Signal",
  "Momentum surge": "Momentum Signal",
  "Smart-Money": "Smart Money",
  "Smart-Money (technical + influencer)": "Smart Money",
  "Quick Trade": "Quick Trade",
};

function botName(source: string | undefined): string | null {
  if (!source) return null;
  return BOT_SOURCE_LABEL[source] ?? null;
}


function fmtUsd(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

function exit(tr: ClosedTrade, lang: Lang) {
  if (tr.exit === "TP") return { label: "TP", color: "#22c55e" };
  if (tr.exit === "SL") return { label: "SL", color: "#ef4444" };
  if (tr.exit === "LIQUIDATION") return { label: t("history.exit.liquidation", lang), color: "#dc2626" };
  if (tr.exit === "LIQ") return { label: "LIQ", color: "#f59e0b" };
  return { label: t("history.filter.manual", lang), color: "#a1a1aa" };
}

function timeAgo(iso: string, lang: Lang): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("history.time.now", lang);
  if (m < 60) return t("history.time.minutesAgo", lang).replace("{n}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t("history.time.hoursAgo", lang).replace("{n}", String(h));
  return t("history.time.daysAgo", lang).replace("{n}", String(Math.floor(h / 24)));
}

/** Holding duration from open to close, when both timestamps are known. */
function duration(tr: ClosedTrade, lang: Lang): string | null {
  if (!tr.openedAt) return null;
  const ms = new Date(tr.closedAt).getTime() - new Date(tr.openedAt).getTime();
  if (!(ms > 0)) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return t("history.dur.minutes", lang).replace("{m}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t("history.dur.hoursMinutes", lang).replace("{h}", String(h)).replace("{m}", String(m % 60));
  return t("history.dur.daysHours", lang).replace("{d}", String(Math.floor(h / 24))).replace("{h}", String(h % 24));
}

const TYPE_LABEL_KEY: Record<ClosedTrade["type"], string> = {
  BINANCE: "history.type.binance",
  STOCK: "history.type.stock",
  POLYMARKET: "history.type.polymarket",
  FUNDING: "history.type.funding",
  OPTION: "history.type.option",
};

function typeLabel(type: ClosedTrade["type"], lang: Lang): string {
  return t(TYPE_LABEL_KEY[type], lang);
}

/* ─── Per-bot definitions (used by BotSummaryGrid) ──────────────────────── */
const BOT_DEFS: {
  key: string;
  title: string;
  icon: React.ElementType;
  match: (t: ClosedTrade) => boolean;
}[] = [
  { key: "scalp", title: "Scalp Bot", icon: Gauge, match: (t) => (t.source ?? "").includes("Scalp") },
  { key: "momentum", title: "Momentum", icon: Rocket, match: (t) => (t.source ?? "").includes("Momentum") },
  { key: "smart", title: "Smart-Money", icon: Megaphone, match: (t) => (t.source ?? "").includes("Smart-Money") },
  { key: "poly", title: "Polymarket", icon: Timer, match: (t) => t.type === "POLYMARKET" },
  { key: "dipbuyer", title: "Dip Buyer", icon: TrendingDown, match: (t) => t.source === "Dip Buyer" },
  { key: "breakout", title: "Breakout Hunter", icon: TrendingUp, match: (t) => t.source === "Breakout Hunter" },
  { key: "dca", title: "Blue-Chip DCA", icon: Layers, match: (t) => t.source === "Blue-Chip DCA" },
  { key: "funding", title: "Funding Arb", icon: Coins, match: (t) => t.type === "FUNDING" },
  { key: "options", title: "Options Agent", icon: Sparkles, match: (t) => t.type === "OPTION" },
];

/* ─── Interactive equity curve ───────────────────────────────────────────── */
function EquityCurveChart() {
  const { lang, dir } = useLanguage();
  const { tradeHistory, totalDeposited } = usePortfolio();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const baseline = totalDeposited || STARTING_BALANCE;

  const { balances, tradeMeta } = useMemo(() => {
    const chrono = [...tradeHistory].reverse();
    let cum = baseline;
    const balances: number[] = [cum];
    const tradeMeta: { pnl: number; closedAt: string; source?: string }[] = [
      { pnl: 0, closedAt: "", source: undefined },
    ];
    for (const t of chrono) {
      cum += t.pnl;
      balances.push(cum);
      tradeMeta.push({ pnl: t.pnl, closedAt: t.closedAt, source: t.source });
    }
    return { balances, tradeMeta };
  }, [tradeHistory, baseline]);

  const peak = Math.max(...balances);
  const last = balances[balances.length - 1];
  const maxDD = useMemo(() => {
    let pk = 0, dd = 0;
    for (const v of balances) {
      if (v > pk) pk = v;
      if (pk > 0) dd = Math.max(dd, ((pk - v) / pk) * 100);
    }
    return dd;
  }, [balances]);
  const totalReturn = baseline > 0 ? ((last - baseline) / baseline) * 100 : 0;

  const W = 1000, H = 200, PAD_X = 4, PAD_Y = 12;
  const n = balances.length;
  const minB = Math.min(...balances);
  const maxB = Math.max(...balances);
  const rawSpan = maxB - minB;
  const span = rawSpan < baseline * 0.005 ? baseline * 0.01 : rawSpan;
  const minBPad = minB - span * 0.08;
  const maxBPad = maxB + span * 0.08;
  const spanPad = maxBPad - minBPad;

  const toX = (i: number) => PAD_X + (i / Math.max(1, n - 1)) * (W - PAD_X * 2);
  const toY = (v: number) => PAD_Y + (1 - (v - minBPad) / spanPad) * (H - PAD_Y * 2);

  const pathD = balances
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");
  const lastX = toX(n - 1).toFixed(1);
  const areaD = `${pathD} L ${lastX} ${H} L ${toX(0).toFixed(1)} ${H} Z`;
  const baseY = toY(baseline);
  const stroke = last >= baseline ? "#22c55e" : "#ef4444";

  const activeIdx = hoverIdx ?? n - 1;
  const hoverBal = balances[activeIdx];
  const hoverMeta = tradeMeta[activeIdx];
  const hoverX = toX(activeIdx);
  const hoverY = toY(hoverBal);
  const hoverAbove = hoverBal >= baseline;

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((x - PAD_X) / (W - PAD_X * 2)) * (n - 1));
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
  }, [n]);

  if (tradeHistory.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ChartIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black tracking-tight">{t("history.equity.title", lang)}</h2>
          <span className="text-[9px] font-mono text-muted-foreground/70">({t("history.tradesCount", lang).replace("{n}", String(tradeHistory.length))})</span>
        </div>
        <div className="flex items-center gap-4" dir={dir}>
          <div className="text-right">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{t("history.equity.return", lang)}</div>
            <div className="font-mono font-bold text-sm" style={{ color: totalReturn >= 0 ? "#22c55e" : "#ef4444" }}>
              {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(1)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{t("history.equity.peak", lang)}</div>
            <div className="font-mono font-bold text-sm text-primary">${fmtUsd(peak, 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{t("history.equity.maxDD", lang)}</div>
            <div className="font-mono font-bold text-sm text-amber-400">{maxDD.toFixed(1)}%</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{t("history.equity.now", lang)}</div>
            <div className="font-mono font-bold text-sm" style={{ color: last >= baseline ? "#22c55e" : "#ef4444" }}>
              ${fmtUsd(last, 0)}
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-36 cursor-crosshair select-none"
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="ec-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line
            x1={PAD_X} y1={baseY} x2={W - PAD_X} y2={baseY}
            stroke="hsl(0 0% 100% / 0.13)" strokeWidth="1" strokeDasharray="5 4"
          />
          <path d={areaD} fill="url(#ec-fill)" />
          <path d={pathD} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <line
            x1={hoverX} y1={PAD_Y} x2={hoverX} y2={H - PAD_Y}
            stroke="hsl(0 0% 100% / 0.22)" strokeWidth="1" strokeDasharray="3 3"
          />
          <circle
            cx={hoverX} cy={hoverY} r={hoverIdx !== null ? 5 : 4}
            fill={stroke} stroke="hsl(0 0% 6%)" strokeWidth="2"
          />
        </svg>

        {hoverIdx !== null && hoverMeta.closedAt && (
          <div
            className="absolute pointer-events-none rounded-md border border-border/80 bg-[hsl(0_0%_8%)] px-2.5 py-2 text-[10px] font-mono shadow-2xl whitespace-nowrap z-10"
            style={{
              left: `${Math.min(Math.max((hoverX / W) * 100, 4), 78)}%`,
              top: hoverY / H < 0.5 ? "40%" : "4px",
            }}
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="text-muted-foreground">{timeAgo(hoverMeta.closedAt, lang)}</div>
                {hoverMeta.source && <div className="text-primary font-semibold">{hoverMeta.source}</div>}
                <div className="text-[9px] text-muted-foreground/70">{t("history.equity.tradeNum", lang).replace("{n}", String(activeIdx))}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-sm">${fmtUsd(hoverBal, 0)}</div>
                <div style={{ color: hoverMeta.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                  {hoverMeta.pnl >= 0 ? "+" : ""}${fmtUsd(hoverMeta.pnl)}
                </div>
              </div>
            </div>
          </div>
        )}

        {hoverIdx === null && (
          <div
            className="absolute pointer-events-none rounded-md border border-border/80 bg-[hsl(0_0%_8%)] px-2.5 py-2 text-[10px] font-mono shadow-xl whitespace-nowrap z-10"
            style={{
              left: `${Math.min((hoverX / W) * 100, 78)}%`,
              top: hoverY / H < 0.5 ? "40%" : "4px",
            }}
          >
            <div className="text-right">
              <div className="font-black text-sm">${fmtUsd(last, 0)}</div>
              <div style={{ color: hoverAbove ? "#22c55e" : "#ef4444" }}>
                {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-0.5 text-[9px] font-mono text-muted-foreground/55">
        <span>{t("history.equity.start", lang).replace("{amount}", fmtUsd(baseline, 0))}</span>
        <span>{t("history.equity.hoverHint", lang)}</span>
        <span>{t("history.equity.nowAmount", lang).replace("{amount}", fmtUsd(last, 0))}</span>
      </div>
    </div>
  );
}

/* ─── Per-bot performance summary grid ──────────────────────────────────── */
function BotSummaryGrid() {
  const { lang } = useLanguage();
  const { tradeHistory } = usePortfolio();

  const bots = useMemo(() => {
    return BOT_DEFS.map((b) => {
      const ts = tradeHistory.filter(b.match);
      const wins = ts.filter((t) => t.pnl > 0).length;
      const net = ts.reduce((a, t) => a + t.pnl, 0);
      const avg = ts.length > 0 ? net / ts.length : 0;
      const chrono = [...ts].reverse();
      let c = 0;
      const pts: number[] = [0];
      for (const t of chrono) { c += t.pnl; pts.push(c); }
      return { ...b, trades: ts.length, wins, net, avg, wr: ts.length > 0 ? (wins / ts.length) * 100 : 0, pts };
    }).filter((b) => b.trades > 0);
  }, [tradeHistory]);

  if (bots.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black tracking-tight">{t("insights.botPerformance", lang)}</h2>
        <span className="text-[9px] font-mono text-muted-foreground/70">({t("insights.activeCount", lang).replace("{n}", String(bots.length))})</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {bots.map((b) => {
          const color = b.net >= 0 ? "#22c55e" : "#ef4444";
          const SVG_W = 200, SVG_H = 40;
          const min = Math.min(...b.pts, 0), max = Math.max(...b.pts, 0);
          const span = Math.max(max - min, 0.01);
          const sparkD = b.pts
            .map((v, i) => {
              const x = (i / Math.max(1, b.pts.length - 1)) * SVG_W;
              const y = SVG_H - ((v - min) / span) * SVG_H * 0.82 - SVG_H * 0.09;
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <div key={b.key} className="rounded-lg border bg-card p-3 space-y-2 overflow-hidden">
              <div className="flex items-center justify-between gap-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <b.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-xs font-semibold truncate">{b.title}</span>
                </div>
                <span
                  className="font-mono text-xs font-black tabular-nums shrink-0"
                  style={{ color }}
                >
                  {b.net >= 0 ? "+" : ""}${fmtUsd(b.net, 0)}
                </span>
              </div>
              {b.pts.length > 1 && (
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none" className="w-full h-8 -mx-px">
                  <defs>
                    <linearGradient id={`bfill-${b.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${sparkD} L ${SVG_W} ${SVG_H} L 0 ${SVG_H} Z`}
                    fill={`url(#bfill-${b.key})`}
                  />
                  <path d={sparkD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              )}
              <div className="grid grid-cols-3 gap-x-1 text-center border-t border-border/40 pt-1.5">
                <div>
                  <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.trades", lang)}</div>
                  <div className="text-[11px] font-mono font-bold tabular-nums">{b.trades}</div>
                </div>
                <div>
                  <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.success", lang)}</div>
                  <div
                    className="text-[11px] font-mono font-bold tabular-nums"
                    style={{ color: b.wr >= 50 ? "#22c55e" : "#ef4444" }}
                  >
                    {b.wr.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.avg", lang)}</div>
                  <div
                    className="text-[11px] font-mono font-bold tabular-nums"
                    style={{ color: b.avg >= 0 ? "#22c55e" : "#ef4444" }}
                  >
                    {b.avg >= 0 ? "+" : ""}${fmtUsd(b.avg, 0)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, Icon }: {
  label: string; value: string; sub?: string; color?: string; Icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="font-mono text-lg font-black" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground">{sub}</div>}
    </div>
  );
}

function OpenPositions() {
  const { lang } = useLanguage();
  const [, navigate] = useLocation();
  const { binancePositions, closeBinancePosition, stockPositions, closeStockPosition, polyPositions, closePolyPosition } = usePortfolio();
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of overview ?? []) m[c.asset] = c.price;
    return m;
  }, [overview]);

  const total = binancePositions.length + stockPositions.length + polyPositions.length;

  // Group by bot
  const cryptoByBot = useMemo(() => {
    const groups: Record<string, typeof binancePositions> = {};
    for (const p of binancePositions) {
      const name = botName(p.source) ?? (p.auto ? "Auto-Trader" : "Manual");
      groups[name] = groups[name] ?? [];
      groups[name].push(p);
    }
    return groups;
  }, [binancePositions]);

  const stockByBot = useMemo(() => {
    const groups: Record<string, typeof stockPositions> = {};
    for (const p of stockPositions) {
      const name = botName(p.source) ?? (p.auto ? "Auto-Trader" : "Manual");
      groups[name] = groups[name] ?? [];
      groups[name].push(p);
    }
    return groups;
  }, [stockPositions]);

  // Early return must come after all hooks (Rules of Hooks).
  if (total === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black tracking-tight">{t("history.openPositions", lang)} ({total})</h2>
      </div>

      {/* Crypto / Binance Futures */}
      {Object.entries(cryptoByBot).map(([botName, positions]) => (
        <div key={`crypto-${botName}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">{botName}</span>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[9px] font-mono text-muted-foreground">{positions.length} {t("history.unit.crypto", lang)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {positions.map((p) => {
              const cur = priceMap[p.asset] ?? p.entryPrice;
              const margin = p.notional / p.leverage;
              const delta = p.direction === "LONG"
                ? (cur - p.entryPrice) / p.entryPrice
                : (p.entryPrice - cur) / p.entryPrice;
              const pnl = delta * p.notional;
              const pnlPct = (pnl / margin) * 100;
              const up = pnl >= 0;
              const accent = p.direction === "LONG" ? "#22c55e" : "#ef4444";
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/simulator?tab=futures&asset=${encodeURIComponent(p.asset)}`)}
                  role="button"
                  tabIndex={0}
                  title={t("history.viewChart", lang)}
                  className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer transition-colors hover:bg-secondary/30"
                  style={{ borderColor: `${accent}30` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CryptoIcon asset={p.asset} size={18} />
                      <span className="font-mono font-black text-sm">{p.asset}</span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${accent}1a`, color: accent }}>
                        {p.direction} {p.leverage}x
                      </span>
                    </div>
                    <ChartIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      <div>{t("history.entry", lang)} ${fmtPrice(p.entryPrice)}</div>
                      <div>{t("history.market", lang)} ${fmtPrice(cur)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm" style={{ color: up ? "#22c55e" : "#ef4444" }}>
                        {up ? "+" : ""}${fmtUsd(pnl)}
                      </div>
                      <div className="font-mono text-[10px]" style={{ color: up ? "#22c55e" : "#ef4444" }}>
                        {up ? "+" : ""}{pnlPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeBinancePosition(p.id, cur); }}
                    className="w-full rounded py-1.5 text-[11px] font-mono font-bold bg-secondary/60 hover:bg-secondary transition-colors"
                  >
                    {t("history.closeAt", lang).replace("{price}", fmtPrice(cur))}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Stocks */}
      {Object.entries(stockByBot).map(([botName, positions]) => (
        <div key={`stock-${botName}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">{botName}</span>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[9px] font-mono text-muted-foreground">{positions.length} {t("history.unit.stocks", lang)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {positions.map((p) => {
              const dir = p.direction ?? "LONG";
              const accent = dir === "LONG" ? "#22c55e" : "#ef4444";
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/simulator?tab=stocks`)}
                  role="button"
                  tabIndex={0}
                  title={t("history.viewChart", lang)}
                  className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer transition-colors hover:bg-secondary/30"
                  style={{ borderColor: `${accent}30` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <StockIcon symbol={p.symbol} size={18} />
                      <span className="font-mono font-black text-sm">{p.symbol}</span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${accent}1a`, color: accent }}>
                        {dir}
                      </span>
                    </div>
                    <ChartIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {t("history.sharesAt", lang).replace("{shares}", p.shares.toFixed(2)).replace("{price}", fmtPrice(p.entryPrice))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeStockPosition(p.id, p.entryPrice); }}
                    className="w-full rounded py-1.5 text-[11px] font-mono font-bold bg-secondary/60 hover:bg-secondary transition-colors"
                  >
                    {t("history.close", lang)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Polymarket */}
      {polyPositions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">{t("history.predictionMarkets", lang)}</span>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[9px] font-mono text-muted-foreground">{polyPositions.length} {t("history.unit.bets", lang)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {polyPositions.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate("/simulator?tab=prediction")}
                role="button"
                tabIndex={0}
                title={t("history.viewPredictionMarket", lang)}
                className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer transition-colors hover:bg-secondary/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${p.side === "YES" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                      {p.side}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{p.category}</span>
                  </div>
                  <ChartIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
                <p className="text-xs text-foreground/80 line-clamp-2">{p.question}</p>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {t("history.unitsEntry", lang).replace("{units}", p.shares.toFixed(2)).replace("{price}", p.entryPrice.toFixed(3))}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); closePolyPosition(p.id, p.entryPrice); }}
                  className="w-full rounded py-1.5 text-[11px] font-mono font-bold bg-secondary/60 hover:bg-secondary transition-colors"
                >
                  {t("history.close", lang)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { lang, dir } = useLanguage();
  const { tradeHistory, cash, totalDeposited } = usePortfolio();
  const [, navigate] = useLocation();
  const [typeF, setTypeF] = useState<TypeFilter>("ALL");
  const [resultF, setResultF] = useState<ResultFilter>("ALL");
  const [sourceF, setSourceF] = useState<SourceFilter>("ALL");
  const [botF, setBotF] = useState<BotFilter>("ALL");
  const [selected, setSelected] = useState<ClosedTrade | null>(null);

  // Long-press / right-click on an active bot chip jumps to that bot's panel on /bots.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const goToBotPanel = useCallback((key: string) => {
    sessionStorage.setItem("scrollToBotId", `bot-${key}`);
    navigate("/bots");
  }, [navigate]);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  function handleSourceF(v: SourceFilter) {
    setSourceF(v);
    if (v === "MANUAL") setBotF("ALL");
  }

  const stats = useMemo(() => {
    const n = tradeHistory.length;
    const wins = tradeHistory.filter((t) => t.pnl > 0).length;
    const losses = tradeHistory.filter((t) => t.pnl < 0).length;
    const totalPnl = tradeHistory.reduce((a, t) => a + t.pnl, 0);
    const best = tradeHistory.reduce((a, t) => Math.max(a, t.pnl), 0);
    const worst = tradeHistory.reduce((a, t) => Math.min(a, t.pnl), 0);
    const winRate = n > 0 ? (wins / n) * 100 : 0;
    const autoCount = tradeHistory.filter((t) => t.auto).length;
    const grossWin = tradeHistory.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(tradeHistory.filter((t) => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const totalFees = tradeHistory.reduce((a, t) => a + (t.fees ?? 0), 0);
    return { n, wins, losses, totalPnl, best, worst, winRate, autoCount, profitFactor, totalFees };
  }, [tradeHistory]);

  const filtered = useMemo(() => {
    const botDef = botF !== "ALL" ? BOT_DEFS.find((b) => b.key === botF) : null;
    return tradeHistory.filter((t) => {
      if (typeF !== "ALL" && t.type !== typeF) return false;
      if (resultF === "WINS" && t.pnl <= 0) return false;
      if (resultF === "LOSSES" && t.pnl >= 0) return false;
      if (sourceF === "AUTO" && !t.auto) return false;
      if (sourceF === "MANUAL" && t.auto) return false;
      if (botDef && !botDef.match(t)) return false;
      return true;
    });
  }, [tradeHistory, typeF, resultF, sourceF, botF]);

  const botCounts = useMemo(() => {
    const base = tradeHistory.filter((t) => {
      if (typeF !== "ALL" && t.type !== typeF) return false;
      if (resultF === "WINS" && t.pnl <= 0) return false;
      if (resultF === "LOSSES" && t.pnl >= 0) return false;
      if (sourceF === "AUTO" && !t.auto) return false;
      if (sourceF === "MANUAL" && t.auto) return false;
      return true;
    });
    const counts: Record<string, number> = {};
    for (const bd of BOT_DEFS) counts[bd.key] = base.filter(bd.match).length;
    return counts;
  }, [tradeHistory, typeF, resultF, sourceF]);

  const pnlColor = stats.totalPnl > 0 ? "#22c55e" : stats.totalPnl < 0 ? "#ef4444" : undefined;

  return (
    <div className="p-5 space-y-4" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">{t("nav.history", lang)}</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("history.subtitle", lang)}
          </p>
        </div>
      </div>

      {/* Account row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <StatCard label={t("history.stat.balance", lang)} value={`$${fmtUsd(cash, 0)}`} Icon={Wallet} sub={t("history.stat.deposited", lang).replace("{amount}", fmtUsd(totalDeposited, 0))} />
        <StatCard label={t("history.stat.realizedPnl", lang)} value={`${stats.totalPnl >= 0 ? "+" : ""}$${fmtUsd(stats.totalPnl)}`} color={pnlColor} Icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown} sub={t("history.stat.closedTrades", lang).replace("{n}", String(stats.n))} />
        <StatCard label={t("history.stat.winRate", lang)} value={`${stats.winRate.toFixed(0)}%`} Icon={Trophy} sub={t("history.stat.winsLosses", lang).replace("{wins}", String(stats.wins)).replace("{losses}", String(stats.losses))} />
        <StatCard label={t("history.stat.profitFactor", lang)} value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} Icon={Target} sub={t("history.stat.autoCount", lang).replace("{n}", String(stats.autoCount))} />
        <StatCard label={t("history.stat.fees", lang)} value={`$${fmtUsd(stats.totalFees)}`} color="#f59e0b" Icon={Activity} sub={t("history.stat.feesSub", lang)} />
      </div>

      {/* Best/Worst row */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label={t("history.stat.bestTrade", lang)} value={`+$${fmtUsd(stats.best)}`} color="#22c55e" Icon={TrendingUp} />
        <StatCard label={t("history.stat.worstTrade", lang)} value={`-$${fmtUsd(Math.abs(stats.worst))}`} color="#ef4444" Icon={TrendingDown} />
      </div>

      <EquityCurveChart />

      <BotSummaryGrid />

      <OpenPositions />

      <TradeAnalytics />

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <FilterGroup label={t("history.filter.type", lang)} value={typeF} setValue={(v) => setTypeF(v as TypeFilter)} options={["ALL", "BINANCE", "STOCK", "POLYMARKET", "FUNDING", "OPTION"]} render={(o) => (o === "ALL" ? t("history.filter.all", lang) : typeLabel(o as ClosedTrade["type"], lang))} />
          <FilterGroup label={t("history.filter.result", lang)} value={resultF} setValue={(v) => setResultF(v as ResultFilter)} options={["ALL", "WINS", "LOSSES"]} render={(o) => ({ ALL: t("history.filter.all", lang), WINS: t("history.filter.wins", lang), LOSSES: t("history.filter.losses", lang) }[o] ?? o)} />
          <FilterGroup label={t("history.filter.source", lang)} value={sourceF} setValue={(v) => handleSourceF(v as SourceFilter)} options={["ALL", "AUTO", "MANUAL"]} render={(o) => ({ ALL: t("history.filter.all", lang), AUTO: t("history.filter.auto", lang), MANUAL: t("history.filter.manual", lang) }[o] ?? o)} />
        </div>
        {sourceF !== "MANUAL" && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{t("history.filter.bot", lang)}</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setBotF("ALL")}
                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${botF === "ALL" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}
                style={botF === "ALL" ? { boxShadow: "inset 0 0 0 1px hsl(207 30% 70% / 0.3)" } : {}}
              >
                {t("history.filter.all", lang)}
              </button>
              {BOT_DEFS.map((bd) => {
                const Icon = bd.icon;
                const active = botF === bd.key;
                const count = botCounts[bd.key] ?? 0;
                const empty = count === 0;
                return (
                  <button
                    key={bd.key}
                    onClick={() => {
                      if (longPressFired.current) { longPressFired.current = false; return; }
                      setBotF(bd.key as BotFilter);
                    }}
                    onContextMenu={(e) => {
                      if (!active) return;
                      e.preventDefault();
                      goToBotPanel(bd.key);
                    }}
                    onPointerDown={() => {
                      if (!active) return;
                      longPressFired.current = false;
                      longPressTimer.current = setTimeout(() => {
                        longPressFired.current = true;
                        goToBotPanel(bd.key);
                      }, 500);
                    }}
                    onPointerUp={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onPointerCancel={clearLongPress}
                    title={active ? t("history.botPanelHint", lang).replace("{title}", bd.title) : bd.title}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"} ${empty && !active ? "opacity-40" : ""}`}
                    style={active ? { boxShadow: "inset 0 0 0 1px hsl(207 30% 70% / 0.3)" } : {}}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {bd.title}
                    <span className={`tabular-nums ${active ? "text-primary/80" : "text-muted-foreground/70"}`}>({count})</span>
                    {active && (
                      <span
                        role="button"
                        aria-label={t("history.openBotPanel", lang).replace("{title}", bd.title)}
                        onClick={(e) => { e.stopPropagation(); goToBotPanel(bd.key); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center rounded p-0.5 ms-0.5 text-primary/60 hover:text-primary hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {tradeHistory.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <HistoryIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("history.empty", lang)}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t("history.emptyHint", lang)}</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">{t("history.noMatch", lang)}</p>
      ) : (
        <ClosedTradeTable trades={filtered} onSelect={setSelected} />
      )}

      <TradeDetailModal trade={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

type GroupKey = { type: string; symbol: string; direction: string };

function groupKey(t: ClosedTrade): string {
  return `${t.type}:${t.symbol || ""}:${t.direction || ""}`;
}

/* ─── Hover tooltip ──────────────────────────────────────────────────────── */
function TradeTooltip({ trade, x, y }: { trade: ClosedTrade; x: number; y: number }) {
  const { lang } = useLanguage();
  const up = trade.pnl >= 0;
  const pct = trade.cost > 0 ? (trade.pnl / trade.cost) * 100 : 0;
  const ex = exit(trade, lang);
  const bot = botName(trade.source);
  const dur = duration(trade, lang);
  const isLong = trade.direction === "LONG" || trade.direction === "YES";

  // Flip left if too close to right edge
  const flipLeft = x + 270 > window.innerWidth;
  const left = flipLeft ? x - 268 : x + 14;
  const top = Math.min(y - 8, window.innerHeight - 340);

  return (
    <div
      className="fixed z-[9999] pointer-events-none select-none"
      style={{ left, top, width: 256 }}
    >
      <div className="rounded-lg border border-border/80 bg-[hsl(0_0%_7%)] shadow-2xl overflow-hidden text-[11px] font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-secondary/20">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">{typeLabel(trade.type, lang)}</span>
            {trade.symbol && <span className="font-bold text-primary">{trade.symbol}</span>}
            {trade.direction && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: isLong ? "#22c55e1a" : "#ef44441a", color: isLong ? "#22c55e" : "#ef4444" }}>
                {trade.direction}
              </span>
            )}
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${ex.color}1a`, color: ex.color }}>{ex.label}</span>
        </div>

        {/* Bot / source row */}
        {(bot ?? trade.source) && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-primary/5">
            <Bot className="h-3 w-3 text-primary/70 shrink-0" />
            <span className="text-primary font-bold truncate">{bot ?? trade.source}</span>
            {!bot && trade.auto && <span className="text-[9px] text-muted-foreground">{t("history.tooltip.auto", lang)}</span>}
          </div>
        )}
        {!trade.source && !trade.auto && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-secondary/10">
            <Hand className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{t("history.filter.manual", lang)}</span>
          </div>
        )}

        {/* Price details */}
        <div className="px-3 py-2 space-y-1">
          {trade.entryPrice != null && trade.exitPrice != null && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("history.tooltip.entryExit", lang)}</span>
              <span>${fmtPrice(trade.entryPrice)} → ${fmtPrice(trade.exitPrice)}</span>
            </div>
          )}
          {trade.leverage != null && trade.leverage > 1 && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("history.tooltip.leverage", lang)}</span>
              <span className="text-primary">{trade.leverage}x</span>
            </div>
          )}
          {trade.slPrice != null && (
            <div className="flex justify-between gap-3 text-red-400/80">
              <span>Stop Loss</span>
              <span>${fmtPrice(trade.slPrice)}</span>
            </div>
          )}
          {trade.tpPrice != null && (
            <div className="flex justify-between gap-3 text-emerald-400/80">
              <span>Take Profit</span>
              <span>${fmtPrice(trade.tpPrice)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t("history.tooltip.margin", lang)}</span>
            <span>${fmtUsd(trade.cost)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t("history.tooltip.proceeds", lang)}</span>
            <span>${fmtUsd(trade.proceeds)}</span>
          </div>
          {(trade.fees ?? 0) > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("history.tooltip.fees", lang)}</span>
              <span className="text-amber-400">${fmtUsd(trade.fees!)}</span>
            </div>
          )}
        </div>

        {/* P&L bar */}
        <div className="mx-3 mb-2 rounded px-2 py-1.5 flex justify-between items-center" style={{ background: up ? "#22c55e14" : "#ef444414" }}>
          <span className="text-muted-foreground">{t("history.tooltip.pnlNet", lang)}</span>
          <div className="text-right">
            <span className="font-black text-sm" style={{ color: up ? "#22c55e" : "#ef4444" }}>
              {up ? "+" : ""}{fmtUsd(trade.pnl)}
            </span>
            <span className="text-[10px] ml-1.5" style={{ color: up ? "#22c55e" : "#ef4444" }}>
              ({up ? "+" : ""}{pct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Timing */}
        <div className="px-3 pb-2 flex justify-between text-[10px] text-muted-foreground/70">
          <span>{timeAgo(trade.closedAt, lang)}</span>
          {dur && <span>⏱ {dur}</span>}
        </div>

        {/* Description (truncated) */}
        {trade.description && (
          <div className="px-3 pb-2 pt-0 text-[10px] text-muted-foreground/60 border-t border-border/30 pt-1.5 line-clamp-2 leading-relaxed">
            {trade.description}
          </div>
        )}
      </div>
    </div>
  );
}

const CATEGORY_ORDER = ["BINANCE", "STOCK", "POLYMARKET", "FUNDING", "OPTION"] as const;

function CategoryHeaderRow({ type, count, totalCost, totalPnl, collapsed, onToggle }: {
  type: string; count: number; totalCost: number; totalPnl: number; collapsed: boolean; onToggle: () => void;
}) {
  const { lang } = useLanguage();
  const up = totalPnl >= 0;
  const pct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left border-b border-border/60 hover:bg-secondary/20 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/50 text-foreground/80">{typeLabel(type as ClosedTrade["type"], lang)}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{t("history.tradesCount", lang).replace("{n}", String(count))}</span>
      </div>
      <div className="flex items-center gap-2 text-right shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono">{t("history.marginAmount", lang).replace("{amount}", fmtUsd(totalCost))}</span>
        <div className="font-mono text-[11px] font-black" style={{ color: up ? "#22c55e" : "#ef4444" }}>
          {up ? "+" : ""}${fmtUsd(totalPnl)}
        </div>
        <span className="font-mono text-[10px]" style={{ color: up ? "#22c55e" : "#ef4444" }}>
          {up ? "+" : ""}{pct.toFixed(1)}%
        </span>
      </div>
    </button>
  );
}

function ClosedTradeTable({ trades, onSelect }: { trades: ClosedTrade[]; onSelect: (t: ClosedTrade) => void }) {
  const { lang } = useLanguage();
  const [hovered, setHovered] = useState<ClosedTrade | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const moveRef = useRef<number | null>(null);
  const [, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const onMove = useCallback((e: React.MouseEvent) => {
    if (moveRef.current !== null) cancelAnimationFrame(moveRef.current);
    moveRef.current = requestAnimationFrame(() => {
      setMousePos({ x: e.clientX, y: e.clientY });
    });
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ClosedTrade[]>();
    for (const t of trades) {
      const key = groupKey(t);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [trades]);

  const groupsByType = useMemo(() => {
    const buckets: Record<string, [string, ClosedTrade[]][]> = {};
    for (const cat of CATEGORY_ORDER) buckets[cat] = [];
    for (const [key, rows] of grouped.entries()) {
      const type = rows[0].type;
      if (!buckets[type]) buckets[type] = [];
      buckets[type].push([key, rows]);
    }
    return buckets;
  }, [grouped]);

  const toggleType = useCallback((type: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  return (
    <>
      {hovered && <TradeTooltip trade={hovered} x={mousePos.x} y={mousePos.y} />}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 border-b border-border text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          <span>{t("history.col.trade", lang)}</span><span className="text-right">{t("history.col.exit", lang)}</span><span className="text-right">{t("history.col.margin", lang)}</span><span className="text-right">{t("history.col.pnl", lang)}</span><span className="text-right">{t("history.col.when", lang)}</span>
        </div>
        <div className="divide-y divide-border/60">
          {CATEGORY_ORDER.map((type) => {
            const entries = groupsByType[type] ?? [];
            if (entries.length === 0) return null;
            const isCollapsed = collapsed.has(type);
            const catCount = entries.reduce((s, [, rows]) => s + rows.length, 0);
            const catCost = entries.reduce((s, [, rows]) => s + rows.reduce((ss, t) => ss + t.cost, 0), 0);
            const catPnl = entries.reduce((s, [, rows]) => s + rows.reduce((ss, t) => ss + t.pnl, 0), 0);

            return (
              <div key={type}>
                <CategoryHeaderRow
                  type={type}
                  count={catCount}
                  totalCost={catCost}
                  totalPnl={catPnl}
                  collapsed={isCollapsed}
                  onToggle={() => toggleType(type)}
                />
                {!isCollapsed && (
                  <div>
                    {entries.map(([key, rows]) => {
                      const first = rows[0];
                      const isGroup = rows.length > 1;
                      const totalPnl = rows.reduce((s, t) => s + t.pnl, 0);
                      const totalCost = rows.reduce((s, t) => s + t.cost, 0);
                      const up = totalPnl >= 0;
                      const pct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
                      const ex = isGroup
                        ? { label: t("history.groupTrades", lang).replace("{n}", String(rows.length)), color: up ? "#22c55e" : "#ef4444" }
                        : exit(first, lang);

                      return (
                        <div key={key} className="group" dir="rtl">
                          {/* Summary row */}
                          <div
                            onClick={() => onSelect(first)}
                            onMouseEnter={() => setHovered(first)}
                            onMouseLeave={() => setHovered(null)}
                            onMouseMove={onMove}
                            role="button"
                            tabIndex={0}
                            title={t("history.tooltip.viewDetails", lang)}
                            className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 px-3 py-2.5 items-center text-xs cursor-pointer transition-colors hover:bg-secondary/30"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">{typeLabel(first.type, lang)}</span>
                                <ChartIcon className="h-3 w-3 text-muted-foreground/50" />
                                {first.symbol && <span className="font-mono text-[9px] font-bold text-primary">{first.symbol}</span>}
                                {first.direction && (
                                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: first.direction === "LONG" || first.direction === "YES" ? "#22c55e1a" : "#ef44441a", color: first.direction === "LONG" || first.direction === "YES" ? "#22c55e" : "#ef4444" }}>
                                    {first.direction}
                                  </span>
                                )}
                                {isGroup && (
                                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                                    {rows.length}x
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-foreground/90 break-words line-clamp-2 mt-0.5" title={first.description}>{first.description}</div>
                              {(first.source || first.type === "POLYMARKET" || first.type === "FUNDING" || first.type === "OPTION") && !isGroup && (
                                <div className="mt-0.5">
                                  {first.source ? (
                                    <BotStatsPopover
                                      source={first.source}
                                      type={first.type}
                                      label={botName(first.source) ?? first.source}
                                      className="font-mono text-[8px] font-bold px-1 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/25 hover:bg-amber-400/30 transition-colors cursor-pointer"
                                    />
                                  ) : (
                                    <BotStatsPopover
                                      type={first.type}
                                      label={first.type === "POLYMARKET" ? "Polymarket Bot" : "Funding Arb"}
                                      className="font-mono text-[8px] font-bold px-1 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/25 hover:bg-amber-400/30 transition-colors cursor-pointer"
                                    />
                                  )}
                                </div>
                              )}
                              {isGroup && (
                                <div className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
                                  {t("history.tradesInGroup", lang).replace("{n}", String(rows.length))}
                                </div>
                              )}
                            </div>
                            <div className="text-right sm:order-none order-last col-span-2 sm:col-span-1">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${ex.color}1a`, color: ex.color }}>{ex.label}</span>
                            </div>
                            <div className="hidden sm:block text-right font-mono text-[11px] text-muted-foreground">${fmtUsd(totalCost)}</div>
                            <div className="text-right flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1">
                                {up && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); shareTrade(first.symbol ?? first.description?.split(" ")[0] ?? t("history.assetFallback", lang), totalPnl, toast, lang); }}
                                    title={t("history.share.btnTitle", lang)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-emerald-500/20"
                                    aria-label={t("history.share.btnAria", lang)}
                                  >
                                    <Share2 className="h-3 w-3" style={{ color: "#22c55e" }} />
                                  </button>
                                )}
                                <div className="font-mono text-sm font-bold" style={{ color: up ? "#22c55e" : "#ef4444" }}>{up ? "+" : ""}${fmtUsd(totalPnl)}</div>
                              </div>
                              <div className="font-mono text-[10px]" style={{ color: up ? "#22c55e" : "#ef4444" }}>{up ? "+" : ""}{pct.toFixed(1)}%</div>
                            </div>
                            <div className="hidden sm:block text-right font-mono text-[10px] text-muted-foreground">
                              <div>{timeAgo(first.closedAt, lang)}</div>
                              {duration(first, lang) && <div className="text-muted-foreground/50">{duration(first, lang)}</div>}
                            </div>
                          </div>

                          {/* Expandable detail rows for groups */}
                          {isGroup && (
                            <div className="bg-background/30 border-t border-border/30">
                              {rows.map((t) => {
                                const u = t.pnl >= 0;
                                const p = t.cost > 0 ? (t.pnl / t.cost) * 100 : 0;
                                const ex = exit(t, lang);
                                return (
                                  <div
                                    key={t.id}
                                    onClick={() => onSelect(t)}
                                    onMouseEnter={() => setHovered(t)}
                                    onMouseLeave={() => setHovered(null)}
                                    onMouseMove={onMove}
                                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 px-3 py-1.5 items-center text-xs cursor-pointer hover:bg-secondary/20 transition-colors opacity-70"
                                    dir="rtl"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-mono text-[10px] text-muted-foreground">{t.description}</span>
                                    </div>
                                    <div className="text-right sm:order-none order-last col-span-2 sm:col-span-1">
                                      <span className="font-mono text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: `${ex.color}1a`, color: ex.color }}>{ex.label}</span>
                                    </div>
                                    <div className="hidden sm:block text-right font-mono text-[10px] text-muted-foreground">${fmtUsd(t.cost)}</div>
                                    <div className="text-right">
                                      <div className="font-mono text-[10px] font-bold" style={{ color: u ? "#22c55e" : "#ef4444" }}>{u ? "+" : ""}${fmtUsd(t.pnl)}</div>
                                      <div className="font-mono text-[9px]" style={{ color: u ? "#22c55e" : "#ef4444" }}>{u ? "+" : ""}{p.toFixed(1)}%</div>
                                    </div>
                                    <div className="hidden sm:block text-right font-mono text-[9px] text-muted-foreground">
                                      {timeAgo(t.closedAt, lang)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FilterGroup({ label, value, setValue, options, render }: {
  label: string; value: string; setValue: (v: string) => void; options: string[]; render: (o: string) => string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => setValue(o)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
              value === o ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
            style={value === o ? { boxShadow: "inset 0 0 0 1px hsl(207 30% 70% / 0.3)" } : {}}
          >
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
