import { useGetBinanceData, getGetBinanceDataQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Binance() {
  const { data: binance, isLoading } = useGetBinanceData({}, {
    query: {
      queryKey: getGetBinanceDataQueryKey({}),
      refetchInterval: 10000,
    }
  });

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Binance Futures</h1>
        <p className="text-muted-foreground mt-1">Live perpetual contract data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">BTCUSDT Mark Price</CardTitle>
            <CardDescription>Current index price used for liquidations</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-48" />
            ) : (
              <div>
                <div className="text-5xl font-bold font-mono text-primary">
                  ${binance?.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="mt-4 text-sm text-muted-foreground font-mono">
                  LAST FETCH: {binance?.fetchedAt ? format(new Date(binance.fetchedAt), "HH:mm:ss.SSS") : '-'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Funding Rate</CardTitle>
            <CardDescription>Current period funding cost</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <div>
                <div className={`text-5xl font-bold font-mono ${(binance?.fundingRatePercent || 0) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {binance?.fundingRatePercent.toFixed(4)}%
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  {(binance?.fundingRatePercent || 0) > 0 ? (
                    <span>Longs pay shorts. Market leans bullish.</span>
                  ) : (
                    <span>Shorts pay longs. Market leans bearish.</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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