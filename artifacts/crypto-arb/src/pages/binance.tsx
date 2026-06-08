import { useState } from "react";
import {
  useGetBinanceMulti, getGetBinanceMultiQueryKey,
  useGetMarketOverview, getGetMarketOverviewQueryKey,
} from "@workspace/api-client-react";
import type { CoinTicker } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Star, Search, ExternalLink } from "lucide-react";
import { useFavorites } from "@/contexts/favorites-context";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function OverviewRow({ c }: { c: CoinTicker }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favId = `coin:${c.asset}`;
  const fav = isFavorite(favId);
  const up = c.changePercent >= 0;
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1.2fr_1fr_1fr_1fr_auto] items-center gap-3 px-3 py-2 rounded hover:bg-secondary/40 transition-colors">
      <button
        onClick={() => toggleFavorite({ id: favId, kind: "coin", symbol: c.asset, label: c.asset })}
        aria-label="Toggle favorite"
      >
        <Star
          className="h-3.5 w-3.5 transition-colors"
          style={{ color: fav ? "hsl(207 30% 70%)" : "#52525b", fill: fav ? "hsl(207 30% 70%)" : "transparent" }}
        />
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono font-bold text-sm text-foreground">{c.asset}</span>
        <span className="text-[9px] font-mono text-muted-foreground hidden sm:inline">/USDT</span>
      </div>
      <span className="font-mono text-xs text-foreground/90 text-right">${fmtPrice(c.price)}</span>
      <span className={`font-mono font-bold text-xs text-right ${up ? "text-emerald-400" : "text-red-400"}`}>
        {up ? "+" : ""}{c.changePercent.toFixed(2)}%
      </span>
      <span className="font-mono text-[10px] text-muted-foreground text-right hidden sm:block">{fmtVol(c.quoteVolume)}</span>
      <a
        href={`https://www.binance.com/en/trade/${c.asset}_USDT`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-primary transition-colors hidden sm:block"
        aria-label="Open on Binance"
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function MarketOverview() {
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const { isFavorite } = useFavorites();
  const { data, isLoading } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });

  const q = search.trim().toLowerCase();
  const coins = (data ?? [])
    .filter((c) => !favOnly || isFavorite(`coin:${c.asset}`))
    .filter((c) => !q || c.asset.toLowerCase().includes(q));

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base">Live Market Overview <span className="text-xs font-mono text-muted-foreground">· top 50 by volume</span></CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFavOnly((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
                favOnly ? "bg-primary/15 text-primary" : "bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="h-3 w-3" style={favOnly ? { fill: "hsl(207 30% 70%)" } : {}} /> Favorites
            </button>
            <div className="relative w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search coin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-secondary/30"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded" />)}
          </div>
        ) : coins.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">{favOnly ? "No favorite coins yet — tap a star to add one." : "No coins match."}</p>
        ) : (
          <div className="space-y-0.5">
            {coins.map((c) => <OverviewRow key={c.symbol} c={c} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Binance() {
  const { data: binanceAssets, isLoading } = useGetBinanceMulti({
    query: {
      queryKey: getGetBinanceMultiQueryKey(),
      refetchInterval: 10000,
    }
  });

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Binance Futures</h1>
        <p className="text-muted-foreground mt-1">Live perpetual contract data across major assets.</p>
      </div>

      <MarketOverview />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border bg-card/50 backdrop-blur">
              <CardHeader>
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {binanceAssets?.map((asset) => (
            <Card key={asset.symbol} className="border-border bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{asset.asset}</span>
                  <span className="text-xs font-mono text-muted-foreground">{asset.symbol}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div>
                  <div className="text-sm text-muted-foreground font-mono mb-1">MARK PRICE</div>
                  <div className="text-2xl font-bold font-mono text-primary">
                    ${asset.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground font-mono mb-1">FUNDING RATE</div>
                  <div className={`text-xl font-bold font-mono flex items-center gap-1 ${asset.fundingRatePercent > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {asset.fundingRatePercent > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {asset.fundingRatePercent.toFixed(4)}%
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {asset.fundingRatePercent > 0 ? 'Bullish (Longs pay)' : 'Bearish (Shorts pay)'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Arbitrage Mechanism Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            This dashboard identifies divergences between binary options (Polymarket) and linear perpetual futures (Binance). When Polymarket probability diverges significantly from implied probability derived from Binance's mark price and funding rate, an arbitrage or sentiment signal is generated.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="font-bold text-emerald-500 mb-2 font-mono">UNDERPRICED SIGNAL</h4>
              <p>Occurs when Polymarket crowd assigns a significantly lower probability to a price target than current market trajectory implies. Opportunity to go long on YES shares.</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h4 className="font-bold text-amber-500 mb-2 font-mono">OVERBOUGHT SIGNAL</h4>
              <p>Occurs when Polymarket crowd assigns an excessively high probability driven by hype, ignoring actual futures resistance. Opportunity to go long on NO shares.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}