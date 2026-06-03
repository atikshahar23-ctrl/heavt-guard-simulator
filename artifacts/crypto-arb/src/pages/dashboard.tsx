import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetScanResults, getGetScanResultsQueryKey,
  useGetRecommendations, getGetRecommendationsQueryKey,
  ScanResult, GetScanResultsAsset, Recommendation,
} from "@workspace/api-client-react";
import { RefreshCw, TrendingUp, TrendingDown, Search, Zap, ArrowRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefresh } from "@/contexts/refresh-context";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function AssetBadge({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    BTC: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    ETH: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    SOL: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    BNB: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };
  return (
    <Badge variant="outline" className={`font-mono text-[10px] ${colors[tag] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {tag}
    </Badge>
  );
}

function SignalBadge({ signal }: { signal: ScanResult['markets'][0]['signal'] }) {
  if (signal.type === 'overbought_sentiment') {
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25 text-[10px]">OVERBOUGHT</Badge>;
  }
  if (signal.type === 'underpriced_probability') {
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25 text-[10px]">UNDERPRICED</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground border-muted text-[10px]">NEUTRAL</Badge>;
}

function TopAlertCard({ rec }: { rec: Recommendation }) {
  const isBuyYes = rec.action === 'BUY_YES';
  const isBuyNo = rec.action === 'BUY_NO';

  const bg = isBuyYes
    ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
    : isBuyNo
      ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
      : 'bg-card border-border hover:border-primary/30';

  const actionColor = isBuyYes ? 'text-emerald-400' : isBuyNo ? 'text-amber-400' : 'text-muted-foreground';
  const returnColor = isBuyYes ? 'text-emerald-400' : isBuyNo ? 'text-amber-400' : 'text-foreground';

  return (
    <Link href="/recommendations">
      <div className={`rounded-lg border p-4 cursor-pointer transition-all group ${bg}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black tracking-tight ${actionColor}`}>
              {isBuyYes ? 'BUY YES' : isBuyNo ? 'BUY NO' : 'WATCH'}
            </span>
            <AssetBadge tag={rec.market.assetTag} />
          </div>
          <span className={`text-xs font-mono font-bold ${returnColor}`}>
            {rec.potentialReturn >= 100 ? '100×+' : `${rec.potentialReturn.toFixed(1)}×`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {rec.market.question}
        </p>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <span>Edge {rec.edge.toFixed(0)}pts</span>
            <span>|</span>
            <span>{rec.market.yesProbabilityPercent.toFixed(1)}% crowd</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { intervalFor } = useRefresh();
  const scanInterval = intervalFor(30000, 30000);
  const [countdown, setCountdown] = useState(Math.round(scanInterval / 1000));
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<GetScanResultsAsset>("ALL");

  const { data, isLoading: scanLoading, isFetching: scanFetching } = useGetScanResults(
    { asset: assetFilter },
    {
      query: {
        queryKey: getGetScanResultsQueryKey({ asset: assetFilter }),
        refetchInterval: scanInterval,
      }
    }
  );

  const { data: topRecs, isLoading: recsLoading } = useGetRecommendations({
    query: {
      queryKey: getGetRecommendationsQueryKey(),
      refetchInterval: intervalFor(60000, 30000),
    }
  });

  const isFetching = scanFetching;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isFetching) {
      setCountdown(Math.round(scanInterval / 1000));
    } else {
      timer = setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isFetching, scanInterval]);

  const btcAsset = data?.binanceAssets?.find(b => b.asset === 'BTC');
  const filteredMarkets = data?.markets?.filter(m =>
    m.market.question.toLowerCase().includes(search.toLowerCase())
  );

  const top3 = topRecs?.slice(0, 3) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Market Scanner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-referencing Binance futures with Polymarket crowd sentiment.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded border border-border text-muted-foreground">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
            {isFetching ? 'Scanning...' : `Refresh in ${countdown}s`}
          </div>
          <Tabs value={assetFilter} onValueChange={(v) => setAssetFilter(v as GetScanResultsAsset)}>
            <TabsList className="bg-card border border-border h-8">
              {(['ALL', 'BTC', 'ETH', 'SOL', 'BNB'] as const).map((a) => (
                <TabsTrigger key={a} value={a} className="text-xs px-3 h-6">{a}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Live prices row */}
      <div className="stagger grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50 border-primary/15 col-span-2 md:col-span-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">BTC Mark Price</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {scanLoading ? <Skeleton className="h-8 w-28" /> : (
              <div className="text-2xl font-black font-mono tracking-tight">
                {btcAsset ? `$${btcAsset.markPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">BTC Funding</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {scanLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className={`text-2xl font-black font-mono flex items-center gap-1.5 ${btcAsset && btcAsset.fundingRatePercent > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {btcAsset && btcAsset.fundingRatePercent > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {btcAsset ? `${btcAsset.fundingRatePercent.toFixed(4)}%` : '-'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 col-span-2">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Signal Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {scanLoading ? <Skeleton className="h-8 w-full" /> : (
              <div className="flex items-center gap-5">
                <div>
                  <span className="text-2xl font-black font-mono text-emerald-400">{data?.signalCounts.underpriced ?? 0}</span>
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">BUY YES</span>
                </div>
                <div>
                  <span className="text-2xl font-black font-mono text-amber-400">{data?.signalCounts.overbought ?? 0}</span>
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">BUY NO</span>
                </div>
                <div>
                  <span className="text-2xl font-black font-mono text-muted-foreground/50">{data?.signalCounts.neutral ?? 0}</span>
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">Neutral</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Other assets strip */}
      {assetFilter === 'ALL' && data?.binanceAssets && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.binanceAssets.filter(b => b.asset !== 'BTC').map(asset => (
            <div key={asset.asset} className="rounded-md border border-border/50 bg-card/30 px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-muted-foreground font-mono">{asset.asset}</div>
                <div className="text-sm font-bold font-mono">${asset.markPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <span className={`text-xs font-mono font-semibold ${asset.fundingRatePercent > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {asset.fundingRatePercent > 0 ? '+' : ''}{asset.fundingRatePercent.toFixed(4)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top Opportunities */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-widest uppercase text-primary">Top Opportunities Right Now</h2>
          <div className="flex-1 h-px bg-border" />
          <Link href="/recommendations" className="text-xs text-muted-foreground hover:text-primary font-mono flex items-center gap-1 transition-colors">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : top3.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
            No actionable signals detected at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top3.map((rec) => <TopAlertCard key={rec.rank} rec={rec} />)}
          </div>
        )}
      </div>

      {/* Market scanner table */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Polymarket vs Binance Reality</CardTitle>
            {data?.totalMarkets != null && (
              <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
                {data.totalMarkets} markets
              </span>
            )}
          </div>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search markets..."
              className="pl-8 bg-secondary/30 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-mono text-[10px] tracking-wider w-14">ASSET</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider">MARKET QUESTION</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-right">TARGET</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-right">CROWD %</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-right">DISTANCE</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-right">SIGNAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !filteredMarkets || filteredMarkets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                      No markets found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMarkets.map((m) => (
                    <TableRow key={m.market.conditionId} className="hover:bg-secondary/15 border-border/50 text-xs">
                      <TableCell><AssetBadge tag={m.market.assetTag} /></TableCell>
                      <TableCell className="font-medium max-w-[280px] truncate text-foreground/80" title={m.market.question}>
                        {m.market.question}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {m.market.targetPrice ? `$${m.market.targetPrice.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary font-semibold">
                        {m.market.yesProbabilityPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.distanceToTargetPercent !== 0 ? (
                          <span className={m.distanceToTargetPercent > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {m.distanceToTargetPercent > 0 ? '+' : ''}{m.distanceToTargetPercent.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <SignalBadge signal={m.signal} />
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
