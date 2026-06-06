import { useMemo, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useGetMarketOverview, getGetMarketOverviewQueryKey } from "@workspace/api-client-react";
import {
  History as HistoryIcon, TrendingUp, TrendingDown, Trophy, Target,
  Bot, Hand, Wallet, Activity, Cpu, LineChart as ChartIcon,
} from "lucide-react";
import { usePortfolio, type ClosedTrade, type BinancePosition, type StockPosition } from "@/contexts/portfolio-context";
import { CryptoIcon } from "@/components/crypto-icon";
import { StockIcon } from "@/components/stock-icon";
import { TradeAnalytics } from "@/components/trade-analytics";
import { TradeDetailModal } from "@/components/trade-detail-modal";

type TypeFilter = "ALL" | "BINANCE" | "STOCK" | "POLYMARKET";
type ResultFilter = "ALL" | "WINS" | "LOSSES";
type SourceFilter = "ALL" | "AUTO" | "MANUAL";

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

function exit(t: ClosedTrade) {
  if (t.exit === "TP") return { label: "TP", color: "#22c55e" };
  if (t.exit === "SL") return { label: "SL", color: "#ef4444" };
  if (t.exit === "LIQ") return { label: "LIQ", color: "#f59e0b" };
  return { label: "ידני", color: "#a1a1aa" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} ד׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} ש׳`;
  return `לפני ${Math.floor(h / 24)} י׳`;
}

/** Holding duration from open to close, when both timestamps are known. */
function duration(t: ClosedTrade): string | null {
  if (!t.openedAt) return null;
  const ms = new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime();
  if (!(ms > 0)) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} ד׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ש׳ ${m % 60} ד׳`;
  return `${Math.floor(h / 24)} י׳ ${h % 24} ש׳`;
}

const TYPE_LABEL: Record<ClosedTrade["type"], string> = {
  BINANCE: "פיוצ'רס",
  STOCK: "מניות",
  POLYMARKET: "הימור",
};

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
        <h2 className="text-sm font-black tracking-tight">פוזיציות פתוחות ({total})</h2>
      </div>

      {/* Crypto / Binance Futures */}
      {Object.entries(cryptoByBot).map(([botName, positions]) => (
        <div key={`crypto-${botName}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">{botName}</span>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[9px] font-mono text-muted-foreground">{positions.length} קריפטו</span>
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
                  title="צפה בגרף"
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
                      <div>כניסה ${fmtPrice(p.entryPrice)}</div>
                      <div>שוק ${fmtPrice(cur)}</div>
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
                    סגור @ ${fmtPrice(cur)}
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
            <span className="text-[9px] font-mono text-muted-foreground">{positions.length} מניות</span>
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
                  title="צפה בגרף"
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
                    {p.shares.toFixed(2)} מניות @ ${fmtPrice(p.entryPrice)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeStockPosition(p.id, p.entryPrice); }}
                    className="w-full rounded py-1.5 text-[11px] font-mono font-bold bg-secondary/60 hover:bg-secondary transition-colors"
                  >
                    סגור
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
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">שוקי חיזוי</span>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[9px] font-mono text-muted-foreground">{polyPositions.length} הימורים</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {polyPositions.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate("/simulator?tab=prediction")}
                role="button"
                tabIndex={0}
                title="צפה בשוק החיזוי"
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
                  {p.shares.toFixed(2)} יחידות · כניסה ${p.entryPrice.toFixed(3)}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); closePolyPosition(p.id, p.entryPrice); }}
                  className="w-full rounded py-1.5 text-[11px] font-mono font-bold bg-secondary/60 hover:bg-secondary transition-colors"
                >
                  סגור
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
  const { tradeHistory, cash, totalDeposited } = usePortfolio();
  const [typeF, setTypeF] = useState<TypeFilter>("ALL");
  const [resultF, setResultF] = useState<ResultFilter>("ALL");
  const [sourceF, setSourceF] = useState<SourceFilter>("ALL");
  const [selected, setSelected] = useState<ClosedTrade | null>(null);

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
    return { n, wins, losses, totalPnl, best, worst, winRate, autoCount, profitFactor };
  }, [tradeHistory]);

  const filtered = useMemo(() => {
    return tradeHistory.filter((t) => {
      if (typeF !== "ALL" && t.type !== typeF) return false;
      if (resultF === "WINS" && t.pnl <= 0) return false;
      if (resultF === "LOSSES" && t.pnl >= 0) return false;
      if (sourceF === "AUTO" && !t.auto) return false;
      if (sourceF === "MANUAL" && t.auto) return false;
      return true;
    });
  }, [tradeHistory, typeF, resultF, sourceF]);

  const pnlColor = stats.totalPnl > 0 ? "#22c55e" : stats.totalPnl < 0 ? "#ef4444" : undefined;

  function exit(t: ClosedTrade) {
    if (t.exit === "TP") return { label: "TP", color: "#22c55e" };
    if (t.exit === "SL") return { label: "SL", color: "#ef4444" };
    if (t.exit === "LIQ") return { label: "LIQ", color: "#f59e0b" };
    return { label: "ידני", color: "#a1a1aa" };
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">היסטוריית עסקאות</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            מעקב הדמו המלא שלך — כל פוזיציה שנסגרה, אחוז ההצלחה והרווח/הפסד. הדמיה חינוכית בלבד, ללא כסף אמיתי.
          </p>
        </div>
      </div>

      {/* Account row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="יתרה" value={`$${fmtUsd(cash, 0)}`} Icon={Wallet} sub={`הופקדו $${fmtUsd(totalDeposited, 0)}`} />
        <StatCard label="רווח/הפסד ממומש" value={`${stats.totalPnl >= 0 ? "+" : ""}$${fmtUsd(stats.totalPnl)}`} color={pnlColor} Icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown} sub={`${stats.n} עסקאות סגורות`} />
        <StatCard label="אחוז הצלחה" value={`${stats.winRate.toFixed(0)}%`} Icon={Trophy} sub={`${stats.wins} נצחונות · ${stats.losses} הפסדים`} />
        <StatCard label="מקדם רווח" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} Icon={Target} sub={`${stats.autoCount} אוטומטיות`} />
      </div>

      {/* Best/Worst row */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="העסקה הטובה ביותר" value={`+$${fmtUsd(stats.best)}`} color="#22c55e" Icon={TrendingUp} />
        <StatCard label="העסקה הגרועה ביותר" value={`-$${fmtUsd(Math.abs(stats.worst))}`} color="#ef4444" Icon={TrendingDown} />
      </div>

      <OpenPositions />

      <TradeAnalytics />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterGroup label="סוג" value={typeF} setValue={(v) => setTypeF(v as TypeFilter)} options={["ALL", "BINANCE", "STOCK", "POLYMARKET"]} render={(o) => (o === "ALL" ? "הכל" : TYPE_LABEL[o as ClosedTrade["type"]])} />
        <FilterGroup label="תוצאה" value={resultF} setValue={(v) => setResultF(v as ResultFilter)} options={["ALL", "WINS", "LOSSES"]} render={(o) => ({ ALL: "הכל", WINS: "רווחים", LOSSES: "הפסדים" }[o] ?? o)} />
        <FilterGroup label="מקור" value={sourceF} setValue={(v) => setSourceF(v as SourceFilter)} options={["ALL", "AUTO", "MANUAL"]} render={(o) => ({ ALL: "הכל", AUTO: "אוטומטי", MANUAL: "ידני" }[o] ?? o)} />
      </div>

      {/* Table */}
      {tradeHistory.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <HistoryIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">עדיין אין עסקאות סגורות.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">פתח עסקת דמו ממסך סיגנלי הסקאלפ או הסימולטור כדי להתחיל.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">אין עסקאות שתואמות את הסינון.</p>
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
  const up = trade.pnl >= 0;
  const pct = trade.cost > 0 ? (trade.pnl / trade.cost) * 100 : 0;
  const ex = exit(trade);
  const bot = botName(trade.source);
  const dur = duration(trade);
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
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">{TYPE_LABEL[trade.type]}</span>
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
            {!bot && trade.auto && <span className="text-[9px] text-muted-foreground">(אוטו)</span>}
          </div>
        )}
        {!trade.source && !trade.auto && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-secondary/10">
            <Hand className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">ידני</span>
          </div>
        )}

        {/* Price details */}
        <div className="px-3 py-2 space-y-1">
          {trade.entryPrice != null && trade.exitPrice != null && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">כניסה → יציאה</span>
              <span>${fmtPrice(trade.entryPrice)} → ${fmtPrice(trade.exitPrice)}</span>
            </div>
          )}
          {trade.leverage != null && trade.leverage > 1 && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">מינוף</span>
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
            <span className="text-muted-foreground">מרג'ין</span>
            <span>${fmtUsd(trade.cost)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">תמורה</span>
            <span>${fmtUsd(trade.proceeds)}</span>
          </div>
        </div>

        {/* P&L bar */}
        <div className="mx-3 mb-2 rounded px-2 py-1.5 flex justify-between items-center" style={{ background: up ? "#22c55e14" : "#ef444414" }}>
          <span className="text-muted-foreground">רווח / הפסד</span>
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
          <span>{timeAgo(trade.closedAt)}</span>
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

function ClosedTradeTable({ trades, onSelect }: { trades: ClosedTrade[]; onSelect: (t: ClosedTrade) => void }) {
  const [hovered, setHovered] = useState<ClosedTrade | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const moveRef = useRef<number | null>(null);

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

  return (
    <>
      {hovered && <TradeTooltip trade={hovered} x={mousePos.x} y={mousePos.y} />}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 border-b border-border text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          <span>עסקה</span><span className="text-right">יציאה</span><span className="text-right">מרג'ין</span><span className="text-right">רווח/הפסד</span><span className="text-right">מתי</span>
        </div>
        <div className="divide-y divide-border/60">
          {Array.from(grouped.entries()).map(([key, rows]) => {
            const first = rows[0];
            const isGroup = rows.length > 1;
            const totalPnl = rows.reduce((s, t) => s + t.pnl, 0);
            const totalCost = rows.reduce((s, t) => s + t.cost, 0);
            const up = totalPnl >= 0;
            const pct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
            const ex = isGroup
              ? { label: `${rows.length} טרידים`, color: up ? "#22c55e" : "#ef4444" }
              : exit(first);

            return (
              <div
                key={key}
                className="group"
                dir="rtl"
              >
                {/* Summary row */}
                <div
                  onClick={() => onSelect(first)}
                  onMouseEnter={() => setHovered(first)}
                  onMouseLeave={() => setHovered(null)}
                  onMouseMove={onMove}
                  role="button"
                  tabIndex={0}
                  title="צפה בפרטי העסקה"
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 px-3 py-2.5 items-center text-xs cursor-pointer transition-colors hover:bg-secondary/30"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">{TYPE_LABEL[first.type]}</span>
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
                    {isGroup && (
                      <div className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
                        {rows.length} חזיוניות באותו הסווג
                      </div>
                    )}
                  </div>
                  <div className="text-right sm:order-none order-last col-span-2 sm:col-span-1">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${ex.color}1a`, color: ex.color }}>{ex.label}</span>
                  </div>
                  <div className="hidden sm:block text-right font-mono text-[11px] text-muted-foreground">${fmtUsd(totalCost)}</div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold" style={{ color: up ? "#22c55e" : "#ef4444" }}>{up ? "+" : ""}${fmtUsd(totalPnl)}</div>
                    <div className="font-mono text-[10px]" style={{ color: up ? "#22c55e" : "#ef4444" }}>{up ? "+" : ""}{pct.toFixed(1)}%</div>
                  </div>
                  <div className="hidden sm:block text-right font-mono text-[10px] text-muted-foreground">
                    <div>{timeAgo(first.closedAt)}</div>
                    {duration(first) && <div className="text-muted-foreground/50">{duration(first)}</div>}
                  </div>
                </div>

                {/* Expandable detail rows for groups */}
                {isGroup && (
                  <div className="bg-background/30 border-t border-border/30">
                    {rows.map((t) => {
                      const u = t.pnl >= 0;
                      const p = t.cost > 0 ? (t.pnl / t.cost) * 100 : 0;
                      const ex = exit(t);
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
                            {timeAgo(t.closedAt)}
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
            style={value === o ? { boxShadow: "inset 0 0 0 1px hsl(32 84% 55% / 0.3)" } : {}}
          >
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
