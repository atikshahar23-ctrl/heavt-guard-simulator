import { useState, useMemo } from "react";
import {
  useGetBinanceMulti, getGetBinanceMultiQueryKey,
  useGetAllMarkets, getGetAllMarketsQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  StockRecommendation, StockQuote,
} from "@workspace/api-client-react";
import {
  usePortfolio, STARTING_BALANCE,
} from "@/contexts/portfolio-context";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, TrendingDown, Wallet, RotateCcw, Search,
  ChartCandlestick, BarChart3, Trophy, History, X, Plus,
  ArrowUpRight, ArrowDownRight, LineChart, Lightbulb, ExternalLink,
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

/* ─── Portfolio Summary — wallet-style overview ─── */
function PortfolioSummary({
  unrealizedPnl,
  totalPositionValue,
}: {
  unrealizedPnl: number;
  totalPositionValue: number;
}) {
  const { cash, totalDeposited, addFunds, tradeHistory, resetPortfolio, polyPositions, binancePositions, stockPositions } = usePortfolio();
  const totalValue = cash + totalPositionValue;
  const totalPnl = totalValue - totalDeposited;
  const totalPnlPct = totalDeposited > 0 ? (totalPnl / totalDeposited) * 100 : 0;
  const realizedPnl = tradeHistory.reduce((s, t) => s + t.pnl, 0);
  const openCount = polyPositions.length + binancePositions.length + stockPositions.length;
  const wins = tradeHistory.filter(t => t.pnl > 0).length;
  const winRate = tradeHistory.length === 0 ? 0 : (wins / tradeHistory.length) * 100;
  const invested = totalPositionValue;
  const investedPct = totalValue > 0 ? (invested / totalValue) * 100 : 0;

  // progress toward / against the deposited baseline (visualised 0%..200% of deposited)
  const progress = Math.min(100, Math.max(0, (totalValue / (totalDeposited * 2)) * 100));
  const gain = totalPnl >= 0;

  const [showDeposit, setShowDeposit] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);

  const doDeposit = (amount: number) => {
    const err = addFunds(amount);
    if (err) { setDepositError(err); return; }
    setDepositError(null);
    setCustomAmount("");
    setShowDeposit(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-background p-5 md:p-6 space-y-5">
      {/* Hero: estimated balance */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-primary" /> Estimated Balance
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-4xl md:text-5xl font-black font-mono text-foreground tracking-tight">{fmtUsd(totalValue)}</span>
            <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${gain ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {gain ? '+' : ''}{fmt(totalPnlPct)}%
            </span>
          </div>
          <div className={`text-sm font-mono mt-1 ${pnlColor(totalPnl)}`}>
            {totalPnl >= 0 ? '+' : '-'}{fmtUsd(totalPnl)} all-time PnL
            <span className="text-muted-foreground"> · {fmtUsd(totalDeposited)} deposited</span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            onClick={() => { setDepositError(null); setShowDeposit(true); }}
            className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-primary-foreground bg-primary hover:opacity-90 transition-opacity rounded-md px-3 py-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Deposit
          </button>
          <button
            onClick={() => { if (confirm("Reset all positions and balance to $10,000?")) resetPortfolio(); }}
            className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-red-400 transition-colors border border-border rounded-md px-3 py-1.5"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>

      {/* Deposit dialog */}
      {showDeposit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowDeposit(false)}
        >
          <div
            className="w-[340px] max-w-full rounded-2xl border border-primary/30 bg-card p-5 space-y-4"
            style={{ boxShadow: "0 0 40px hsl(43 74% 52% / 0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black font-mono uppercase tracking-widest text-primary">
                <Wallet className="h-4 w-4" /> Add Funds
              </div>
              <button onClick={() => setShowDeposit(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">Top up your simulator cash. Current available: {fmtUsd(cash)}.</p>
            <div className="grid grid-cols-3 gap-2">
              {[1000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => doDeposit(amt)}
                  className="rounded-lg border border-border bg-secondary/40 hover:border-primary/50 hover:text-primary transition-colors py-2 text-xs font-mono font-bold"
                >
                  +${amt.toLocaleString()}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); doDeposit(Number(customAmount)); }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
                <input
                  type="number"
                  min="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom"
                  className="w-full h-9 rounded-lg bg-secondary/40 border border-border pl-7 pr-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-mono font-bold hover:opacity-90 transition-opacity"
              >
                Add
              </button>
            </form>
            {depositError && <p className="text-[11px] text-red-400 font-mono">{depositError}</p>}
          </div>
        </div>
      )}

      {/* Progress vs starting balance */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          <span>Progress vs ${fmt(totalDeposited, 0)} deposited</span>
          <span>{fmt(totalDeposited > 0 ? (totalValue / totalDeposited) * 100 : 0, 0)}%</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-secondary overflow-hidden">
          {/* baseline marker at 50% (== starting balance) */}
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-muted-foreground/40 z-10" />
          <div
            className={`h-full rounded-full transition-all duration-700 ${gain ? 'bg-gradient-to-r from-emerald-500/70 to-emerald-400' : 'bg-gradient-to-r from-red-500/70 to-red-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-mono text-muted-foreground/60">
          <span>$0</span><span>${fmt(totalDeposited, 0)}</span><span>${fmt(totalDeposited * 2, 0)}</span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Available</div>
          <div className="text-lg font-black font-mono text-foreground mt-0.5">{fmtUsd(cash)}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">cash</div>
        </div>
        <div className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">In Positions</div>
          <div className="text-lg font-black font-mono text-foreground mt-0.5">{fmtUsd(invested)}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">{fmt(investedPct, 0)}% deployed</div>
        </div>
        <div className={`rounded-lg border px-3 py-2.5 ${pnlBg(unrealizedPnl)}`}>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Unrealized</div>
          <div className={`text-lg font-black font-mono mt-0.5 ${pnlColor(unrealizedPnl)}`}>
            {unrealizedPnl >= 0 ? '+' : ''}{fmtUsd(unrealizedPnl)}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">{openCount} open</div>
        </div>
        <div className={`rounded-lg border px-3 py-2.5 ${pnlBg(realizedPnl)}`}>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Realized</div>
          <div className={`text-lg font-black font-mono mt-0.5 ${pnlColor(realizedPnl)}`}>
            {realizedPnl >= 0 ? '+' : ''}{fmtUsd(realizedPnl)}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">{tradeHistory.length} closed</div>
        </div>
        <div className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Win Rate</div>
          <div className="text-lg font-black font-mono text-foreground mt-0.5">
            {tradeHistory.length === 0 ? '—' : `${Math.round(winRate)}%`}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">{wins}/{tradeHistory.length} wins</div>
        </div>
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

/* ─── In-simulator recommendations strip ─── */
function StockRecommendationsStrip({
  recs,
  onPick,
}: {
  recs: StockRecommendation[];
  onPick: (symbol: string) => void;
}) {
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
        {top.map((rec) => {
          const isBuy = rec.action === "BUY";
          return (
            <button
              key={rec.symbol}
              onClick={() => onPick(rec.symbol)}
              className="text-left rounded-md border border-border bg-card/60 hover:bg-card transition-colors p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black font-mono text-foreground">{rec.symbol}</span>
                <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {rec.action}
                </span>
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
  const { data: stockRecs } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: 30000 },
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"ALL" | StockQuote["category"]>("ALL");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const CATEGORIES: ("ALL" | StockQuote["category"])[] = ["ALL", "TECH", "ENERGY", "RESOURCES", "LARGE_CAP", "INDEX"];
  const CAT_LABEL: Record<string, string> = {
    ALL: "All", TECH: "Tech", ENERGY: "Energy", RESOURCES: "Resources", LARGE_CAP: "Large Cap", INDEX: "Index/ETF",
  };

  const filtered = useMemo(() =>
    stocks
      .filter(s => category === "ALL" || s.category === category)
      .filter(s => !search || s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 60),
    [stocks, category, search]
  );

  function buy(stock: StockQuote) {
    const raw = amounts[stock.symbol] ?? "";
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) {
      setErrors(e => ({ ...e, [stock.symbol]: "Enter a valid amount" }));
      return;
    }
    const price = stockPrices[stock.symbol] ?? stock.price;
    if (!price) {
      setErrors(e => ({ ...e, [stock.symbol]: "Price unavailable" }));
      return;
    }
    const err = openStockPosition({ symbol: stock.symbol, name: stock.name, entryPrice: price }, amt);
    if (err) {
      setErrors(e => ({ ...e, [stock.symbol]: err }));
    } else {
      setAmounts(a => ({ ...a, [stock.symbol]: "" }));
      setErrors(e => ({ ...e, [stock.symbol]: "" }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Recommendations */}
      <StockRecommendationsStrip
        recs={stockRecs ?? []}
        onPick={(symbol) => { setCategory("ALL"); setSearch(symbol); }}
      />

      {/* Open Stock Positions */}
      {stockPositions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Open Stock Positions</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {stockPositions.map((pos) => {
            const currentPrice = stockPrices[pos.symbol] ?? pos.entryPrice;
            const value = pos.shares * currentPrice;
            const pnl = value - pos.cost;
            const pnlPct = pos.cost > 0 ? (pnl / pos.cost) * 100 : 0;

            return (
              <div key={pos.id} className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${pnlBg(pnl)}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs font-black font-mono text-emerald-400">LONG</div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold font-mono truncate">{pos.symbol} <span className="text-muted-foreground font-normal">{fmt(pos.shares, 4)} sh</span></div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Entry ${pos.entryPrice.toFixed(2)} → Now ${currentPrice.toFixed(2)} · Cost {fmtUsd(pos.cost)}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-black font-mono ${pnlColor(pnl)}`}>
                    {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
                  </div>
                  <div className={`text-[10px] font-mono ${pnlColor(pnl)}`}>
                    {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}% · Value {fmtUsd(value)}
                  </div>
                </div>
                <button
                  onClick={() => closeStockPosition(pos.id, currentPrice)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0"
                  title="Sell position"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search stocks by symbol or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary/30"
          />
        </div>
        <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-mono">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-2.5 py-1.5 transition-colors whitespace-nowrap ${category === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
            >
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Stock cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((stock) => {
          const price = stockPrices[stock.symbol] ?? stock.price;
          const up = stock.changePercent >= 0;
          const amt = parseFloat(amounts[stock.symbol] ?? "0") || 0;
          const tvUrl = `https://www.tradingview.com/symbols/${stock.tradingViewSymbol}/`;

          return (
            <div key={stock.symbol} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-black font-mono text-foreground">{stock.symbol}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{stock.name}</div>
                </div>
                <a
                  href={tvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                  title="View on TradingView"
                >
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
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Amount (USD)</span>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={amounts[stock.symbol] ?? ""}
                  onChange={e => setAmounts(a => ({ ...a, [stock.symbol]: e.target.value }))}
                  className="h-8 text-xs font-mono bg-secondary/30"
                />
                {amt > 0 && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {price > 0 ? `${fmt(amt / price, 4)} shares` : ''} · {cash < amt ? <span className="text-red-400">Insufficient cash</span> : <span className="text-emerald-400">OK</span>}
                  </div>
                )}
              </div>
              {errors[stock.symbol] && <div className="text-[10px] text-red-400 font-mono">{errors[stock.symbol]}</div>}
              <button
                onClick={() => buy(stock)}
                className="w-full flex items-center justify-center gap-1 py-2 rounded text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
              >
                <TrendingUp className="h-3 w-3" /> BUY SHARES
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground text-sm">No stocks found.</div>
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
                {t.type === "BINANCE" ? "FUT" : t.type === "STOCK" ? "STK" : "PRED"}
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
  const { polyPositions, binancePositions, stockPositions, cash } = usePortfolio();

  const { data: binanceData, isLoading: binanceLoading } = useGetBinanceMulti({
    query: { queryKey: getGetBinanceMultiQueryKey(), refetchInterval: 5000 }
  });

  const { data: allMarketsData, isLoading: marketsLoading } = useGetAllMarkets(
    {},
    { query: { queryKey: getGetAllMarketsQueryKey({}), refetchInterval: 30000 } }
  );

  const { data: stocksData, isLoading: stocksLoading } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000 }
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

    const stockPnl = stockPositions.reduce((sum, pos) => {
      const currentPrice = stockPrices[pos.symbol] ?? pos.entryPrice;
      return sum + (pos.shares * currentPrice - pos.cost);
    }, 0);

    return binancePnl + polyPnl + stockPnl;
  }, [binancePositions, polyPositions, stockPositions, binancePrices, stockPrices, allMarkets]);

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
    const stockValue = stockPositions.reduce((sum, pos) => {
      const currentPrice = stockPrices[pos.symbol] ?? pos.entryPrice;
      return sum + pos.shares * currentPrice;
    }, 0);
    return binanceMargin + binancePnl + polyValue + stockValue;
  }, [binancePositions, polyPositions, stockPositions, binancePrices, stockPrices, allMarkets]);

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
            Trade with $10,000 virtual funds using real-time Binance futures, stock, and Polymarket prices.
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
          onClick={() => setTab("stocks")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
            tab === "stocks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LineChart className="h-4 w-4" />
          Stocks
          {stockPositions.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">
              {stockPositions.length}
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
      {tab === "futures" && (
        binanceLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : (
          <BinanceFuturesTab binancePrices={binancePrices} />
        )
      )}
      {tab === "stocks" && (
        stocksLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : (
          <StocksTab stocks={stocks} stockPrices={stockPrices} />
        )
      )}
      {tab === "prediction" && (
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
