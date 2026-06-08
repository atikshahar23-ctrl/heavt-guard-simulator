import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetBinanceMulti, getGetBinanceMultiQueryKey,
  useGetAllMarkets, getGetAllMarketsQueryKey,
  useGetStocks, getGetStocksQueryKey,
} from "@workspace/api-client-react";
import {
  X, TrendingUp, TrendingDown, Bot, Hand,
  Layers, Activity, BarChart3, ArrowRight, Cpu,
} from "lucide-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useLivePrice } from "@/contexts/live-price-context";
import { CryptoIcon } from "@/components/crypto-icon";
import { StockIcon } from "@/components/stock-icon";
import { Badge } from "@/components/ui/badge";
import { useRefresh } from "@/contexts/refresh-context";

/* ─── helpers ─── */
const fmtUsd = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function pnlCls(n: number) {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-muted-foreground";
}
function pnlBorder(n: number) {
  if (n > 0) return "border-emerald-500/25";
  if (n < 0) return "border-red-500/25";
  return "border-border/40";
}

function SourceBadge({ auto, source }: { auto?: boolean; source?: string }) {
  if (auto)
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-primary/10 text-primary border border-primary/25 px-1.5 py-0.5 rounded-full">
        <Bot className="h-2.5 w-2.5" /> {source ?? "AUTO"}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-muted/60 text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded-full">
      <Hand className="h-2.5 w-2.5" /> MANUAL
    </span>
  );
}

/* ─── Live price hook for a single crypto asset ─── */
function useCryptoPrice(asset: string, fallback: number): number {
  // The live-price store keys on the base asset (e.g. "BTC"), not the pair
  // ("BTCUSDT"). Pass the base asset so the WS overlay actually hits.
  const live = useLivePrice(asset);
  return live?.price ?? fallback;
}

/* ══════════════════════ Crypto (Binance) rows ═══════════════════════ */
function CryptoRow({
  pos,
  fallbackPrices,
  onClose,
}: {
  pos: import("@/contexts/portfolio-context").BinancePosition;
  fallbackPrices: Record<string, number>;
  onClose: () => void;
}) {
  const livePrice = useCryptoPrice(pos.asset, fallbackPrices[pos.asset] ?? pos.entryPrice);
  const currentPrice = livePrice;
  const priceDelta =
    pos.direction === "LONG"
      ? (currentPrice - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - currentPrice) / pos.entryPrice;
  const pnl = priceDelta * pos.notional;
  const pnlPct = priceDelta * pos.leverage * 100;
  const margin = pos.notional / pos.leverage;
  const age = Math.round((Date.now() - new Date(pos.openedAt).getTime()) / 60000);

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 px-4 py-3 border-b border-primary/8 hover:bg-primary/4 transition-colors text-xs font-mono ${pnlBorder(pnl)}`}
    >
      {/* Asset */}
      <CryptoIcon asset={pos.asset} size={22} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-sm">{pos.asset}</span>
          <span className={`text-[10px] font-black ${pos.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
            {pos.direction === "LONG" ? "▲ LONG" : "▼ SHORT"}
          </span>
          <span className="text-primary text-[10px]">{pos.leverage}×</span>
          <SourceBadge auto={pos.auto} source={pos.source} />
        </div>
        <div className="flex items-center gap-3 text-muted-foreground mt-0.5 flex-wrap">
          <span>Entry <span className="text-foreground">${pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></span>
          {pos.slPrice && <span>SL <span className="text-red-400/80">${pos.slPrice.toFixed(2)}</span></span>}
          {pos.tpPrice && <span>TP <span className="text-emerald-400/80">${pos.tpPrice.toFixed(2)}</span></span>}
          <span className="text-muted-foreground/50">{age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`}</span>
        </div>
      </div>

      {/* Mark */}
      <div className="text-right hidden md:block">
        <div className="text-[10px] text-muted-foreground mb-0.5">MARK</div>
        <div className="font-semibold">${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      </div>

      {/* Margin */}
      <div className="text-right hidden lg:block">
        <div className="text-[10px] text-muted-foreground mb-0.5">MARGIN</div>
        <div>${margin.toFixed(0)}</div>
      </div>

      {/* Notional */}
      <div className="text-right hidden lg:block">
        <div className="text-[10px] text-muted-foreground mb-0.5">SIZE</div>
        <div>${pos.notional.toFixed(0)}</div>
      </div>

      {/* PnL */}
      <div className="text-right">
        <div className="text-[10px] text-muted-foreground mb-0.5">PNL</div>
        <div className={`font-black ${pnlCls(pnl)}`}>{pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}</div>
        <div className={`text-[10px] ${pnlCls(pnlPct)}`}>{fmtPct(pnlPct)}</div>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="p-1.5 rounded border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
        title="Close position"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ══════════════════════ Stock rows ═══════════════════════ */
function StockRow({
  pos,
  stockPrices,
  onClose,
}: {
  pos: import("@/contexts/portfolio-context").StockPosition;
  stockPrices: Record<string, number>;
  onClose: () => void;
}) {
  const currentPrice = stockPrices[pos.symbol] ?? pos.entryPrice;
  const dir = pos.direction ?? "LONG";
  const pnl = pos.shares * (dir === "SHORT" ? pos.entryPrice - currentPrice : currentPrice - pos.entryPrice);
  const pnlPct = (pnl / pos.cost) * 100;
  const age = Math.round((Date.now() - new Date(pos.openedAt).getTime()) / 60000);

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 px-4 py-3 border-b border-primary/8 hover:bg-primary/4 transition-colors text-xs font-mono`}
    >
      <StockIcon symbol={pos.symbol} size={22} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-sm">{pos.symbol}</span>
          <span className={`text-[10px] font-black ${dir === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
            {dir === "LONG" ? "▲ LONG" : "▼ SHORT"}
          </span>
          {pos.leverage > 1 && <span className="text-primary text-[10px]">{pos.leverage}×</span>}
          <SourceBadge auto={pos.auto} source={pos.source} />
        </div>
        <div className="flex items-center gap-3 text-muted-foreground mt-0.5 flex-wrap">
          <span className="truncate max-w-[180px]">{pos.name}</span>
          <span>Entry <span className="text-foreground">${pos.entryPrice.toFixed(2)}</span></span>
          {pos.slPrice && <span>SL <span className="text-red-400/80">${pos.slPrice.toFixed(2)}</span></span>}
          {pos.tpPrice && <span>TP <span className="text-emerald-400/80">${pos.tpPrice.toFixed(2)}</span></span>}
          <span className="text-muted-foreground/50">{age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`}</span>
        </div>
      </div>

      <div className="text-right hidden md:block">
        <div className="text-[10px] text-muted-foreground mb-0.5">NOW</div>
        <div className="font-semibold">${currentPrice.toFixed(2)}</div>
      </div>

      <div className="text-right hidden lg:block">
        <div className="text-[10px] text-muted-foreground mb-0.5">SHARES</div>
        <div>{pos.shares.toFixed(4)}</div>
      </div>

      <div className="text-right hidden lg:block">
        <div className="text-[10px] text-muted-foreground mb-0.5">COST</div>
        <div>${pos.cost.toFixed(0)}</div>
      </div>

      <div className="text-right">
        <div className="text-[10px] text-muted-foreground mb-0.5">PNL</div>
        <div className={`font-black ${pnlCls(pnl)}`}>{pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}</div>
        <div className={`text-[10px] ${pnlCls(pnlPct)}`}>{fmtPct(pnlPct)}</div>
      </div>

      <button
        onClick={onClose}
        className="p-1.5 rounded border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
        title="Close position"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ══════════════════════ Poly cards ═══════════════════════ */
function PolyCard({
  pos,
  allMarkets,
  onClose,
}: {
  pos: import("@/contexts/portfolio-context").PolyPosition;
  allMarkets: { conditionId: string; yesPrice: number; noPrice: number }[];
  onClose: () => void;
}) {
  const live = allMarkets.find((m) => m.conditionId === pos.conditionId);
  const currentPrice = live ? (pos.side === "YES" ? live.yesPrice : live.noPrice) : pos.entryPrice;
  const value = pos.shares * currentPrice;
  const pnl = value - pos.cost;
  const pnlPct = (pnl / pos.cost) * 100;
  const age = Math.round((Date.now() - new Date(pos.openedAt).getTime()) / 60000);

  return (
    <div className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${pnl > 0 ? "border-emerald-500/25 bg-emerald-500/4" : pnl < 0 ? "border-red-500/25 bg-red-500/4" : "border-border/40 bg-card/40"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] font-black font-mono ${pos.side === "YES" ? "text-emerald-400" : "text-amber-400"}`}>
            {pos.side}
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">{pos.category}</span>
          <span className="text-[9px] text-muted-foreground/50 font-mono">
            {age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`}
          </span>
        </div>
        <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed font-mono">{pos.question}</p>
        <div className="text-[10px] text-muted-foreground font-mono mt-1.5">
          {pos.shares.toFixed(2)} shares · ${pos.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className={`text-sm font-black font-mono ${pnlCls(pnl)}`}>
          {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
        </div>
        <div className={`text-[10px] font-mono ${pnlCls(pnlPct)}`}>{fmtPct(pnlPct)}</div>
        <div className="text-[10px] text-muted-foreground font-mono">~{fmtUsd(value)}</div>
        <button
          onClick={onClose}
          className="mt-1 p-1.5 rounded border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
          title="Close position"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════ Section header ═══════════════════════════════ */
function SectionHeader({
  icon: Icon,
  label,
  count,
  pnl,
  onCloseAll,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  pnl: number;
  onCloseAll?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/15">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold flex-1">
        {label}
      </span>
      <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">
        {count}
      </span>
      {count > 0 && pnl !== 0 && (
        <span className={`text-[10px] font-mono font-bold ${pnlCls(pnl)}`}>
          {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
        </span>
      )}
      {onCloseAll && count > 0 && (
        <button
          onClick={onCloseAll}
          className="text-[9px] font-mono text-muted-foreground hover:text-red-400 border border-border/40 hover:border-red-500/30 px-2 py-0.5 rounded transition-all"
        >
          Close All
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════ PAGE ══════════════════════════════════ */
export default function TradeDesk() {
  const { intervalFor } = useRefresh();
  const {
    binancePositions, closeBinancePosition,
    stockPositions, closeStockPosition,
    polyPositions, closePolyPosition,
    cash, totalDeposited,
  } = usePortfolio();

  // Live prices come from the WS overlay per-position; this REST call is only the
  // baseline/fallback, so floor it at 5s (even in fast mode) to avoid 429s.
  const { data: binanceData } = useGetBinanceMulti({
    query: { queryKey: getGetBinanceMultiQueryKey(), refetchInterval: intervalFor(5000, 5000) },
  });
  const { data: stocksData } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: intervalFor(30000, 30000) },
  });
  const { data: allMarketsData } = useGetAllMarkets(
    {},
    { query: { queryKey: getGetAllMarketsQueryKey({}), refetchInterval: intervalFor(30000, 30000) } }
  );

  const fallbackPrices = useMemo(() => {
    const m: Record<string, number> = {};
    (binanceData ?? []).forEach((b) => (m[b.asset] = b.markPrice));
    return m;
  }, [binanceData]);

  const stockPrices = useMemo(() => {
    const m: Record<string, number> = {};
    (stocksData ?? []).forEach((s) => (m[s.symbol] = s.price));
    return m;
  }, [stocksData]);

  const allMarkets = useMemo(
    () => (allMarketsData ?? []).map((m) => ({
      conditionId: m.conditionId,
      yesPrice: m.yesPrice,
      noPrice: m.noPrice,
    })),
    [allMarketsData]
  );

  /* ─ per-section PnL ─ */
  const cryptoPnl = useMemo(
    () =>
      binancePositions.reduce((sum, pos) => {
        const p = fallbackPrices[pos.asset] ?? pos.entryPrice;
        const d = pos.direction === "LONG" ? (p - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - p) / pos.entryPrice;
        return sum + d * pos.notional;
      }, 0),
    [binancePositions, fallbackPrices]
  );

  const stockPnl = useMemo(
    () =>
      stockPositions.reduce((sum, pos) => {
        const p = stockPrices[pos.symbol] ?? pos.entryPrice;
        return sum + pos.shares * ((pos.direction ?? "LONG") === "SHORT" ? pos.entryPrice - p : p - pos.entryPrice);
      }, 0),
    [stockPositions, stockPrices]
  );

  const polyPnl = useMemo(
    () =>
      polyPositions.reduce((sum, pos) => {
        const live = allMarkets.find((m) => m.conditionId === pos.conditionId);
        const p = live ? (pos.side === "YES" ? live.yesPrice : live.noPrice) : pos.entryPrice;
        return sum + pos.shares * p - pos.cost;
      }, 0),
    [polyPositions, allMarkets]
  );

  const totalPnl = cryptoPnl + stockPnl + polyPnl;
  const totalOpen = binancePositions.length + stockPositions.length + polyPositions.length;
  const pnlFromStart = totalDeposited > 0 ? ((cash - totalDeposited) / totalDeposited) * 100 : 0;

  /* ─ close-all helpers ─ */
  function closeAllCrypto() {
    binancePositions.forEach((p) => closeBinancePosition(p.id, fallbackPrices[p.asset] ?? p.entryPrice));
  }
  function closeAllStocks() {
    stockPositions.forEach((p) => closeStockPosition(p.id, stockPrices[p.symbol] ?? p.entryPrice));
  }
  function closeAllPoly() {
    polyPositions.forEach((p) => {
      const live = allMarkets.find((m) => m.conditionId === p.conditionId);
      const price = live ? (p.side === "YES" ? live.yesPrice : live.noPrice) : p.entryPrice;
      closePolyPosition(p.id, price);
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ─ Header ─ */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-mono tracking-[0.25em] text-primary uppercase">
              Active Positions — Live
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ textShadow: "0 0 24px hsl(207 30% 70% / 0.35)" }}>
            Trade Desk
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="rtl">
            כל העסקאות הפעילות · קריפטו · מניות · Polymarket
          </p>
        </div>
        <Link href="/simulator" className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors self-start mt-1">
          Open Simulator <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ─ Summary tiles ─ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: Layers,
            label: "Open Positions",
            value: totalOpen,
            sub: `${binancePositions.length} crypto · ${stockPositions.length} stocks · ${polyPositions.length} poly`,
            color: "text-primary",
          },
          {
            icon: Activity,
            label: "Unrealized PnL",
            value: `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)}`,
            sub: totalOpen === 0 ? "no open positions" : "across all assets",
            color: pnlCls(totalPnl),
          },
          {
            icon: TrendingUp,
            label: "Cash Balance",
            value: `$${cash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            sub: `${pnlFromStart >= 0 ? "+" : ""}${pnlFromStart.toFixed(2)}% all-time`,
            color: "text-foreground",
          },
          {
            icon: BarChart3,
            label: "Auto Positions",
            value: [
              ...binancePositions.filter((p) => p.auto),
              ...stockPositions.filter((p) => p.auto),
            ].length,
            sub: "opened by bots",
            color: "text-primary",
          },
        ].map((t) => (
          <div
            key={t.label}
            className="rounded-lg border border-primary/20 bg-background/70 backdrop-blur-sm p-4 relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 h-14 w-14 rounded-full bg-primary/5 blur-xl" />
            <div className="flex items-center gap-2 mb-2">
              <t.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase">{t.label}</span>
            </div>
            <div className={`text-xl font-black font-mono ${t.color}`}>{t.value}</div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{t.sub}</div>
          </div>
        ))}
      </div>

      {/* ─ No positions state ─ */}
      {totalOpen === 0 && (
        <div className="rounded-lg border border-dashed border-primary/20 py-16 text-center">
          <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-mono text-muted-foreground">// NO OPEN POSITIONS</p>
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">
            פתח עסקה מה-Simulator, Scalp Signals או Momentum Radar
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <Link href="/simulator" className="text-xs font-mono text-primary hover:underline">Simulator →</Link>
            <Link href="/scalp" className="text-xs font-mono text-primary hover:underline">Scalp Signals →</Link>
          </div>
        </div>
      )}

      {/* ══ Crypto positions ══ */}
      {(binancePositions.length > 0 || true) && (
        <div className="rounded-lg border border-primary/20 bg-background/60 backdrop-blur-sm overflow-hidden">
          <SectionHeader
            icon={Activity}
            label="Crypto Futures (Binance)"
            count={binancePositions.length}
            pnl={cryptoPnl}
            onCloseAll={closeAllCrypto}
          />
          {binancePositions.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs font-mono text-muted-foreground/60">
              // no open crypto positions
            </div>
          ) : (
            <div>
              {/* column headers */}
              <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 text-[9px] font-mono text-muted-foreground/60 tracking-widest uppercase border-b border-primary/8">
                <span className="w-[22px]" />
                <span>Asset</span>
                <span className="text-right w-20">Mark</span>
                <span className="text-right w-16 hidden lg:block">Margin</span>
                <span className="text-right w-16 hidden lg:block">Size</span>
                <span className="text-right w-20">PnL</span>
                <span className="w-8" />
              </div>
              {binancePositions.map((pos) => (
                <CryptoRow
                  key={pos.id}
                  pos={pos}
                  fallbackPrices={fallbackPrices}
                  onClose={() => closeBinancePosition(pos.id, fallbackPrices[pos.asset] ?? pos.entryPrice)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ Stock positions ══ */}
      <div className="rounded-lg border border-primary/20 bg-background/60 backdrop-blur-sm overflow-hidden">
        <SectionHeader
          icon={TrendingUp}
          label="Stocks"
          count={stockPositions.length}
          pnl={stockPnl}
          onCloseAll={closeAllStocks}
        />
        {stockPositions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs font-mono text-muted-foreground/60">
            // no open stock positions
          </div>
        ) : (
          <div>
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 text-[9px] font-mono text-muted-foreground/60 tracking-widest uppercase border-b border-primary/8">
              <span className="w-[22px]" />
              <span>Symbol</span>
              <span className="text-right w-20">Price</span>
              <span className="text-right w-16 hidden lg:block">Shares</span>
              <span className="text-right w-16 hidden lg:block">Cost</span>
              <span className="text-right w-20">PnL</span>
              <span className="w-8" />
            </div>
            {stockPositions.map((pos) => (
              <StockRow
                key={pos.id}
                pos={pos}
                stockPrices={stockPrices}
                onClose={() => closeStockPosition(pos.id, stockPrices[pos.symbol] ?? pos.entryPrice)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══ Polymarket positions ══ */}
      <div className="rounded-lg border border-primary/20 bg-background/60 backdrop-blur-sm overflow-hidden">
        <SectionHeader
          icon={BarChart3}
          label="Polymarket — Predictions"
          count={polyPositions.length}
          pnl={polyPnl}
        />
        {polyPositions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs font-mono text-muted-foreground/60">
            // no open prediction positions
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {polyPositions.map((pos) => (
              <PolyCard
                key={pos.id}
                pos={pos}
                allMarkets={allMarkets}
                onClose={() => {
                  const live = allMarkets.find((m) => m.conditionId === pos.conditionId);
                  const price = live ? (pos.side === "YES" ? live.yesPrice : live.noPrice) : pos.entryPrice;
                  closePolyPosition(pos.id, price);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
