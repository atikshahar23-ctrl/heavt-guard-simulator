import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useGetBinanceMulti, getGetBinanceMultiQueryKey,
  useGetAllMarkets, getGetAllMarketsQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  type StockRecommendation, type StockQuote,
} from "@workspace/api-client-react";
import {
  usePortfolio, STARTING_BALANCE,
} from "@/contexts/portfolio-context";
import { useRefresh } from "@/contexts/refresh-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { CandlestickChart } from "@/components/candlestick-chart";
import { OrderBook } from "@/components/order-book";
import { WalletSwitcher } from "@/components/wallet-switcher";
import { WalletProgress } from "@/components/wallet-progress";
import { QuickTradeButton } from "@/components/quick-trade-button";
import {
  TrendingUp, TrendingDown, Wallet, RotateCcw, Search,
  ChartCandlestick, BarChart3, Trophy, History, X, Plus,
  ArrowUpRight, ArrowDownRight, LineChart, Lightbulb, ExternalLink,
  ShieldAlert, Target,
} from "lucide-react";

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10] as const;
type Leverage = typeof LEVERAGE_OPTIONS[number];
const FUTURES_ASSETS = ["BTC", "ETH", "SOL", "BNB"] as const;
type FuturesAsset = typeof FUTURES_ASSETS[number];

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

/* ─── Deposit Dialog ─── */
function DepositDialog({ cash, onClose, onDeposit }: { cash: number; onClose: () => void; onDeposit: (n: number) => void }) {
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { addFunds } = usePortfolio();

  function doDeposit(amount: number) {
    const e = addFunds(amount);
    if (e) { setErr(e); return; }
    setErr(null);
    setCustom("");
    onDeposit(amount);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-[340px] max-w-full rounded-2xl border border-primary/30 bg-card p-5 space-y-4"
        style={{ boxShadow: "0 0 40px hsl(32 84% 55% / 0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-black font-mono uppercase tracking-widest text-primary">
            <Wallet className="h-4 w-4" /> Add Funds
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">Available: {fmtUsd(cash)}</p>
        <div className="grid grid-cols-3 gap-2">
          {[1000, 5000, 10000].map(amt => (
            <button key={amt} onClick={() => doDeposit(amt)}
              className="rounded-lg border border-border bg-secondary/40 hover:border-primary/50 hover:text-primary transition-colors py-2 text-xs font-mono font-bold">
              +${amt.toLocaleString()}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); doDeposit(Number(custom)); }} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
            <input type="number" min="1" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Custom"
              className="w-full h-9 rounded-lg bg-secondary/40 border border-border pl-7 pr-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <button type="submit" className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-mono font-bold hover:opacity-90 transition-opacity">Add</button>
        </form>
        {err && <p className="text-[11px] text-red-400 font-mono">{err}</p>}
      </div>
    </div>
  );
}

/* ─── Compact Stats Bar ─── */
function CompactStats({ unrealizedPnl, totalPositionValue }: { unrealizedPnl: number; totalPositionValue: number }) {
  const { cash, totalDeposited, tradeHistory, polyPositions, binancePositions, stockPositions } = usePortfolio();
  const totalValue = cash + totalPositionValue;
  const totalPnl = totalValue - totalDeposited;
  const realizedPnl = tradeHistory.reduce((s, t) => s + t.pnl, 0);
  const openCount = polyPositions.length + binancePositions.length + stockPositions.length;
  const wins = tradeHistory.filter(t => t.pnl > 0).length;
  const winRate = tradeHistory.length === 0 ? null : (wins / tradeHistory.length) * 100;
  const totalPnlPct = totalDeposited > 0 ? (totalPnl / totalDeposited) * 100 : 0;

  const stats = [
    { label: "Balance", value: fmtUsd(totalValue), sub: `${totalPnlPct >= 0 ? "+" : ""}${fmt(totalPnlPct)}%`, subColor: pnlColor(totalPnl) },
    { label: "Available", value: fmtUsd(cash), sub: "cash" },
    { label: "Unrealized", value: `${unrealizedPnl >= 0 ? "+" : ""}${fmtUsd(unrealizedPnl)}`, sub: `${openCount} open`, color: pnlColor(unrealizedPnl) },
    { label: "Realized", value: `${realizedPnl >= 0 ? "+" : ""}${fmtUsd(realizedPnl)}`, sub: `${tradeHistory.length} closed`, color: pnlColor(realizedPnl) },
    { label: "Win Rate", value: winRate === null ? "—" : `${Math.round(winRate)}%`, sub: `${wins}/${tradeHistory.length}` },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-px bg-border">
      {stats.map(s => (
        <div key={s.label} className="bg-background px-3 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{s.label}</div>
          <div className={`text-sm font-black font-mono ${s.color ?? "text-foreground"}`}>{s.value}</div>
          <div className={`text-[9px] font-mono ${s.subColor ?? "text-muted-foreground"}`}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Futures: Right panel (positions + history) ─── */
function FuturesPositionsPanel({ binancePrices }: { binancePrices: Record<string, number> }) {
  const { binancePositions, closeBinancePosition, tradeHistory } = usePortfolio();
  const binanceTrades = tradeHistory.filter(t => t.type === "BINANCE");

  return (
    <div className="flex flex-col h-full">
      {/* Open Positions */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-card/80 backdrop-blur-sm flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Open Positions</span>
          {binancePositions.length > 0 && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-mono">{binancePositions.length}</span>
          )}
        </div>
        {binancePositions.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-muted-foreground font-mono">No open positions</div>
        ) : (
          <div className="divide-y divide-border">
            {binancePositions.map(pos => {
              const currentPrice = binancePrices[pos.asset] ?? pos.entryPrice;
              const priceDelta = pos.direction === "LONG"
                ? (currentPrice - pos.entryPrice) / pos.entryPrice
                : (pos.entryPrice - currentPrice) / pos.entryPrice;
              const pnl = priceDelta * pos.notional;
              const pnlPct = priceDelta * pos.leverage * 100;
              const margin = pos.notional / pos.leverage;

              return (
                <div key={pos.id} className="px-3 py-2.5 space-y-1.5 hover:bg-secondary/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[11px] font-black font-mono ${pos.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                        {pos.direction}
                      </span>
                      <span className="text-[11px] font-bold font-mono truncate">{pos.asset}USDT</span>
                      <span className="text-[10px] text-primary font-mono">{pos.leverage}x</span>
                    </div>
                    <button
                      onClick={() => closeBinancePosition(pos.id, currentPrice)}
                      className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                      title="Close position"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                    <div><span className="text-muted-foreground">Entry </span>${pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div><span className="text-muted-foreground">Mark </span>${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div><span className="text-muted-foreground">Margin </span>${margin.toFixed(2)}</div>
                    <div className={pnlColor(pnl)}>
                      {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)} ({pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}%)
                    </div>
                  </div>
                  {(pos.slPrice != null || pos.tpPrice != null) && (
                    <div className="flex gap-3 text-[10px] font-mono">
                      {pos.slPrice != null && (
                        <span className="flex items-center gap-0.5 text-red-400/80">
                          <ShieldAlert className="h-2.5 w-2.5" />SL ${pos.slPrice.toLocaleString()}
                        </span>
                      )}
                      {pos.tpPrice != null && (
                        <span className="flex items-center gap-0.5 text-emerald-400/80">
                          <Target className="h-2.5 w-2.5" />TP ${pos.tpPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="border-t border-border shrink-0 flex flex-col" style={{ maxHeight: '200px' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/40 shrink-0">
          <History className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">History</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {binanceTrades.length === 0 ? (
            <div className="px-3 py-3 text-[10px] text-muted-foreground font-mono text-center">No closed trades</div>
          ) : (
            <div className="divide-y divide-border/50">
              {binanceTrades.slice(0, 20).map(t => (
                <div key={t.id} className="px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{t.description}</span>
                  <span className={`text-[10px] font-black font-mono shrink-0 flex items-center gap-0.5 ${pnlColor(t.pnl)}`}>
                    {t.pnl >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {t.pnl >= 0 ? "+" : ""}{fmtUsd(t.pnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Professional Futures Terminal ─── */
function BinanceFuturesTerminal({ binancePrices }: { binancePrices: Record<string, number> }) {
  const { cash, openBinancePosition } = usePortfolio();
  const [selectedAsset, setSelectedAsset] = useState<FuturesAsset>("BTC");
  const [leverage, setLeverage] = useState<Leverage>(1);
  const [amount, setAmount] = useState("");
  const [slInput, setSlInput] = useState("");
  const [tpInput, setTpInput] = useState("");
  const [tradeError, setTradeError] = useState("");

  const currentPrice = binancePrices[selectedAsset] ?? 0;
  const notional = parseFloat(amount) || 0;
  const margin = leverage > 0 ? notional / leverage : notional;
  const slPrice = slInput ? parseFloat(slInput) : undefined;
  const tpPrice = tpInput ? parseFloat(tpInput) : undefined;

  const open = useCallback((direction: "LONG" | "SHORT") => {
    if (!notional || notional <= 0) { setTradeError("Enter notional amount"); return; }
    if (!currentPrice) { setTradeError("Price unavailable"); return; }
    const err = openBinancePosition({
      asset: selectedAsset,
      direction,
      notional,
      entryPrice: currentPrice,
      leverage,
      slPrice: Number.isFinite(slPrice) ? slPrice : undefined,
      tpPrice: Number.isFinite(tpPrice) ? tpPrice : undefined,
    });
    if (err) { setTradeError(err); return; }
    setTradeError("");
    setAmount("");
    setSlInput("");
    setTpInput("");
  }, [notional, currentPrice, leverage, selectedAsset, slPrice, tpPrice, openBinancePosition]);

  const applyRec = useCallback((direction: "LONG" | "SHORT") => {
    if (!currentPrice) { setTradeError("Price unavailable"); return; }
    const { sl, tp } = recommendLevels(currentPrice, direction);
    setSlInput(String(sl));
    setTpInput(String(tp));
    setTradeError("");
  }, [currentPrice]);

  return (
    <div className="flex flex-col h-full">
      {/* Asset selector strip */}
      <div className="flex items-stretch border-b border-border shrink-0 overflow-x-auto">
        {FUTURES_ASSETS.map(asset => {
          const price = binancePrices[asset];
          const isSelected = selectedAsset === asset;
          return (
            <button
              key={asset}
              onClick={() => setSelectedAsset(asset)}
              className={`flex flex-col items-start px-4 py-2 border-b-2 transition-all shrink-0 ${
                isSelected ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary/20"
              }`}
            >
              <span className={`text-[11px] font-black font-mono ${isSelected ? "text-primary" : "text-foreground"}`}>{asset}USDT</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {price ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Three-panel body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: Order Book — desktop only */}
        <div className="hidden xl:flex w-[190px] border-r border-border shrink-0 overflow-hidden">
          <OrderBook price={currentPrice} symbol={selectedAsset} />
        </div>

        {/* CENTER: Chart + Trade Form */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 min-h-0" style={{ minHeight: "220px" }}>
            {currentPrice > 0 ? (
              <CandlestickChart symbol={selectedAsset} />
            ) : (
              <div className="flex h-full items-center justify-center bg-background">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
            )}
          </div>

          {/* Trade Form */}
          <div className="shrink-0 border-t border-border p-3 space-y-2 bg-card/20">
            {/* Direction buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => open("LONG")}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded text-[12px] font-black font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-[0.98] transition-all"
              >
                <TrendingUp className="h-3.5 w-3.5" /> LONG / BUY
              </button>
              <button
                onClick={() => open("SHORT")}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded text-[12px] font-black font-mono bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 active:scale-[0.98] transition-all"
              >
                <TrendingDown className="h-3.5 w-3.5" /> SHORT / SELL
              </button>
            </div>

            {/* Leverage */}
            <div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">Leverage</div>
              <div className="flex gap-1">
                {LEVERAGE_OPTIONS.map(l => (
                  <button
                    key={l}
                    onClick={() => setLeverage(l)}
                    className={`flex-1 py-1 text-[11px] font-mono font-bold rounded transition-all ${
                      leverage === l ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l}x
                  </button>
                ))}
              </div>
            </div>

            {/* One-click recommended SL/TP */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1">
                <Lightbulb className="h-2.5 w-2.5 text-primary" />Auto SL/TP
              </span>
              <button
                type="button"
                onClick={() => applyRec("LONG")}
                disabled={!currentPrice}
                className="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 transition-all"
              >
                For LONG
              </button>
              <button
                type="button"
                onClick={() => applyRec("SHORT")}
                disabled={!currentPrice}
                className="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 transition-all"
              >
                For SHORT
              </button>
              <span className="text-[9px] text-muted-foreground font-mono hidden sm:inline">1.5% risk · 2R</span>
            </div>

            {/* Notional + SL + TP */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">Notional (USDT)</div>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setTradeError(""); }}
                  className="h-8 text-xs font-mono bg-secondary/30"
                />
                {notional > 0 && (
                  <div className="text-[9px] mt-0.5 font-mono">
                    <span className="text-muted-foreground">Margin: </span>
                    <span className={cash >= margin ? "text-emerald-400" : "text-red-400"}>${margin.toFixed(2)}</span>
                    <span className="text-muted-foreground"> · avail ${cash.toFixed(0)}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
                  <ShieldAlert className="h-2.5 w-2.5 text-red-400/70" />Stop Loss
                </div>
                <Input
                  type="number"
                  placeholder="optional price"
                  value={slInput}
                  onChange={e => setSlInput(e.target.value)}
                  className="h-8 text-xs font-mono bg-secondary/30 border-red-500/20 focus:border-red-500/50"
                />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Target className="h-2.5 w-2.5 text-emerald-400/70" />Take Profit
                </div>
                <Input
                  type="number"
                  placeholder="optional price"
                  value={tpInput}
                  onChange={e => setTpInput(e.target.value)}
                  className="h-8 text-xs font-mono bg-secondary/30 border-emerald-500/20 focus:border-emerald-500/50"
                />
              </div>
            </div>
            {tradeError && <div className="text-[10px] text-red-400 font-mono">{tradeError}</div>}
          </div>
        </div>

        {/* RIGHT: Positions + History — large screens only */}
        <div className="hidden lg:flex w-[270px] border-l border-border flex-col shrink-0 overflow-hidden">
          <FuturesPositionsPanel binancePrices={binancePrices} />
        </div>
      </div>

      {/* Mobile: positions below trade form */}
      <div className="lg:hidden border-t border-border overflow-y-auto" style={{ maxHeight: "280px" }}>
        <FuturesPositionsPanel binancePrices={binancePrices} />
      </div>
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
    if (isNaN(amt) || amt <= 0) { setErrors(e => ({ ...e, [key]: "Enter amount" })); return; }
    const entryPrice = side === "YES" ? market.yesPrice : market.noPrice;
    const err = openPolyPosition({ conditionId: market.conditionId, question: market.question, category: market.assetTag, slug: market.slug, side, entryPrice }, amt);
    if (err) { setErrors(e => ({ ...e, [key]: err })); }
    else { setAmounts(a => ({ ...a, [key]: "" })); setErrors(e => ({ ...e, [key]: "" })); }
  }

  return (
    <div className="space-y-4">
      {polyPositions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Open Prediction Positions</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {polyPositions.map(pos => {
            const live = allMarkets.find(m => m.conditionId === pos.conditionId);
            const currentPrice = live ? (pos.side === "YES" ? live.yesPrice : live.noPrice) : pos.entryPrice;
            const value = pos.shares * currentPrice;
            const pnl = value - pos.cost;
            const pnlPct = (pnl / pos.cost) * 100;
            return (
              <div key={pos.id} className={`rounded-lg border p-4 flex items-start justify-between gap-4 ${pnlBg(pnl)}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-black font-mono ${pos.side === "YES" ? "text-emerald-400" : "text-amber-400"}`}>{pos.side}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{pos.category}</span>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">{pos.question}</p>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    {fmt(pos.shares, 2)} shares · Entry ${pos.entryPrice.toFixed(3)} → Now ${currentPrice.toFixed(3)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-black font-mono ${pnlColor(pnl)}`}>{pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}</div>
                  <div className={`text-[10px] font-mono ${pnlColor(pnl)}`}>{pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}%</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Value: {fmtUsd(value)}</div>
                </div>
                <button onClick={() => closePolyPosition(pos.id, currentPrice)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search prediction markets..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/30" />
      </div>
      <div className="space-y-2">
        {filtered.map(m => {
          const yesKey = `${m.conditionId}-YES`;
          const noKey = `${m.conditionId}-NO`;
          return (
            <div key={m.conditionId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px] font-mono py-0">{m.assetTag}</Badge>
                    <span className="text-[10px] text-primary font-mono font-bold">{(m.yesPrice * 100).toFixed(0)}% YES</span>
                  </div>
                  <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">{m.question}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-end gap-2 flex-shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <Input type="number" placeholder="$" value={amounts[yesKey] ?? ""} onChange={e => setAmounts(a => ({ ...a, [yesKey]: e.target.value }))}
                        className="w-20 h-7 text-xs font-mono text-right bg-secondary/30 pr-1.5" />
                      <button onClick={() => bet(m, "YES")}
                        className="h-7 px-2.5 rounded text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all whitespace-nowrap">
                        YES <span className="opacity-70">${m.yesPrice.toFixed(2)}</span>
                      </button>
                    </div>
                    {errors[yesKey] && <span className="text-[9px] text-red-400 font-mono">{errors[yesKey]}</span>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <Input type="number" placeholder="$" value={amounts[noKey] ?? ""} onChange={e => setAmounts(a => ({ ...a, [noKey]: e.target.value }))}
                        className="w-20 h-7 text-xs font-mono text-right bg-secondary/30 pr-1.5" />
                      <button onClick={() => bet(m, "NO")}
                        className="h-7 px-2.5 rounded text-[11px] font-bold font-mono bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-all whitespace-nowrap">
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
        {filtered.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No markets found.</div>}
      </div>
    </div>
  );
}

/* ─── Stock Recommendations Strip ─── */
function StockRecommendationsStrip({ recs, onPick }: { recs: StockRecommendation[]; onPick: (symbol: string) => void }) {
  const top = recs.filter(r => r.action !== "HOLD").slice(0, 6);
  if (top.length === 0) return null;
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Recommended Stock Trades</span>
        <span className="text-[10px] text-muted-foreground font-mono">live momentum signals</span>
        <div className="flex-1 h-px bg-primary/20" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {top.map(rec => {
          const isBuy = rec.action === "BUY";
          return (
            <button key={rec.symbol} onClick={() => onPick(rec.symbol)}
              className="text-left rounded-md border border-border bg-card/60 hover:bg-card transition-colors p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black font-mono text-foreground">{rec.symbol}</span>
                <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{rec.action}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{rec.rationale}</p>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">${rec.price.toFixed(2)}</span>
                <span className={rec.momentum5dPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {rec.momentum5dPercent >= 0 ? '+' : ''}{rec.momentum5dPercent.toFixed(1)}% 5d
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Stocks Tab ─── */
function StocksTab({ stocks, stockPrices }: { stocks: StockQuote[]; stockPrices: Record<string, number> }) {
  const { stockPositions, cash, openStockPosition, closeStockPosition } = usePortfolio();
  const { intervalFor } = useRefresh();
  const { data: stockRecs } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: intervalFor(30000, 30000) },
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"ALL" | StockQuote["category"]>("ALL");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [leverages, setLeverages] = useState<Record<string, Leverage>>({});
  const [slInputs, setSlInputs] = useState<Record<string, string>>({});
  const [tpInputs, setTpInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const CATEGORIES: ("ALL" | StockQuote["category"])[] = ["ALL", "TECH", "ENERGY", "RESOURCES", "LARGE_CAP", "INDEX"];
  const CAT_LABEL: Record<string, string> = { ALL: "All", TECH: "Tech", ENERGY: "Energy", RESOURCES: "Resources", LARGE_CAP: "Large Cap", INDEX: "Index/ETF" };

  const filtered = useMemo(() =>
    stocks
      .filter(s => category === "ALL" || s.category === category)
      .filter(s => !search || s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 60),
    [stocks, category, search]
  );

  function buy(stock: StockQuote, direction: "LONG" | "SHORT" = "LONG") {
    const raw = amounts[stock.symbol] ?? "";
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) { setErrors(e => ({ ...e, [stock.symbol]: "Enter a valid amount" })); return; }
    const price = stockPrices[stock.symbol] ?? stock.price;
    if (!price) { setErrors(e => ({ ...e, [stock.symbol]: "Price unavailable" })); return; }
    const leverage = leverages[stock.symbol] ?? 1;
    const slRaw = parseFloat(slInputs[stock.symbol] ?? "");
    const tpRaw = parseFloat(tpInputs[stock.symbol] ?? "");
    const err = openStockPosition({
      symbol: stock.symbol,
      name: stock.name,
      direction,
      entryPrice: price,
      slPrice: Number.isFinite(slRaw) ? slRaw : undefined,
      tpPrice: Number.isFinite(tpRaw) ? tpRaw : undefined,
    }, amt, leverage);
    if (err) { setErrors(e => ({ ...e, [stock.symbol]: err })); }
    else {
      setAmounts(a => ({ ...a, [stock.symbol]: "" }));
      setSlInputs(s => ({ ...s, [stock.symbol]: "" }));
      setTpInputs(t => ({ ...t, [stock.symbol]: "" }));
      setErrors(e => ({ ...e, [stock.symbol]: "" }));
    }
  }

  function applyRecStock(stock: StockQuote) {
    const price = stockPrices[stock.symbol] ?? stock.price;
    if (!price) { setErrors(e => ({ ...e, [stock.symbol]: "Price unavailable" })); return; }
    const rec = (stockRecs ?? []).find(r => r.symbol === stock.symbol);
    const dir = rec?.action === "SELL" ? "SHORT" : "LONG";
    const { sl, tp } = recommendLevels(price, dir, { slPct: 0.03, tpPct: 0.06 });
    setSlInputs(s => ({ ...s, [stock.symbol]: String(sl) }));
    setTpInputs(t => ({ ...t, [stock.symbol]: String(tp) }));
    setErrors(e => ({ ...e, [stock.symbol]: "" }));
  }

  return (
    <div className="space-y-4">
      <StockRecommendationsStrip recs={stockRecs ?? []} onPick={symbol => { setCategory("ALL"); setSearch(symbol); }} />

      {stockPositions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Open Stock Positions</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {stockPositions.map(pos => {
            const currentPrice = stockPrices[pos.symbol] ?? pos.entryPrice;
            const pnl = pos.shares * (pos.direction === "SHORT" ? pos.entryPrice - currentPrice : currentPrice - pos.entryPrice);
            const equity = Math.max(0, pos.cost + pnl);
            const pnlPct = pos.cost > 0 ? (pnl / pos.cost) * 100 : 0;
            return (
              <div key={pos.id} className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${pnlBg(pnl)}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`text-xs font-black font-mono ${(pos.direction ?? "LONG") === "SHORT" ? "text-red-400" : "text-emerald-400"}`}>{pos.direction ?? "LONG"}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold font-mono truncate">
                      {pos.symbol} {pos.leverage > 1 && <span className="text-primary font-normal">{pos.leverage}x</span>} <span className="text-muted-foreground font-normal">{fmt(pos.shares, 4)} sh</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Entry ${pos.entryPrice.toFixed(2)} → Now ${currentPrice.toFixed(2)} · Margin {fmtUsd(pos.cost)}
                    </div>
                    {(pos.slPrice != null || pos.tpPrice != null) && (
                      <div className="flex items-center gap-2 mt-1">
                        {pos.slPrice != null && (
                          <span className="flex items-center gap-0.5 text-[9px] font-mono text-red-400/80">
                            <ShieldAlert className="h-2.5 w-2.5" />SL ${pos.slPrice.toLocaleString()}
                          </span>
                        )}
                        {pos.tpPrice != null && (
                          <span className="flex items-center gap-0.5 text-[9px] font-mono text-emerald-400/80">
                            <Target className="h-2.5 w-2.5" />TP ${pos.tpPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-black font-mono ${pnlColor(pnl)}`}>{pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}</div>
                  <div className={`text-[10px] font-mono ${pnlColor(pnl)}`}>{pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}% · Equity {fmtUsd(equity)}</div>
                </div>
                <button onClick={() => closeStockPosition(pos.id, currentPrice)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search stocks by symbol or name..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/30" />
        </div>
        <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-mono overflow-x-auto">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-2.5 py-1.5 transition-colors whitespace-nowrap ${category === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}>
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(stock => {
          const price = stockPrices[stock.symbol] ?? stock.price;
          const up = stock.changePercent >= 0;
          const amt = parseFloat(amounts[stock.symbol] ?? "0") || 0;
          const lev = leverages[stock.symbol] ?? 1;
          const tvUrl = `https://www.tradingview.com/symbols/${stock.tradingViewSymbol}/`;
          return (
            <div key={stock.symbol} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-black font-mono text-foreground">{stock.symbol}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{stock.name}</div>
                </div>
                <a href={tvUrl} target="_blank" rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-xl font-black font-mono">${price.toFixed(2)}</div>
                <div className={`text-xs font-bold font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {up ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Leverage</span>
                <div className="flex gap-1">
                  {LEVERAGE_OPTIONS.map(l => (
                    <button key={l} onClick={() => setLeverages(lv => ({ ...lv, [stock.symbol]: l }))}
                      className={`flex-1 py-1 text-[11px] font-mono font-bold rounded transition-all ${lev === l ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                      {l}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Margin (USD)</span>
                <Input type="number" placeholder="e.g. 500" value={amounts[stock.symbol] ?? ""}
                  onChange={e => setAmounts(a => ({ ...a, [stock.symbol]: e.target.value }))}
                  className="h-8 text-xs font-mono bg-secondary/30" />
                {amt > 0 && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {price > 0 ? `${fmt((amt * lev) / price, 4)} sh${lev > 1 ? ` · ${fmtUsd(amt * lev)} exposure` : ''}` : ''} · {cash < amt ? <span className="text-red-400">Insufficient</span> : <span className="text-emerald-400">OK</span>}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Stop / Target</span>
                  <button onClick={() => applyRecStock(stock)}
                    className="flex items-center gap-1 text-[9px] font-mono font-bold text-primary hover:text-primary/80 transition-colors">
                    <Lightbulb className="h-2.5 w-2.5" /> Auto SL/TP
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input type="number" placeholder="SL price" value={slInputs[stock.symbol] ?? ""}
                    onChange={e => setSlInputs(s => ({ ...s, [stock.symbol]: e.target.value }))}
                    className="h-8 text-xs font-mono bg-secondary/30 border-red-500/20 focus:border-red-500/50" />
                  <Input type="number" placeholder="TP price" value={tpInputs[stock.symbol] ?? ""}
                    onChange={e => setTpInputs(t => ({ ...t, [stock.symbol]: e.target.value }))}
                    className="h-8 text-xs font-mono bg-secondary/30 border-emerald-500/20 focus:border-emerald-500/50" />
                </div>
              </div>
              {errors[stock.symbol] && <div className="text-[10px] text-red-400 font-mono">{errors[stock.symbol]}</div>}
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => buy(stock, "LONG")}
                  className="flex items-center justify-center gap-1 py-2 rounded text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all">
                  <TrendingUp className="h-3 w-3" /> קנייה
                </button>
                <button onClick={() => buy(stock, "SHORT")}
                  className="flex items-center justify-center gap-1 py-2 rounded text-[11px] font-bold font-mono bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-all">
                  <TrendingDown className="h-3 w-3" /> שורט / מכירה
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground text-sm">No stocks found.</div>}
      </div>
    </div>
  );
}

/* ─── Trade History (for Stocks/Poly tabs) ─── */
function TradeHistoryPanel() {
  const { tradeHistory } = usePortfolio();
  const nonBinance = tradeHistory.filter(t => t.type !== "BINANCE");
  if (nonBinance.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">Trade History</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="space-y-1.5">
        {nonBinance.slice(0, 10).map(t => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-border/50 bg-card/30 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className="text-[9px] font-mono flex-shrink-0">
                {t.type === "STOCK" ? "STK" : "PRED"}
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
  const [tab, setTab] = useState<"futures" | "prediction" | "stocks">("futures");
  const [showDeposit, setShowDeposit] = useState(false);
  const { polyPositions, binancePositions, stockPositions, cash, resetPortfolio, checkSlTp } = usePortfolio();
  const { intervalFor } = useRefresh();

  const { data: binanceData, isLoading: binanceLoading } = useGetBinanceMulti({
    query: { queryKey: getGetBinanceMultiQueryKey(), refetchInterval: intervalFor(5000) }
  });
  const { data: allMarketsData, isLoading: marketsLoading } = useGetAllMarkets(
    {},
    { query: { queryKey: getGetAllMarketsQueryKey({}), refetchInterval: intervalFor(30000, 30000) } }
  );
  const { data: stocksData, isLoading: stocksLoading } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: intervalFor(30000, 30000) }
  });

  const binancePrices = useMemo(() => {
    const map: Record<string, number> = {};
    (binanceData ?? []).forEach(b => { map[b.asset] = b.markPrice; });
    return map;
  }, [binanceData]);

  const stocks = useMemo(() => stocksData ?? [], [stocksData]);
  const stockPrices = useMemo(() => {
    const map: Record<string, number> = {};
    stocks.forEach(s => { map[s.symbol] = s.price; });
    return map;
  }, [stocks]);

  const allMarkets = useMemo(() =>
    (allMarketsData ?? []).map(m => ({
      conditionId: m.conditionId,
      question: m.question,
      yesPrice: m.yesPrice,
      noPrice: m.noPrice,
      assetTag: m.assetTag,
      slug: m.eventSlug ?? null,
    })),
    [allMarketsData]
  );

  useEffect(() => {
    if (Object.keys(binancePrices).length > 0) checkSlTp(binancePrices);
  }, [binancePrices, checkSlTp]);

  useEffect(() => {
    if (Object.keys(stockPrices).length > 0) checkSlTp(stockPrices);
  }, [stockPrices, checkSlTp]);

  const unrealizedPnl = useMemo(() => {
    const binancePnl = binancePositions.reduce((sum, pos) => {
      const p = binancePrices[pos.asset] ?? pos.entryPrice;
      const delta = pos.direction === "LONG" ? (p - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - p) / pos.entryPrice;
      return sum + delta * pos.notional;
    }, 0);
    const polyPnl = polyPositions.reduce((sum, pos) => {
      const live = allMarkets.find(m => m.conditionId === pos.conditionId);
      const p = live ? (pos.side === "YES" ? live.yesPrice : live.noPrice) : pos.entryPrice;
      return sum + pos.shares * p - pos.cost;
    }, 0);
    const stockPnl = stockPositions.reduce((sum, pos) => {
      const p = stockPrices[pos.symbol] ?? pos.entryPrice;
      return sum + pos.shares * (pos.direction === "SHORT" ? pos.entryPrice - p : p - pos.entryPrice);
    }, 0);
    return binancePnl + polyPnl + stockPnl;
  }, [binancePositions, polyPositions, stockPositions, binancePrices, stockPrices, allMarkets]);

  const totalPositionValue = useMemo(() => {
    const bMargin = binancePositions.reduce((s, p) => s + p.notional / p.leverage, 0);
    const bPnl = binancePositions.reduce((s, p) => {
      const price = binancePrices[p.asset] ?? p.entryPrice;
      const delta = p.direction === "LONG" ? (price - p.entryPrice) / p.entryPrice : (p.entryPrice - price) / p.entryPrice;
      return s + delta * p.notional;
    }, 0);
    const polyVal = polyPositions.reduce((s, p) => {
      const live = allMarkets.find(m => m.conditionId === p.conditionId);
      const price = live ? (p.side === "YES" ? live.yesPrice : live.noPrice) : p.entryPrice;
      return s + p.shares * price;
    }, 0);
    const stockVal = stockPositions.reduce((s, p) => {
      const price = stockPrices[p.symbol] ?? p.entryPrice;
      return s + Math.max(0, p.cost + p.shares * (p.direction === "SHORT" ? p.entryPrice - price : price - p.entryPrice));
    }, 0);
    return bMargin + bPnl + polyVal + stockVal;
  }, [binancePositions, polyPositions, stockPositions, binancePrices, stockPrices, allMarkets]);

  const tabCls = (t: typeof tab) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
      tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Compact header */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 md:px-6 pt-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-lg font-black tracking-tight whitespace-nowrap">Paper Trading Simulator</h1>
          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 shrink-0">VIRTUAL</span>
        </div>
        <div className="flex items-center gap-3 ml-auto text-[11px] font-mono">
          <WalletSwitcher />
          <div className="flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Cash:</span>
            <span className="text-primary font-bold">{fmtUsd(cash)}</span>
          </div>
          <div className={`hidden sm:flex items-center gap-1 ${pnlColor(unrealizedPnl)}`}>
            <span className="text-muted-foreground">PnL:</span>
            <span className="font-bold">{unrealizedPnl >= 0 ? "+" : ""}{fmtUsd(unrealizedPnl)}</span>
          </div>
          <button onClick={() => setShowDeposit(true)}
            className="flex items-center gap-1 text-[10px] font-mono font-bold text-primary-foreground bg-primary hover:opacity-90 transition-opacity rounded px-2.5 py-1">
            <Plus className="h-3 w-3" /> Deposit
          </button>
          <button onClick={() => { if (confirm("Reset all positions and balance to $" + STARTING_BALANCE.toLocaleString() + "?")) resetPortfolio(); }}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors border border-border rounded px-2 py-1"
            title="Reset portfolio">
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Compact stats */}
      <CompactStats unrealizedPnl={unrealizedPnl} totalPositionValue={totalPositionValue} />

      {/* Tab bar */}
      <div className="flex items-center px-4 md:px-6 border-b border-border shrink-0 overflow-x-auto">
        <button onClick={() => setTab("futures")} className={tabCls("futures")}>
          <ChartCandlestick className="h-4 w-4" />
          <span className="hidden sm:inline">Binance Futures</span><span className="sm:hidden">Futures</span>
          {binancePositions.length > 0 && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">{binancePositions.length}</span>}
        </button>
        <button onClick={() => setTab("stocks")} className={tabCls("stocks")}>
          <LineChart className="h-4 w-4" /> Stocks
          {stockPositions.length > 0 && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">{stockPositions.length}</span>}
        </button>
        <button onClick={() => setTab("prediction")} className={tabCls("prediction")}>
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Prediction Markets</span><span className="sm:hidden">Pred.</span>
          {polyPositions.length > 0 && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">{polyPositions.length}</span>}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {tab === "futures" && (
          binanceLoading ? (
            <div className="p-6 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : (
            <BinanceFuturesTerminal binancePrices={binancePrices} />
          )
        )}
        {tab === "stocks" && (
          <div className="h-full overflow-y-auto px-4 md:px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
              <WalletProgress />
              <div className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4 flex flex-col justify-center">
                <QuickTradeButton />
              </div>
            </div>
            {stocksLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : (
              <StocksTab stocks={stocks} stockPrices={stockPrices} />
            )}
            <TradeHistoryPanel />
          </div>
        )}
        {tab === "prediction" && (
          <div className="h-full overflow-y-auto px-4 md:px-6 py-4 space-y-4">
            {marketsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <PolymarketTab allMarkets={allMarkets} />
            )}
          </div>
        )}
      </div>

      {showDeposit && (
        <DepositDialog
          cash={cash}
          onClose={() => setShowDeposit(false)}
          onDeposit={() => setShowDeposit(false)}
        />
      )}
    </div>
  );
}
