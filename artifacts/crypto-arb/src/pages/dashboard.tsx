import { useState, useEffect } from "react";
import { useGetScanResults, getGetScanResultsQueryKey, ScanResult } from "@workspace/api-client-react";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export default function Dashboard() {
  const [countdown, setCountdown] = useState(30);

  const { data, isLoading, isFetching } = useGetScanResults({
    query: {
      queryKey: getGetScanResultsQueryKey(),
      refetchInterval: 30000,
    }
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isFetching) {
      setCountdown(30);
    } else {
      timer = setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isFetching]);

  const renderBadge = (signal: ScanResult['markets'][0]['signal']) => {
    if (signal.type === 'overbought_sentiment') {
      return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 hover:bg-amber-500/30">OVERBOUGHT</Badge>;
    }
    if (signal.type === 'underpriced_probability') {
      return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/30">UNDERPRICED</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground border-muted">NEUTRAL</Badge>;
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Scanner</h1>
          <p className="text-muted-foreground mt-1">Cross-referencing Binance futures with Polymarket sentiment.</p>
        </div>
        <div className="flex items-center gap-4 text-sm font-mono bg-card px-4 py-2 rounded-md border border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-primary' : ''}`} />
            Refresh in
          </div>
          <span className="text-primary font-bold">{countdown}s</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">BTC Mark Price</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-bold font-mono tracking-tight">
                ${data?.binance.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Funding Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className={`text-3xl font-bold font-mono tracking-tight flex items-center gap-2 ${(data?.binance.fundingRatePercent || 0) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {(data?.binance.fundingRatePercent || 0) > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {data?.binance.fundingRatePercent.toFixed(4)}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur col-span-1 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Signal Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-full" /> : (
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold font-mono text-emerald-500">{data?.signalCounts.underpriced}</span>
                  <span className="text-xs text-muted-foreground uppercase">Underpriced</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold font-mono text-amber-500">{data?.signalCounts.overbought}</span>
                  <span className="text-xs text-muted-foreground uppercase">Overbought</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold font-mono text-muted-foreground">{data?.signalCounts.neutral}</span>
                  <span className="text-xs text-muted-foreground uppercase">Neutral</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Polymarket Contracts vs Binance Reality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="font-mono text-xs">MARKET</TableHead>
                  <TableHead className="text-right font-mono text-xs">TARGET</TableHead>
                  <TableHead className="text-right font-mono text-xs">PROBABILITY</TableHead>
                  <TableHead className="text-right font-mono text-xs">DISTANCE</TableHead>
                  <TableHead className="text-right font-mono text-xs">SIGNAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : !data?.markets || data.markets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No active markets found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.markets.map((m) => (
                    <TableRow key={m.market.conditionId} className="hover:bg-secondary/20">
                      <TableCell className="font-medium max-w-[300px] truncate" title={m.market.question}>
                        {m.market.question}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.market.targetPrice ? `$${m.market.targetPrice.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {m.market.yesProbabilityPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.distanceToTargetPercent !== 0 ? (
                          <span className={m.distanceToTargetPercent > 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {m.distanceToTargetPercent > 0 ? '+' : ''}{m.distanceToTargetPercent.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderBadge(m.signal)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}