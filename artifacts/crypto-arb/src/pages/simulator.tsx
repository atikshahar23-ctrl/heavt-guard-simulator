import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useGetBinanceMulti, getGetBinanceMultiQueryKey,
  useGetAllMarkets, getGetAllMarketsQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  type StockRecommendation, type StockQuote,
} from "@workspace/api-client-react";
import {
  usePortfolio, STARTING_BALANCE,
  type OptionPosition,
} from "@/contexts/portfolio-context";
import { optionPositionValue, yearsToExpiry } from "@/lib/options-model";
import { useRefresh } from "@/contexts/refresh-context";
import { useLivePrices } from "@/contexts/live-price-context";
import { useAutoTrader } from "@/contexts/autotrader-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { BotStatsPopover } from "@/components/bot-stats-popover";
import { CandlestickChart } from "@/components/candlestick-chart";
import { OrderBook } from "@/components/order-book";
import { WalletSwitcher } from "@/components/wallet-switcher";
import { WalletProgress } from "@/components/wallet-progress";
import { QuickTradeButton } from "@/components/quick-trade-button";
import {
  TrendingUp, TrendingDown, Wallet, RotateCcw, Search,
  ChartCandlestick, BarChart3, Trophy, History, X, Plus,
  ArrowUpRight, ArrowDownRight, LineChart, Lightbulb, ExternalLink,
  ShieldAlert, Target, Clock, Bot, Sparkles, PlayCircle,
} from "lucide-react";

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10] as const;
type Leverage = typeof LEVERAGE_OPTIONS[number];
const FUTURES_ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT", "LTC", "TRX"] as const;
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
        style={{ boxShadow: "0 0 40px hsl(207 30% 70% / 0.18)" }}
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

/* ─── Active wallet age (live, Hebrew) ─── */
function WalletAge() {
  const { activeWalletCreatedAt } = usePortfolio();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const created = new Date(activeWalletCreatedAt).getTime();
  const ms = Number.isFinite(created) ? Math.max(0, now - created) : 0;
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const label =
    days > 0
      ? `${days} ${days === 1 ? "יום" : "ימים"} ו-${hours} ${hours === 1 ? "שעה" : "שעות"}`
      : `${hours} ${hours === 1 ? "שעה" : "שעות"}`;

  return (
    <div className="flex items-center gap-1" dir="rtl" title="גיל הארנק הפעיל">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">גיל הארנק:</span>
      <span className="text-foreground font-bold tabular-nums">{label}</span>
    </div>
  );
}

/* ─── Compact Stats Bar ─── */
function CompactStats({ unrealizedPnl, totalPositionValue }: { unrealizedPnl: number; totalPositionValue: number }) {
  const { cash, totalDeposited, tradeHistory, polyPositions, binancePositions, stockPositions, optionPositions } = usePortfolio();
  const totalValue = cash + totalPositionValue;
  const totalPnl = totalValue - totalDeposited;
  const realizedPnl = tradeHistory.reduce((s, t) => s + t.pnl, 0);
  const openCount = polyPositions.length + binancePositions.length + stockPositions.length + optionPositions.length;
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
type PosFilter = "ALL" | "BOT" | "MANUAL";

function PosFilterToggle({ value, onChange, counts }: { value: PosFilter; onChange: (v: PosFilter) => void; counts?: { ALL: number; BOT: number; MANUAL: number } }) {
  const labels: Record<PosFilter, string> = { ALL: "All", BOT: "Bot", MANUAL: "Manual" };
  return (
    <div className="flex items-center rounded border border-border overflow-hidden text-[9px] font-mono font-bold">
      {(["ALL", "BOT", "MANUAL"] as const).map(f => {
        const cnt = counts?.[f];
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 transition-colors ${value === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {labels[f]}
            {cnt != null && cnt > 0 && (
              <span className={`ml-0.5 rounded-full px-1 leading-[1.4] text-[8px] ${value === f ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"}`}>
                {cnt}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FuturesPositionsPanel({ binancePrices, posFilter, setPosFilter, onSelectAsset }: { binancePrices: Record<string, number>; posFilter: PosFilter; setPosFilter: (v: PosFilter) => void; onSelectAsset?: (asset: string) => void }) {
  const { binancePositions, closeBinancePosition, tradeHistory } = usePortfolio();
  const [histFilter, setHistFilter] = useState<PosFilter>("ALL");
  const [, navigate] = useLocation();
  const binanceTrades = tradeHistory.filter(t => t.type === "BINANCE");
  const autoBinancePositions = binancePositions.filter(p => p.auto);

  function closeAllBotBinance() {
    if (!confirm(`Close all ${autoBinancePositions.length} bot-placed futures position${autoBinancePositions.length !== 1 ? "s" : ""}?`)) return;
    autoBinancePositions.forEach(pos => {
      const price = binancePrices[pos.asset] ?? pos.entryPrice;
      closeBinancePosition(pos.id, price, "MANUAL");
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Open Positions */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-card/80 backdrop-blur-sm flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Open Positions</span>
          <div className="flex items-center gap-2">
            <PosFilterToggle value={posFilter} onChange={setPosFilter} counts={{ ALL: binancePositions.length, BOT: autoBinancePositions.length, MANUAL: binancePositions.length - autoBinancePositions.length }} />
            {autoBinancePositions.length > 0 && (
              <button
                onClick={closeAllBotBinance}
                className="flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
                title="Close all bot-placed positions"
              >
                <Bot className="h-2.5 w-2.5" /> Close All Bot
              </button>
            )}
            {binancePositions.length > 0 && (
              <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-mono">{binancePositions.length}</span>
            )}
          </div>
        </div>
        {(() => {
          const visible = binancePositions.filter(p =>
            posFilter === "ALL" ? true : posFilter === "BOT" ? !!p.auto : !p.auto
          );
          return visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-muted-foreground font-mono">
            {binancePositions.length === 0 ? "No open positions" : "No positions match filter"}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map(pos => {
              const currentPrice = binancePrices[pos.asset] ?? pos.entryPrice;
              const priceDelta = pos.direction === "LONG"
                ? (currentPrice - pos.entryPrice) / pos.entryPrice
                : (pos.entryPrice - currentPrice) / pos.entryPrice;
              const pnl = priceDelta * pos.notional;
              const pnlPct = priceDelta * pos.leverage * 100;
              const margin = pos.notional / pos.leverage;

              return (
                <div
                  key={pos.id}
                  className="px-3 py-2.5 space-y-1.5 hover:bg-secondary/20 transition-colors cursor-pointer"
                  onClick={() => onSelectAsset?.(pos.asset)}
                  title={`צפה בגרף ${pos.asset}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[11px] font-black font-mono ${pos.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                        {pos.direction}
                      </span>
                      <span className="text-[11px] font-bold font-mono truncate">{pos.asset}USDT</span>
                      <span className="text-[10px] text-primary font-mono">{pos.leverage}x</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeBinancePosition(pos.id, currentPrice); }}
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
        );
        })()}
      </div>

      {/* Trade History */}
      <div className="border-t border-border shrink-0 flex flex-col" style={{ maxHeight: '200px' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/40 shrink-0">
          <History className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">History</span>
          <div className="flex-1" />
          <PosFilterToggle
            value={histFilter}
            onChange={setHistFilter}
            counts={{ ALL: binanceTrades.length, BOT: binanceTrades.filter(t => t.auto).length, MANUAL: binanceTrades.filter(t => !t.auto).length }}
          />
        </div>
        {binanceTrades.length > 0 && (() => {
          const botPnl = binanceTrades.filter(t => t.auto).reduce((s, t) => s + t.pnl, 0);
          const manualPnl = binanceTrades.filter(t => !t.auto).reduce((s, t) => s + t.pnl, 0);
          return (
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/50 bg-secondary/10 shrink-0 flex-wrap">
              <div className="flex items-center gap-1 text-[9px] font-mono">
                <Bot className="h-2.5 w-2.5 text-amber-400" />
                <span className="text-muted-foreground">Bot:</span>
                <span className={`font-black ${pnlColor(botPnl)}`}>{botPnl >= 0 ? "+" : ""}{fmtUsd(botPnl)}</span>
              </div>
              <div className="h-3 w-px bg-border/60" />
              <div className="flex items-center gap-1 text-[9px] font-mono">
                <span className="text-muted-foreground">Manual:</span>
                <span className={`font-black ${pnlColor(manualPnl)}`}>{manualPnl >= 0 ? "+" : ""}{fmtUsd(manualPnl)}</span>
              </div>
            </div>
          );
        })()}
        <div className="overflow-y-auto flex-1">
          {binanceTrades.length === 0 ? (
            <div className="px-3 py-3 text-[10px] text-muted-foreground font-mono text-center">No closed trades</div>
          ) : (
            <div className="divide-y divide-border/50">
              {binanceTrades.filter(t => histFilter === "ALL" ? true : histFilter === "BOT" ? !!t.auto : !t.auto).slice(0, 20).map(t => (
                <div key={t.id} className="px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{t.description}</span>
                  {t.source ? (
                    <BotStatsPopover
                      source={t.source}
                      type={t.type}
                      label={t.source}
                      className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/25 shrink-0 max-w-[72px] truncate hover:bg-amber-400/30 transition-colors cursor-pointer"
                    />
                  ) : t.auto ? null : (
                    <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border/40 shrink-0">
                      Manual
                    </span>
                  )}
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
function BinanceFuturesTerminal({ binancePrices, initialAsset, posFilter, setPosFilter }: { binancePrices: Record<string, number>; initialAsset?: string; posFilter: PosFilter; setPosFilter: (v: PosFilter) => void }) {
  const { cash, openBinancePosition, binancePositions, closeBinancePosition } = usePortfolio();
  // Allow ANY asset (e.g. deep-linked from trade history), not just the strip's presets.
  const [selectedAsset, setSelectedAsset] = useState<string>(initialAsset ? initialAsset.toUpperCase() : "BTC");
  const [leverage, setLeverage] = useState<Leverage>(1);
  const [amount, setAmount] = useState("");
  const [slInput, setSlInput] = useState("");
  const [tpInput, setTpInput] = useState("");
  const [tradeError, setTradeError] = useState("");
  // Mobile: user-adjustable chart height so the chart is always visible on small screens.
  const [chartHeight, setChartHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem("sim.chartHeight"));
    return saved >= 200 && saved <= 640 ? saved : 340;
  });
  useEffect(() => {
    localStorage.setItem("sim.chartHeight", String(chartHeight));
  }, [chartHeight]);

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
      {/* Asset selector strip — prepend a deep-linked asset that isn't a preset */}
      <div className="flex items-stretch border-b border-border shrink-0 overflow-x-auto">
        {((FUTURES_ASSETS as readonly string[]).includes(selectedAsset)
          ? [...FUTURES_ASSETS]
          : [selectedAsset, ...FUTURES_ASSETS]
        ).map(asset => {
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
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto lg:overflow-hidden">
          {/* Mobile: chart-height resizer so the chart is always visible */}
          <div className="lg:hidden flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/30 shrink-0">
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">גובה גרף</span>
            <input
              type="range"
              min={200}
              max={640}
              step={20}
              value={chartHeight}
              onChange={e => setChartHeight(Number(e.target.value))}
              aria-label="Chart height"
              className="flex-1 h-1.5 accent-primary cursor-pointer"
            />
            <span className="text-[9px] font-mono text-muted-foreground w-10 text-right">{chartHeight}px</span>
          </div>
          {/* Chart — fixed (slider-controlled) height on mobile, fills available space on desktop */}
          <div
            className="min-h-0 h-[var(--chart-h)] shrink-0 lg:h-auto lg:flex-1 lg:shrink"
            style={{ ["--chart-h" as string]: `${chartHeight}px` }}
          >
            <CandlestickChart
              symbol={selectedAsset}
              positions={binancePositions.filter(p => p.asset === selectedAsset)}
              currentPrice={currentPrice}
              onClosePosition={(id, price) => closeBinancePosition(id, price)}
            />
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
          <FuturesPositionsPanel binancePrices={binancePrices} posFilter={posFilter} setPosFilter={setPosFilter} onSelectAsset={setSelectedAsset} />
        </div>
      </div>

      {/* Mobile: positions below trade form */}
      <div className="lg:hidden border-t border-border overflow-y-auto" style={{ maxHeight: "280px" }}>
        <FuturesPositionsPanel binancePrices={binancePrices} posFilter={posFilter} setPosFilter={setPosFilter} onSelectAsset={setSelectedAsset} />
      </div>
    </div>
  );
}

/* ─── Polymarket Tab ─── */
function PolymarketTab({ allMarkets, posFilter, setPosFilter }: { allMarkets: { conditionId: string; question: string; yesPrice: number; noPrice: number; assetTag: string; slug: string | null }[]; posFilter: PosFilter; setPosFilter: (v: PosFilter) => void }) {
  const { polyPositions, cash, openPolyPosition, closePolyPosition } = usePortfolio();
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const autoPolyPositions = polyPositions.filter(p => p.auto);

  function closeAllBotPoly() {
    if (!confirm(`Close all ${autoPolyPositions.length} bot-placed prediction position${autoPolyPositions.length !== 1 ? "s" : ""}?`)) return;
    autoPolyPositions.forEach(pos => {
      const live = allMarkets.find(m => m.conditionId === pos.conditionId);
      const price = live ? (pos.side === "YES" ? live.yesPrice : live.noPrice) : pos.entryPrice;
      closePolyPosition(pos.id, price);
    });
  }

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
          <div className="flex items-center gap-2 flex-wrap">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Open Prediction Positions</span>
            <div className="flex-1 h-px bg-border" />
            <PosFilterToggle value={posFilter} onChange={setPosFilter} counts={{ ALL: polyPositions.length, BOT: autoPolyPositions.length, MANUAL: polyPositions.length - autoPolyPositions.length }} />
            {autoPolyPositions.length > 0 && (
              <button
                onClick={closeAllBotPoly}
                className="flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all flex-shrink-0"
                title="Close all bot-placed prediction positions"
              >
                <Bot className="h-2.5 w-2.5" /> Close All Bot ({autoPolyPositions.length})
              </button>
            )}
          </div>
          {(() => {
            const visiblePoly = polyPositions.filter(p =>
              posFilter === "ALL" ? true : posFilter === "BOT" ? !!p.auto : !p.auto
            );
            return visiblePoly.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-muted-foreground font-mono">No positions match filter</div>
            ) : visiblePoly.map(pos => {
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
                    {pos.auto && (
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-0.5">
                        <Bot className="h-2.5 w-2.5" /> {pos.source ?? "AUTO"}
                      </span>
                    )}
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
          });
          })()}
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
function StocksTab({ stocks, stockPrices, posFilter, setPosFilter }: { stocks: StockQuote[]; stockPrices: Record<string, number>; posFilter: PosFilter; setPosFilter: (v: PosFilter) => void }) {
  const { stockPositions, cash, openStockPosition, closeStockPosition } = usePortfolio();
  const autoStockPositions = stockPositions.filter(p => p.auto);

  function closeAllBotStocks() {
    if (!confirm(`Close all ${autoStockPositions.length} bot-placed stock position${autoStockPositions.length !== 1 ? "s" : ""}?`)) return;
    autoStockPositions.forEach(pos => {
      const price = stockPrices[pos.symbol] ?? pos.entryPrice;
      closeStockPosition(pos.id, price);
    });
  }
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
          <div className="flex items-center gap-2 flex-wrap">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Open Stock Positions</span>
            <div className="flex-1 h-px bg-border" />
            <PosFilterToggle value={posFilter} onChange={setPosFilter} counts={{ ALL: stockPositions.length, BOT: autoStockPositions.length, MANUAL: stockPositions.length - autoStockPositions.length }} />
            {autoStockPositions.length > 0 && (
              <button
                onClick={closeAllBotStocks}
                className="flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all flex-shrink-0"
                title="Close all bot-placed stock positions"
              >
                <Bot className="h-2.5 w-2.5" /> Close All Bot ({autoStockPositions.length})
              </button>
            )}
          </div>
          {(() => {
            const visibleStocks = stockPositions.filter(p =>
              posFilter === "ALL" ? true : posFilter === "BOT" ? !!p.auto : !p.auto
            );
            return visibleStocks.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-muted-foreground font-mono">No positions match filter</div>
            ) : visibleStocks.map(pos => {
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
          });
          })()}
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
  const [histFilter, setHistFilter] = useState<PosFilter>("ALL");
  const [, navigate] = useLocation();
  const nonBinance = tradeHistory.filter(t => t.type !== "BINANCE");
  if (nonBinance.length === 0) return null;
  const botPnl = nonBinance.filter(t => t.auto).reduce((s, t) => s + t.pnl, 0);
  const manualPnl = nonBinance.filter(t => !t.auto).reduce((s, t) => s + t.pnl, 0);
  const visibleTrades = nonBinance.filter(t => histFilter === "ALL" ? true : histFilter === "BOT" ? !!t.auto : !t.auto);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">Trade History</span>
        <div className="flex-1 h-px bg-border" />
        <PosFilterToggle
          value={histFilter}
          onChange={setHistFilter}
          counts={{ ALL: nonBinance.length, BOT: nonBinance.filter(t => t.auto).length, MANUAL: nonBinance.filter(t => !t.auto).length }}
        />
      </div>
      <div className="flex items-center gap-3 px-3 py-1.5 rounded border border-border/50 bg-secondary/10 flex-wrap">
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <Bot className="h-3 w-3 text-amber-400" />
          <span className="text-muted-foreground">Bot:</span>
          <span className={`font-black ${pnlColor(botPnl)}`}>{botPnl >= 0 ? "+" : ""}{fmtUsd(botPnl)}</span>
        </div>
        <div className="h-3 w-px bg-border/60" />
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="text-muted-foreground">Manual:</span>
          <span className={`font-black ${pnlColor(manualPnl)}`}>{manualPnl >= 0 ? "+" : ""}{fmtUsd(manualPnl)}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {visibleTrades.length === 0 ? (
          <div className="text-center py-4 text-[10px] text-muted-foreground font-mono">No trades match filter</div>
        ) : visibleTrades.slice(0, 10).map(t => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-border/50 bg-card/30 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Badge variant="outline" className="text-[9px] font-mono flex-shrink-0">
                {t.type === "STOCK" ? "STK" : "PRED"}
              </Badge>
              <span className="text-muted-foreground truncate font-mono">{t.description}</span>
            </div>
            {t.source ? (
              <BotStatsPopover
                source={t.source}
                type={t.type}
                label={t.source}
                className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/25 flex-shrink-0 max-w-[72px] truncate hover:bg-amber-400/30 transition-colors cursor-pointer"
              />
            ) : !t.auto ? (
              <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border/40 flex-shrink-0">
                Manual
              </span>
            ) : null}
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

/* ─── Options: open-position panel ─── */
function fmtExpiry(ms: number): string {
  const now = Date.now();
  const left = ms - now;
  if (left <= 0) return "פג תוקף";
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days} ימים ${hours} שעות`;
  const mins = Math.floor((left % 3_600_000) / 60_000);
  return `${hours} שעות ${mins} דק'`;
}

function OptionsTab({ priceFor }: { priceFor: (pos: OptionPosition) => number }) {
  const { optionPositions, closeOptionPosition } = usePortfolio();
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const autoOptions = optionPositions.filter((p) => p.auto);
  const visible = optionPositions.filter((p) =>
    posFilter === "ALL" ? true : posFilter === "BOT" ? p.auto : !p.auto,
  );

  return (
    <div className="h-full overflow-y-auto px-4 md:px-6 py-4 space-y-4">
      <div className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-sm font-black tracking-tight">סוכן האופציות — פוזיציות פתוחות</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5" dir="rtl">
              אופציות CALL/PUT לונג בלבד. ההפסד המרבי הוא הפרמיה ששולמה. השווי מסומן לפי מודל בלאק-שולס מפושט ויורד עם התקרבות התפוגה (דעיכת זמן). מדומה ולימודי בלבד — ללא הבטחת תשואה.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>פוזיציות</span>
          {optionPositions.length > 0 && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-mono">{optionPositions.length}</span>
          )}
        </div>
        <PosFilterToggle
          value={posFilter}
          onChange={setPosFilter}
          counts={{ ALL: optionPositions.length, BOT: autoOptions.length, MANUAL: optionPositions.length - autoOptions.length }}
        />
      </div>

      {visible.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 border border-dashed border-border rounded-xl">
          {optionPositions.length === 0 ? "אין פוזיציות אופציה פתוחות" : "אין פוזיציות התואמות לסינון"}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((pos) => {
            const mark = priceFor(pos);
            const value = optionPositionValue({
              kind: pos.kind, underlying: mark, strike: pos.strike,
              expiryMs: pos.expiryMs, vol: pos.entryVol, contracts: pos.contracts,
            });
            const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
            const pnl = safeValue - pos.premiumPaid;
            const pnlPct = pos.premiumPaid > 0 ? (pnl / pos.premiumPaid) * 100 : 0;
            const expired = yearsToExpiry(pos.expiryMs) <= 0;
            const isCall = pos.kind === "CALL";
            return (
              <div key={pos.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isCall ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {isCall ? "CALL" : "PUT"}
                    </span>
                    <span className="font-bold text-sm truncate">{pos.underlying}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground">
                      {pos.market === "CRYPTO" ? "קריפטו" : "מניה"}
                    </span>
                    {pos.auto ? (
                      <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-primary/15 text-primary border border-primary/25 flex items-center gap-0.5">
                        <Bot className="h-2.5 w-2.5" /> Options Agent
                      </span>
                    ) : (
                      <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border/40">Manual</span>
                    )}
                  </div>
                  <div className={`text-right font-mono font-black ${pnlColor(pnl)}`}>
                    {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
                    <span className="text-[10px] ml-1">({pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}%)</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-y-1.5 gap-x-3 text-[10px] font-mono">
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[8px]">סטרייק</div>
                    <div className="text-foreground">${pos.strike.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[8px]">חוזים</div>
                    <div className="text-foreground">{pos.contracts.toFixed(4)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[8px]">פרמיה</div>
                    <div className="text-foreground">{fmtUsd(pos.premiumPaid)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[8px]">שווי נוכחי</div>
                    <div className="text-foreground">{fmtUsd(safeValue)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[8px]">מחיר נכס בסיס</div>
                    <div className="text-foreground">${mark.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <div className="text-muted-foreground uppercase tracking-wider text-[8px] flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> זמן לתפוגה
                    </div>
                    <div className={expired ? "text-red-400" : "text-foreground"}>{fmtExpiry(pos.expiryMs)}</div>
                  </div>
                </div>
                <button
                  onClick={() => closeOptionPosition(pos.id, mark, "MANUAL")}
                  className="mt-2 w-full text-[11px] font-mono font-bold py-1.5 rounded border border-border bg-secondary/40 hover:bg-secondary/70 transition-colors text-foreground"
                >
                  סגור פוזיציה
                </button>
              </div>
            );
          })}
        </div>
      )}

      <TradeHistoryPanel />
    </div>
  );
}

/* ─── Main Page ─── */
export default function SimulatorPage() {
  // Deep-link support: ?tab=futures|stocks|prediction and ?asset=BTC (from trade history).
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialTab = (() => {
    const t = initialParams.get("tab");
    return t === "stocks" || t === "prediction" || t === "futures" || t === "options" ? t : "futures";
  })();
  const initialAsset = initialParams.get("asset") ?? undefined;
  const [tab, setTab] = useState<"futures" | "prediction" | "stocks" | "options">(initialTab);
  const [showDeposit, setShowDeposit] = useState(false);
  const [futuresFilter, setFuturesFilter] = useState<PosFilter>("ALL");
  const [stocksFilter, setStocksFilter] = useState<PosFilter>("ALL");
  const [polyFilter, setPolyFilter] = useState<PosFilter>("ALL");
  const { polyPositions, binancePositions, stockPositions, optionPositions, cash, resetPortfolio, checkSlTp, closeAllBotPositions } = usePortfolio();
  const { settings, update: updateAutoTrader } = useAutoTrader();
  const { intervalFor } = useRefresh();

  // REST is only the slow baseline / asset list now — the live WS (below) is the
  // real-time price source. Floor it at 5s even in fast mode so it stops blowing
  // the server's global rate limit (which was 429-ing and freezing the baseline).
  const { data: binanceData, isLoading: binanceLoading } = useGetBinanceMulti({
    query: { queryKey: getGetBinanceMultiQueryKey(), refetchInterval: intervalFor(5000, 5000) }
  });
  const { data: allMarketsData, isLoading: marketsLoading } = useGetAllMarkets(
    {},
    { query: { queryKey: getGetAllMarketsQueryKey({}), refetchInterval: intervalFor(30000, 30000) } }
  );
  const { data: stocksData, isLoading: stocksLoading } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: intervalFor(30000, 30000) }
  });

  // Sub-second live prices straight from Binance's public WS (browser-direct,
  // free, ~1/sec). Overlaid on the 5s REST baseline so the displayed price
  // tracks Binance in real time instead of lagging the poll interval.
  const live = useLivePrices();
  const liveVersion = live.version;
  const binancePrices = useMemo(() => {
    const map: Record<string, number> = {};
    (binanceData ?? []).forEach(b => {
      const lp = live.get(b.asset);
      map[b.asset] = lp && lp.price > 0 ? lp.price : b.markPrice;
    });
    return map;
    // live.get reads current store state; recompute when a new WS batch lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binanceData, liveVersion]);

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
    const optionPnl = optionPositions.reduce((sum, pos) => {
      const mark = (pos.market === "STOCK" ? stockPrices[pos.underlying] : binancePrices[pos.underlying]) ?? pos.entryUnderlying;
      const value = optionPositionValue({ kind: pos.kind, underlying: mark, strike: pos.strike, expiryMs: pos.expiryMs, vol: pos.entryVol, contracts: pos.contracts });
      const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
      return sum + (safe - pos.premiumPaid);
    }, 0);
    return binancePnl + polyPnl + stockPnl + optionPnl;
  }, [binancePositions, polyPositions, stockPositions, optionPositions, binancePrices, stockPrices, allMarkets]);

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
    const optionVal = optionPositions.reduce((s, p) => {
      const mark = (p.market === "STOCK" ? stockPrices[p.underlying] : binancePrices[p.underlying]) ?? p.entryUnderlying;
      const value = optionPositionValue({ kind: p.kind, underlying: mark, strike: p.strike, expiryMs: p.expiryMs, vol: p.entryVol, contracts: p.contracts });
      return s + (Number.isFinite(value) ? Math.max(0, value) : 0);
    }, 0);
    return bMargin + bPnl + polyVal + stockVal + optionVal;
  }, [binancePositions, polyPositions, stockPositions, optionPositions, binancePrices, stockPrices, allMarkets]);

  const optionPriceFor = useCallback(
    (pos: OptionPosition) => (pos.market === "STOCK" ? stockPrices[pos.underlying] : binancePrices[pos.underlying]) ?? pos.entryUnderlying,
    [binancePrices, stockPrices],
  );

  const polyPrices = useMemo(() => {
    const map: Record<string, number> = {};
    allMarkets.forEach(m => {
      const pos = polyPositions.find(p => p.conditionId === m.conditionId);
      if (pos) map[m.conditionId] = pos.side === "YES" ? m.yesPrice : m.noPrice;
    });
    return map;
  }, [allMarkets, polyPositions]);

  const totalBotPositions =
    binancePositions.filter(p => p.auto).length +
    stockPositions.filter(p => p.auto).length +
    polyPositions.filter(p => p.auto).length +
    optionPositions.filter(p => p.auto).length;

  function handleCloseAllBot() {
    if (!confirm(`Close all ${totalBotPositions} bot-placed position${totalBotPositions !== 1 ? "s" : ""} across all tabs?`)) return;
    closeAllBotPositions(binancePrices, stockPrices, polyPrices);
  }

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
          {settings.fleetPaused && (
            <button
              onClick={() => updateAutoTrader({ fleetPaused: false })}
              className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded border border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all animate-pulse"
              title="הבוטים מושהים — לחץ לביטול ההשהיה"
            >
              <PlayCircle className="h-3 w-3 shrink-0" />
              <span>בוטים מושהים</span>
            </button>
          )}
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
          <div className="hidden md:flex"><WalletAge /></div>
          <button onClick={() => setShowDeposit(true)}
            className="flex items-center gap-1 text-[10px] font-mono font-bold text-primary-foreground bg-primary hover:opacity-90 transition-opacity rounded px-2.5 py-1">
            <Plus className="h-3 w-3" /> Deposit
          </button>
          {totalBotPositions > 0 && (
            <button
              onClick={handleCloseAllBot}
              className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
              title="Close all bot-placed positions across all tabs"
            >
              <Bot className="h-3 w-3" />
              <span className="hidden sm:inline">Close All Bot</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 rounded-full px-1.5 py-px font-black ml-0.5">{totalBotPositions}</span>
            </button>
          )}
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
        <button onClick={() => setTab("options")} className={tabCls("options")}>
          <Sparkles className="h-4 w-4" /> Options
          {optionPositions.length > 0 && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">{optionPositions.length}</span>}
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
            <BinanceFuturesTerminal binancePrices={binancePrices} initialAsset={initialAsset} posFilter={futuresFilter} setPosFilter={setFuturesFilter} />
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
              <StocksTab stocks={stocks} stockPrices={stockPrices} posFilter={stocksFilter} setPosFilter={setStocksFilter} />
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
              <PolymarketTab allMarkets={allMarkets} posFilter={polyFilter} setPosFilter={setPolyFilter} />
            )}
          </div>
        )}
        {tab === "options" && <OptionsTab priceFor={optionPriceFor} />}
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
