import { useState, useMemo } from "react";
import {
  useGetBinanceMulti, getGetBinanceMultiQueryKey,
  useGetAllMarkets, getGetAllMarketsQueryKey,
} from "@workspace/api-client-react";
import {
  usePortfolio, PolyPosition, BinancePosition, STARTING_BALANCE,
} from "@/contexts/portfolio-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, TrendingDown, Wallet, RotateCcw, Search,
  ChartCandlestick, BarChart3, Trophy, History, X,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10] as const;
type Leverage = typeof LEVERAGE_OPTIONS[number];

function fmt(n: number, decimals = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUsd(n: number) {
  return `$${fmt(Math.abs(n))}`;
}
function pnlColor(n: number) {
  return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted-foreground";
}
function pnlBg(n: number) {
  return n > 0 ? "bg-emerald-500/10 border-emerald-500/20" : n < 0 ? "bg-red-500/10 border-red-500/20" : "bg-secondary/30 border-border";
}

/* ─── Portfolio Summary ─── */
function PortfolioSummary({
  unrealizedPnl,
  totalPositionValue,
}: {
  unrealizedPnl: number;
  totalPositionValue: number;
}) {
  const { cash, tradeHistory, resetPortfolio, polyPositions, binancePositions } = usePortfolio();
  const totalValue = cash + totalPositionValue;
  const totalPnl = totalValue - STARTING_BALANCE;
  const realizedPnl = tradeHistory.reduce((s, t) => s + t.pnl, 0);
  const openCount = polyPositions.length + binancePositions.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* Total value — hero */}
      <div className="col-span-2 md:col-span-1 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="text-[10px] font-mono text-primary/70 uppercase tracking-wider flex items-center gap-1.5">
          <Wallet className="h-3 w-3" /> Portfolio Value
        </div>
        <div className="text-2xl font-black font-mono text-primary mt-0.5">{fmtUsd(totalValue)}</div>
        <div className={`text-xs font-mono mt-0.5 ${pnlColor(totalPnl)}`}>
          {totalPnl >= 0 ? "+" : ""}{fmtUsd(totalPnl)} total
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Cash</div>
        <div className="text-2xl font-black font-mono text-foreground mt-0.5">{fmtUsd(cash)}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">available</div>
      </div>

      <div className={`rounded-lg border px-4 py-3 ${pnlBg(unrealizedPnl)}`}>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Unrealized</div>
        <div className={`text-2xl font-black font-mono mt-0.5 ${pnlColor(unrealizedPnl)}`}>
          {unrealizedPnl >= 0 ? "+" : ""}{fmtUsd(unrealizedPnl)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{openCount} open pos.</div>
      </div>

      <div className={`rounded-lg border px-4 py-3 ${pnlBg(realizedPnl)}`}>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Realized</div>
        <div className={`text-2xl font-black font-mono mt-0.5 ${pnlColor(realizedPnl)}`}>
          {realizedPnl >= 0 ? "+" : ""}{fmtUsd(realizedPnl)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{tradeHistory.length} closed</div>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Win Rate</div>
        <div className="text-2xl font-black font-mono text-foreground mt-0.5">
          {tradeHistory.length === 0
            ? "—"
            : `${Math.round((tradeHistory.filter(t => t.pnl > 0).length / tradeHistory.length) * 100)}%`}
        </div>
        <button
          onClick={() => {
            if (confirm("Reset all positions and balance to $10,000?")) resetPortfolio();
          }}
          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors mt-1"
        >
          <RotateCcw className="h-2.5 w-2.5" /> Reset
        </button>
      </div>
    </div>
  );
}

/* ─── Binance Futures Tab ─── */
function BinanceFuturesTab({ binancePrices }: { binancePrices: Record<string, number> }) {
  const { binancePositions, cash, openBinancePosition, closeBinancePosition } = usePortfolio();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [leverages, setLeverages] = useState<Record<string, Leverage>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ASSETS = ["BTC", "ETH", "SOL", "BNB"];

  function trade(asset: string, direction: "LONG" | "SHORT") {
    const raw = amounts[asset] ?? "";
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) {
      setErrors(e => ({ ...e, [asset]: "Enter a valid amount" }));
      return;
    }
    const leverage = leverages[asset] ?? 1;
    const currentPrice = binancePrices[asset];
    if (!currentPrice) {
      setErrors(e => ({ ...e, [asset]: "Price unavailable" }));
      return;
    }
    const err = openBinancePosition({ asset, direction, notional: amt, entryPrice: currentPrice, leverage });
    if (err) {
      setErrors(e => ({ ...e, [asset]: err }));
    } else {
      setAmounts(a => ({ ...a, [asset]: "" }));
      setErrors(e => ({ ...e, [asset]: "" }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {ASSETS.map((asset) => {
          const price = binancePrices[asset];
          const lev = leverages[asset] ?? 1;
          const amt = parseFloat(amounts[asset] ?? "0") || 0;
          const margin = lev > 0 ? amt / lev : amt;

          return (
            <div key={asset} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Binance Futures</div>
                  <div className="text-lg font-black font-mono text-primary">{asset}USDT</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Mark Price</div>
                  <div className="text-sm font-bold font-mono">
                    {price ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                  </div>
                </div>
              </div>

              {/* Leverage */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Leverage</span>
                <div className="flex gap-1">
                  {LEVERAGE_OPTIONS.map(l => (
                    <button
                      key={l}
                      onClick={() => setLeverages(lv => ({ ...lv, [asset]: l }))}
                      className={`flex-1 py-1 text-[11px] font-mono font-bold rounded transition-all ${lev === l ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
                    >
                      {l}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Notional (USDT)</span>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={amounts[asset] ?? ""}
                  onChange={e => setAmounts(a => ({ ...a, [asset]: e.target.value }))}
                  className="h-8 text-xs font-mono bg-secondary/30"
                />
                {amt > 0 && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Margin: ${fmt(margin)} · {cash < margin ? <span className="text-red-400">Insufficient</span> : <span className="text-emerald-400">OK</span>}
                  </div>
                )}
              </div>

              {errors[asset] && (
                <div className="text-[10px] text-red-400 font-mono">{errors[asset]}</div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => trade(asset, "LONG")}
                  className="flex items-center justify-center gap-1 py-2 rounded text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
                >
                  <TrendingUp className="h-3 w-3" /> LONG
                </button>
                <button
                  onClick={() => trade(asset, "SHORT")}
                  className="flex items-center justify-center gap-1 py-2 rounded text-[11px] font-bold font-mono bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-all"
                >
                  <TrendingDown className="h-3 w-3" /> SHORT
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Open Binance Positions */}
      {binancePositions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ChartCandlestick className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Open Futures Positions</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {binancePositions.map((pos) => {
            const currentPrice = binancePrices[pos.asset] ?? pos.entryPrice;
            const priceDelta = pos.direction === "LONG"
              ? (currentPrice - pos.entryPrice) / pos.entryPrice
              : (pos.entryPrice - currentPrice) / pos.entryPrice;
            const pnl = priceDelta * pos.notional;
            const pnlPct = priceDelta * pos.leverage * 100;
            const margin = pos.notional / pos.leverage;

            return (
              <div key={pos.id} className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${pnlBg(pnl)}`}>
                <div className="flex items-center gap-3">
                  <div className={`text-xs font-black font-mono ${pos.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                    {pos.direction}
                  </div>
                  <div>
                    <div className="text-sm font-bold font-mono">{pos.asset}USDT <span className="text-muted-foreground font-normal">{pos.leverage}x</span></div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Entry: ${pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} · Now: ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-black font-mono ${pnlColor(pnl)}`}>
                    {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
                  </div>
                  <div className={`text-[10px] font-mono ${pnlColor(pnl)}`}>
                    {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}% · Margin {fmtUsd(margin)}
                  </div>
                </div>
                <button
                  onClick={() => closeBinancePosition(pos.id, currentPrice)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                  title="Close position"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Polymarket Tab ─── */
function PolymarketTab({ allMarkets }: { allMarkets: { conditionId: string; question: string; yesPrice: number; noPrice: number; assetTag: string; slug: string | null }[] }) {
  const { polyPositions, cash, openPolyPosition, closePolyPosition } = usePortfolio();
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(() =>
    allMarkets
      .filter(m => !search || m.question.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 50),
    [allMarkets, search]
  );

  function bet(market: typeof allMarkets[0], side: "YES" | "NO") {
    const key = `${market.conditionId}-${side}`;
    const raw = amounts[key] ?? "";
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) {
      setErrors(e => ({ ...e, [key]: "Enter amount" }));
      return;
    }
    const entryPrice = side === "YES" ? market.yesPrice : market.noPrice;
    const err = openPolyPosition({
      conditionId: market.conditionId,
      question: market.question,
      category: market.assetTag,
      slug: market.slug,
      side,
      entryPrice,
    }, amt);
    if (err) {
      setErrors(e => ({ ...e, [key]: err }));
    } else {
      setAmounts(a => ({ ...a, [key]: "" }));
      setErrors(e => ({ ...e, [key]: "" }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Open Poly Positions */}
      {polyPositions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Open Prediction Positions</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {polyPositions.map((pos) => {
            const live = allMarkets.find(m => m.conditionId === pos.conditionId);
            const currentPrice = live
              ? (pos.side === "YES" ? live.yesPrice : live.noPrice)
              : pos.entryPrice;
            const value = pos.shares * currentPrice;
            const pnl = value - pos.cost;
            const pnlPct = (pnl / pos.cost) * 100;

            return (
              <div key={pos.id} className={`rounded-lg border p-4 flex items-start justify-between gap-4 ${pnlBg(pnl)}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-black font-mono ${pos.side === "YES" ? "text-emerald-400" : "text-amber-400"}`}>
                      {pos.side}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{pos.category}</span>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">{pos.question}</p>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    {fmt(pos.shares, 2)} shares · Entry ${pos.entryPrice.toFixed(3)} → Now ${currentPrice.toFixed(3)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-black font-mono ${pnlColor(pnl)}`}>
                    {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
                  </div>
                  <div className={`text-[10px] font-mono ${pnlColor(pnl)}`}>
                    {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Value: {fmtUsd(value)}
                  </div>
                </div>
                <button
                  onClick={() => closePolyPosition(pos.id, currentPrice)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0"
                  title="Close position"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Market search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search prediction markets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-secondary/30"
        />
      </div>

      {/* Market rows */}
      <div className="space-y-2">
        {filtered.map((m) => {
          const yesKey = `${m.conditionId}-YES`;
          const noKey = `${m.conditionId}-NO`;
          return (
            <div key={m.conditionId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px] font-mono py-0">{m.assetTag}</Badge>
                    <span className="text-[10px] text-primary font-mono font-bold">
                      {(m.yesPrice * 100).toFixed(0)}% YES
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">{m.question}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* YES bet */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="$"
                        value={amounts[yesKey] ?? ""}
                        onChange={e => setAmounts(a => ({ ...a, [yesKey]: e.target.value }))}
                        className="w-20 h-7 text-xs font-mono text-right bg-secondary/30 pr-1.5"
                      />
                      <button
                        onClick={() => bet(m, "YES")}
                        className="h-7 px-2.5 rounded text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all whitespace-nowrap"
                      >
                        YES <span className="opacity-70">${m.yesPrice.toFixed(2)}</span>
                      </button>
                    </div>
                    {errors[yesKey] && <span className="text-[9px] text-red-400 font-mono">{errors[yesKey]}</span>}
                  </div>
                  {/* NO bet */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="$"
                        value={amounts[noKey] ?? ""}
                        onChange={e => setAmounts(a => ({ ...a, [noKey]: e.target.value }))}
                        className="w-20 h-7 text-xs font-mono text-right bg-secondary/30 pr-1.5"
                      />
                      <button
                        onClick={() => bet(m, "NO")}
                        className="h-7 px-2.5 rounded text-[11px] font-bold font-mono bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-all whitespace-nowrap"
                      >
                        NO <span className="opacity-70">${m.noPrice.toFixed(2)}</span>
                      </button>
                    </div>
                    {errors[noKey] && <span className="text-[9px] text-red-400 font-mono">{errors[noKey]}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No markets found.</div>
        )}
      </div>
    </div>
  );
}

/* ─── Trade History ─── */
function TradeHistoryPanel() {
  const { tradeHistory } = usePortfolio();
  if (tradeHistory.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">Trade History</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="space-y-1.5">
        {tradeHistory.slice(0, 10).map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-border/50 bg-card/30 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className="text-[9px] font-mono flex-shrink-0">
                {t.type === "BINANCE" ? "FUT" : "PRED"}
              </Badge>
              <span className="text-muted-foreground truncate font-mono">{t.description}</span>
            </div>
            <div className={`font-black font-mono flex-shrink-0 flex items-center gap-1 ${pnlColor(t.pnl)}`}>
              {t.pnl >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {t.pnl >= 0 ? "+" : ""}{fmtUsd(t.pnl)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function SimulatorPage() {
  const [tab, setTab] = useState<"futures" | "prediction">("futures");
  const { polyPositions, binancePositions, cash } = usePortfolio();

  const { data: binanceData, isLoading: binanceLoading } = useGetBinanceMulti({
    query: { queryKey: getGetBinanceMultiQueryKey(), refetchInterval: 15000 }
  });

  const { data: allMarketsData, isLoading: marketsLoading } = useGetAllMarkets(
    {},
    { query: { queryKey: getGetAllMarketsQueryKey({}), refetchInterval: 60000 } }
  );

  const binancePrices = useMemo(() => {
    const map: Record<string, number> = {};
    (binanceData ?? []).forEach(b => { map[b.asset] = b.markPrice; });
    return map;
  }, [binanceData]);

  const allMarkets = useMemo(() =>
    (allMarketsData ?? []).map(m => ({
      conditionId: m.conditionId,
      question: m.question,
      yesPrice: m.yesPrice,
      noPrice: m.noPrice,
      assetTag: m.assetTag,
      slug: m.slug ?? null,
    })),
    [allMarketsData]
  );

  // Calculate unrealized PnL
  const unrealizedPnl = useMemo(() => {
    const binancePnl = binancePositions.reduce((sum, pos) => {
      const currentPrice = binancePrices[pos.asset] ?? pos.entryPrice;
      const priceDelta = pos.direction === "LONG"
        ? (currentPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - currentPrice) / pos.entryPrice;
      return sum + priceDelta * pos.notional;
    }, 0);

    const polyPnl = polyPositions.reduce((sum, pos) => {
      const live = allMarkets.find(m => m.conditionId === pos.conditionId);
      const currentPrice = live
        ? (pos.side === "YES" ? live.yesPrice : live.noPrice)
        : pos.entryPrice;
      const value = pos.shares * currentPrice;
      return sum + (value - pos.cost);
    }, 0);

    return binancePnl + polyPnl;
  }, [binancePositions, polyPositions, binancePrices, allMarkets]);

  const totalPositionValue = useMemo(() => {
    const binanceMargin = binancePositions.reduce((sum, pos) => sum + pos.notional / pos.leverage, 0);
    const binancePnl = binancePositions.reduce((sum, pos) => {
      const currentPrice = binancePrices[pos.asset] ?? pos.entryPrice;
      const priceDelta = pos.direction === "LONG"
        ? (currentPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - currentPrice) / pos.entryPrice;
      return sum + priceDelta * pos.notional;
    }, 0);
    const polyValue = polyPositions.reduce((sum, pos) => {
      const live = allMarkets.find(m => m.conditionId === pos.conditionId);
      const currentPrice = live
        ? (pos.side === "YES" ? live.yesPrice : live.noPrice)
        : pos.entryPrice;
      return sum + pos.shares * currentPrice;
    }, 0);
    return binanceMargin + binancePnl + polyValue;
  }, [binancePositions, polyPositions, binancePrices, allMarkets]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Paper Trading Simulator</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
              VIRTUAL FUNDS
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Trade with $10,000 virtual USDT using real-time Binance futures and Polymarket prices.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono">
          <span className="text-muted-foreground">Cash:</span>
          <span className="text-primary font-bold">{fmtUsd(cash)}</span>
        </div>
      </div>

      {/* Portfolio Summary */}
      <PortfolioSummary unrealizedPnl={unrealizedPnl} totalPositionValue={totalPositionValue} />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        <button
          onClick={() => setTab("futures")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
            tab === "futures"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ChartCandlestick className="h-4 w-4" />
          Binance Futures
          {binancePositions.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">
              {binancePositions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("prediction")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
            tab === "prediction"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Prediction Markets
          {polyPositions.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">
              {polyPositions.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {tab === "futures" ? (
        binanceLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : (
          <BinanceFuturesTab binancePrices={binancePrices} />
        )
      ) : (
        marketsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <PolymarketTab allMarkets={allMarkets} />
        )
      )}

      {/* Trade History */}
      <TradeHistoryPanel />
    </div>
  );
}
