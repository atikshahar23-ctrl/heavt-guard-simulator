import {
  useGetPolymarketMarkets,
  getGetPolymarketMarketsQueryKey,
  GetPolymarketMarketsAsset,
  PolymarketMarket,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useState, useCallback } from "react";
import { Search, X, ExternalLink, TrendingUp, TrendingDown, ChevronRight, FlaskConical, Trophy, AlertCircle, CheckCircle2, Bot } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader } from "@/contexts/autotrader-context";
import { CryptoIcon } from "@/components/crypto-icon";

/* ─── helpers ─────────────────────────────────────────────── */

function assetBadgeCls(tag: string) {
  switch (tag) {
    case "BTC": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "ETH": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "SOL": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "BNB": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    default:    return "bg-muted text-muted-foreground border-border";
  }
}

function polyUrl(m: PolymarketMarket) {
  if (m.eventSlug) return `https://polymarket.com/event/${m.eventSlug}`;
  return `https://polymarket.com/markets`;
}

/* ─── Demo Trade Panel ─────────────────────────────────────── */

interface DemoPanelProps {
  market: PolymarketMarket;
  onClose: () => void;
}

function DemoTradePanel({ market, onClose }: DemoPanelProps) {
  const { cash, polyPositions, openPolyPosition } = usePortfolio();
  const [side, setSide]     = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("50");
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const entryPrice = side === "YES" ? market.yesPrice : market.noPrice;
  const numAmount  = parseFloat(amount) || 0;
  const shares     = entryPrice > 0 ? numAmount / entryPrice : 0;
  const potentialPayout = shares * 1;              // resolves at $1 per share
  const potentialProfit = potentialPayout - numAmount;
  const roi = numAmount > 0 ? (potentialProfit / numAmount) * 100 : 0;

  const existingPos = polyPositions.filter(p => p.conditionId === market.conditionId);

  const handleTrade = useCallback(() => {
    setError(null);
    setSuccess(false);
    if (numAmount < 1) { setError("Minimum trade is $1"); return; }
    if (numAmount > cash) { setError(`Insufficient cash (balance: $${cash.toFixed(2)})`); return; }

    const err = openPolyPosition(
      {
        conditionId: market.conditionId,
        question:    market.question,
        category:    market.category,
        slug:        market.eventSlug ?? null,
        side,
        entryPrice,
      },
      numAmount,
    );
    if (err) { setError(err); return; }
    setSuccess(true);
    setAmount("50");
    setTimeout(() => setSuccess(false), 3000);
  }, [numAmount, cash, market, side, entryPrice, openPolyPosition]);

  const prob = market.yesProbabilityPercent;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-3 p-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className={`font-mono text-[10px] shrink-0 flex items-center gap-1 ${assetBadgeCls(market.assetTag)}`}>
              <CryptoIcon asset={market.assetTag} size={14} /> {market.assetTag}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border shrink-0">
              {market.category}
            </Badge>
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-3">{market.question}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Probability bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
            <span className="text-emerald-400 font-bold">YES {prob.toFixed(1)}%</span>
            <span className="text-red-400 font-bold">NO {(100 - prob).toFixed(1)}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-red-500/25">
            <div
              className="h-full rounded-full bg-emerald-500/80 transition-all"
              style={{ width: `${prob}%` }}
            />
          </div>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-3">
            <p className="text-[10px] font-mono text-muted-foreground mb-1">YES PRICE</p>
            <p className="text-lg font-black font-mono text-emerald-400">${market.yesPrice.toFixed(3)}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">per share</p>
          </div>
          <div className="rounded-lg bg-red-500/8 border border-red-500/20 p-3">
            <p className="text-[10px] font-mono text-muted-foreground mb-1">NO PRICE</p>
            <p className="text-lg font-black font-mono text-red-400">${market.noPrice.toFixed(3)}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">per share</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {market.volume != null && (
            <div className="bg-card rounded p-2 border border-border">
              <p className="text-muted-foreground font-mono">VOLUME</p>
              <p className="font-mono font-semibold">${(market.volume / 1000).toFixed(0)}K</p>
            </div>
          )}
          {market.endDate && (
            <div className="bg-card rounded p-2 border border-border">
              <p className="text-muted-foreground font-mono">ENDS</p>
              <p className="font-mono font-semibold">{new Date(market.endDate).toLocaleDateString()}</p>
            </div>
          )}
        </div>

        {/* External link */}
        <a
          href={polyUrl(market)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors font-mono group"
        >
          <ExternalLink className="h-3.5 w-3.5 group-hover:text-primary" />
          View on Polymarket
          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
        </a>

        {/* ── Demo Trade Form ─────────────────────── */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-0.5">
            <FlaskConical className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold font-mono text-primary">DEMO TRADE</span>
            <Badge variant="outline" className="text-[9px] font-mono border-primary/40 text-primary ml-auto">
              PAPER MONEY
            </Badge>
          </div>

          {/* YES / NO toggle */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setSide("YES")}
              className={`py-2.5 rounded-lg text-sm font-black font-mono transition-all border ${
                side === "YES"
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
            >
              <TrendingUp className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              YES
            </button>
            <button
              onClick={() => setSide("NO")}
              className={`py-2.5 rounded-lg text-sm font-black font-mono transition-all border ${
                side === "NO"
                  ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
              }`}
            >
              <TrendingDown className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              NO
            </button>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-[10px] font-mono text-muted-foreground mb-1 block">
              AMOUNT (USD) — Balance: <span className="text-foreground">${cash.toFixed(2)}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">$</span>
              <Input
                type="number"
                min="1"
                step="10"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(null); }}
                className="pl-7 bg-background font-mono text-sm"
                placeholder="50"
              />
            </div>
            {/* Quick amounts */}
            <div className="flex gap-1.5 mt-1.5">
              {[10, 25, 50, 100].map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className="flex-1 text-[10px] font-mono py-1 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Trade preview */}
          {numAmount > 0 && (
            <div className="rounded-lg bg-background/60 border border-border p-3 space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry price</span>
                <span>${entryPrice.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares bought</span>
                <span>{shares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span>${numAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <span className="text-muted-foreground">Max payout (if correct)</span>
                <span className="text-emerald-400 font-bold">${potentialPayout.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max profit</span>
                <span className={potentialProfit > 0 ? "text-emerald-400 font-bold" : "text-red-400"}>
                  +${potentialProfit.toFixed(2)} ({roi.toFixed(0)}%)
                </span>
              </div>
            </div>
          )}

          {/* Error / success */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded p-2 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Position opened! View in Simulator → Prediction Markets
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleTrade}
            className={`w-full font-black font-mono text-sm h-10 transition-all ${
              side === "YES"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-red-600 hover:bg-red-500 text-white"
            }`}
          >
            {side === "YES" ? (
              <><TrendingUp className="h-4 w-4 mr-1.5" />BUY YES — ${numAmount.toFixed(2)}</>
            ) : (
              <><TrendingDown className="h-4 w-4 mr-1.5" />BUY NO — ${numAmount.toFixed(2)}</>
            )}
          </Button>
        </div>

        {/* Existing positions for this market */}
        {existingPos.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-mono font-bold text-muted-foreground">YOUR POSITIONS IN THIS MARKET</span>
            </div>
            {existingPos.map(pos => (
              <div key={pos.id} className="flex items-center justify-between text-[11px] font-mono bg-secondary/30 rounded p-2">
                <span className={pos.side === "YES" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                  {pos.side}
                </span>
                <span>{pos.shares.toFixed(2)} shares</span>
                <span className="text-muted-foreground">@ ${pos.entryPrice.toFixed(3)}</span>
                <span className="text-primary font-bold">${pos.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Bitcoin auto-investor panel ──────────────────────────── */

function BtcBetBot() {
  const { settings, update } = useAutoTrader();
  const { polyPositions } = usePortfolio();
  const openBets = polyPositions.length;
  const armed = settings.polyEnabled;

  return (
    <Card
      className="border-border transition-colors"
      style={{ borderColor: armed ? "hsl(207 30% 70% / 0.5)" : undefined }}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: armed ? "hsl(207 30% 70% / 0.15)" : "hsl(0 0% 100% / 0.05)" }}
            >
              <Bot className="h-4 w-4" style={{ color: armed ? "hsl(207 30% 70%)" : "#71717a" }} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm flex items-center gap-2">
                Bitcoin Auto-Investor
                <span
                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: armed ? "hsl(207 30% 70% / 0.15)" : "hsl(0 0% 100% / 0.06)",
                    color: armed ? "hsl(207 30% 70%)" : "#71717a",
                  }}
                >
                  {armed ? "ARMED" : "OFF"}
                </span>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {armed
                  ? `Same-day BTC up/down bets from live momentum · ${openBets} open`
                  : "Auto-bets same-day Bitcoin up/down markets"}
              </p>
            </div>
          </div>
          <Switch checked={settings.polyEnabled} onCheckedChange={(v) => update({ polyEnabled: v })} />
        </div>
      </CardHeader>

      {armed && (
        <CardContent className="px-4 pb-4 pt-0 grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Stake / bet (USD)</label>
            <Input
              type="number"
              value={settings.polyStakePerBet}
              min={1}
              className="h-8 bg-secondary/30 font-mono text-sm"
              onChange={(e) => update({ polyStakePerBet: Math.max(1, Number(e.target.value)) })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Max open bets</label>
            <Input
              type="number"
              value={settings.polyMaxOpenBets}
              min={1}
              className="h-8 bg-secondary/30 font-mono text-sm"
              onChange={(e) => update({ polyMaxOpenBets: Math.max(1, Math.min(50, Number(e.target.value))) })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Min BTC bias</label>
              <span className="font-mono text-xs font-bold text-primary">{settings.polyMinBiasPct}%</span>
            </div>
            <Slider value={[settings.polyMinBiasPct]} min={0} max={5} step={0.1} onValueChange={(v) => update({ polyMinBiasPct: v[0] })} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Horizon</label>
              <span className="font-mono text-xs font-bold text-primary">{settings.polyHorizonHours}h</span>
            </div>
            <Slider value={[settings.polyHorizonHours]} min={6} max={48} step={6} onValueChange={(v) => update({ polyHorizonHours: v[0] })} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Take-profit</label>
              <span className="font-mono text-xs font-bold text-emerald-400">+{settings.polyTakeProfitPct}%</span>
            </div>
            <Slider value={[settings.polyTakeProfitPct]} min={10} max={150} step={5} onValueChange={(v) => update({ polyTakeProfitPct: v[0] })} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Stop-loss</label>
              <span className="font-mono text-xs font-bold text-red-400">-{settings.polyStopLossPct}%</span>
            </div>
            <Slider value={[settings.polyStopLossPct]} min={10} max={90} step={5} onValueChange={(v) => update({ polyStopLossPct: v[0] })} />
          </div>

          <p className="col-span-2 text-[9px] font-mono text-amber-400/80 leading-snug">
            ⚠ Demo-only. Bets paper money on same-day Bitcoin markets — buys the up/down side aligned with BTC's 24h move, skips near-resolved odds, exits on TP/SL. 30-min cooldown per market.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */

export default function Markets() {
  const [search, setSearch]           = useState("");
  const [assetFilter, setAssetFilter] = useState<GetPolymarketMarketsAsset>("ALL");
  const [selected, setSelected]       = useState<PolymarketMarket | null>(null);

  const { data: markets, isLoading } = useGetPolymarketMarkets(
    { asset: assetFilter, search },
    {
      query: {
        queryKey: getGetPolymarketMarketsQueryKey({ asset: assetFilter, search }),
        refetchInterval: 60_000,
      },
    },
  );

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: market list ───────────────────── */}
      <div className={`flex flex-col min-h-0 flex-1 transition-all duration-300 ${selected ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto flex-1">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Polymarket Contracts</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Click any market to open it — demo trade with paper money.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Tabs value={assetFilter} onValueChange={v => setAssetFilter(v as GetPolymarketMarketsAsset)}>
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="ALL">ALL</TabsTrigger>
                <TabsTrigger value="BTC">BTC</TabsTrigger>
                <TabsTrigger value="ETH">ETH</TabsTrigger>
                <TabsTrigger value="SOL">SOL</TabsTrigger>
                <TabsTrigger value="BNB">BNB</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search contracts..."
                className="pl-9 bg-secondary/30 text-sm h-8"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <BtcBetBot />

          <Card className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-mono text-muted-foreground">MARKETS DIRECTORY</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-b-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow>
                      <TableHead className="font-mono text-[10px] w-16 pl-4">ASSET</TableHead>
                      <TableHead className="font-mono text-[10px]">QUESTION</TableHead>
                      <TableHead className="text-right font-mono text-[10px]">PROB</TableHead>
                      <TableHead className="text-right font-mono text-[10px] hidden sm:table-cell">YES</TableHead>
                      <TableHead className="text-right font-mono text-[10px] hidden sm:table-cell pr-4">VOL</TableHead>
                      <TableHead className="w-6 pr-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell className="pl-4"><Skeleton className="h-4 w-10" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                            <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                            <TableCell className="hidden sm:table-cell pr-4"><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))
                      : !markets || markets.length === 0
                      ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                              No markets match your search.
                            </TableCell>
                          </TableRow>
                        )
                      : markets.map((m, i) => {
                          const isSelected = selected?.conditionId === m.conditionId;
                          return (
                            <TableRow
                              key={m.conditionId || `market-${i}`}
                              onClick={() => setSelected(isSelected ? null : m)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-primary/10 hover:bg-primary/10"
                                  : "hover:bg-secondary/30"
                              }`}
                            >
                              <TableCell className="pl-4">
                                <Badge variant="outline" className={`font-mono text-[9px] ${assetBadgeCls(m.assetTag)}`}>
                                  {m.assetTag}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-sm max-w-[220px] md:max-w-none">
                                <span className="line-clamp-2 leading-snug">{m.question}</span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                <span className={m.yesProbabilityPercent >= 50 ? "text-emerald-400" : "text-red-400"}>
                                  {m.yesProbabilityPercent.toFixed(0)}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                                ${m.yesPrice.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground hidden sm:table-cell pr-4">
                                {m.volume ? `$${(m.volume / 1000).toFixed(0)}K` : "—"}
                              </TableCell>
                              <TableCell className="pr-3">
                                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform ${isSelected ? "rotate-90 text-primary" : ""}`} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Right: demo trade panel ─────────────── */}
      {/* Mobile: full overlay */}
      {selected && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm flex flex-col">
          <DemoTradePanel market={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      {/* Desktop: side panel */}
      <div
        className={`hidden md:flex flex-col border-l border-border bg-card transition-all duration-300 overflow-hidden ${
          selected ? "w-96 opacity-100" : "w-0 opacity-0"
        }`}
      >
        {selected && <DemoTradePanel market={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
