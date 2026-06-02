import { useState, useEffect } from "react";
import { useGetRecommendations, getGetRecommendationsQueryKey, Recommendation } from "@workspace/api-client-react";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Zap, Target, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ActionLabel({ action }: { action: Recommendation['action'] }) {
  if (action === 'BUY_YES') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-2xl font-black tracking-tight text-emerald-400">BUY YES</span>
      </div>
    );
  }
  if (action === 'BUY_NO') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-2xl font-black tracking-tight text-amber-400">BUY NO</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
      <span className="text-2xl font-black tracking-tight text-muted-foreground">WATCH</span>
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: Recommendation['confidence'] }) {
  if (confidence === 'HIGH') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
        <Zap className="h-2.5 w-2.5" /> HIGH
      </span>
    );
  }
  if (confidence === 'MEDIUM') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        MEDIUM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border">
      LOW
    </span>
  );
}

function EdgeBar({ edge, max = 60 }: { edge: number; max?: number }) {
  const pct = Math.min(100, (edge / max) * 100);
  const color = pct > 65 ? '#22c55e' : pct > 35 ? '#f59e0b' : '#64748b';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{edge.toFixed(0)}pts</span>
    </div>
  );
}

function AssetBadge({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    BTC: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    ETH: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    SOL: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    BNB: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${colors[tag] ?? 'bg-muted/30 text-muted-foreground border-border'}`}>
      {tag}
    </span>
  );
}

function MetricBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">{label}</span>
      <span className={`font-mono font-bold text-sm ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function TradeCard({ rec, isTop }: { rec: Recommendation; isTop: boolean }) {
  const isBuyYes = rec.action === 'BUY_YES';
  const isBuyNo = rec.action === 'BUY_NO';

  const accentBorder = isTop
    ? (isBuyYes ? 'border-l-emerald-500' : isBuyNo ? 'border-l-amber-500' : 'border-l-primary')
    : 'border-l-border';

  const accentBg = isTop
    ? (isBuyYes ? 'bg-emerald-500/5' : isBuyNo ? 'bg-amber-500/5' : 'bg-primary/5')
    : 'bg-card/40';

  const distanceAbs = Math.abs(rec.distanceToTargetPercent);
  const distanceColor = rec.distanceToTargetPercent > 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className={`rounded-lg border border-border border-l-4 ${accentBorder} ${accentBg} overflow-hidden transition-all hover:border-l-4 hover:shadow-lg hover:shadow-black/20`}>
      <div className="p-5 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-5">

        {/* Left: rank + action */}
        <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:gap-3 lg:w-36">
          <div className="flex items-center gap-2 lg:gap-0 lg:flex-col lg:items-start">
            <span className="text-3xl font-black font-mono text-muted-foreground/30 leading-none">
              #{rec.rank}
            </span>
          </div>
          <div className="space-y-2">
            <ActionLabel action={rec.action} />
            <div className="flex items-center gap-2 flex-wrap">
              <AssetBadge tag={rec.market.assetTag} />
              <ConfidencePill confidence={rec.confidence} />
            </div>
          </div>
        </div>

        {/* Center: question + rationale */}
        <div className="space-y-3 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
            {rec.market.question}
          </p>
          <div className={`text-xs leading-relaxed p-3 rounded border-l-2 ${isBuyYes ? 'border-l-emerald-500/50 bg-emerald-500/5 text-emerald-100/80' : isBuyNo ? 'border-l-amber-500/50 bg-amber-500/5 text-amber-100/80' : 'border-l-border bg-secondary/20 text-muted-foreground'}`}>
            {rec.rationale}
          </div>

          {/* Edge bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Market Edge</span>
              <span className="text-[10px] font-mono text-muted-foreground">Mispricing vs rational probability</span>
            </div>
            <EdgeBar edge={rec.edge} />
          </div>
        </div>

        {/* Right: key numbers */}
        <div className="lg:w-44 grid grid-cols-2 lg:grid-cols-1 gap-3">
          {/* Potential return — most prominent */}
          <div className={`col-span-2 lg:col-span-1 rounded-md px-3 py-2 border ${isBuyYes ? 'bg-emerald-500/10 border-emerald-500/20' : isBuyNo ? 'bg-amber-500/10 border-amber-500/20' : 'bg-secondary/30 border-border'}`}>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Potential Return</span>
            <div className={`text-2xl font-black font-mono mt-0.5 ${isBuyYes ? 'text-emerald-400' : isBuyNo ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {rec.potentialReturn >= 100 ? '100×+' : `${rec.potentialReturn.toFixed(1)}×`}
            </div>
            <span className="text-[10px] text-muted-foreground">entry @ ${rec.entryPrice.toFixed(3)}</span>
          </div>

          <MetricBox
            label="Crowd Prob"
            value={`${rec.market.yesProbabilityPercent.toFixed(1)}%`}
          />
          <MetricBox
            label="Distance"
            value={`${rec.distanceToTargetPercent > 0 ? '+' : ''}${rec.distanceToTargetPercent.toFixed(1)}%`}
            accent={distanceAbs < 2}
          />
          <MetricBox
            label="Mark Price"
            value={`$${rec.markPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <MetricBox
            label="Target"
            value={rec.market.targetPrice ? `$${rec.market.targetPrice.toLocaleString()}` : '-'}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryBar({ recs }: { recs: Recommendation[] }) {
  const highCount = recs.filter(r => r.confidence === 'HIGH').length;
  const buyYesCount = recs.filter(r => r.action === 'BUY_YES').length;
  const buyNoCount = recs.filter(r => r.action === 'BUY_NO').length;
  const topReturn = recs.length > 0 ? Math.max(...recs.map(r => r.potentialReturn)) : 0;
  const avgEdge = recs.length > 0 ? recs.reduce((s, r) => s + r.edge, 0) / recs.length : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="col-span-2 md:col-span-1 flex flex-col bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
        <span className="text-[10px] font-mono text-primary/70 uppercase tracking-wider">High Confidence</span>
        <span className="text-2xl font-black font-mono text-primary">{highCount}</span>
      </div>
      <div className="flex flex-col bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-3">
        <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" />Buy YES</span>
        <span className="text-2xl font-black font-mono text-emerald-400">{buyYesCount}</span>
      </div>
      <div className="flex flex-col bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
        <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider flex items-center gap-1"><TrendingDown className="h-2.5 w-2.5" />Buy NO</span>
        <span className="text-2xl font-black font-mono text-amber-400">{buyNoCount}</span>
      </div>
      <div className="flex flex-col bg-card border border-border rounded-lg px-4 py-3">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Avg Edge</span>
        <span className="text-2xl font-black font-mono text-foreground">{avgEdge.toFixed(0)}<span className="text-xs font-normal">pts</span></span>
      </div>
      <div className="flex flex-col bg-card border border-border rounded-lg px-4 py-3">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Top Return</span>
        <span className="text-2xl font-black font-mono text-foreground">{topReturn >= 100 ? '100×+' : `${topReturn.toFixed(1)}×`}</span>
      </div>
    </div>
  );
}

export default function TradeDeskPage() {
  const [countdown, setCountdown] = useState(60);
  const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  const { data: recommendations, isLoading, isFetching } = useGetRecommendations({
    query: {
      queryKey: getGetRecommendationsQueryKey(),
      refetchInterval: 60000,
    }
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isFetching) {
      setCountdown(60);
    } else {
      timer = setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isFetching]);

  const filtered = recommendations?.filter(r =>
    confidenceFilter === 'ALL' ? true : r.confidence === confidenceFilter
  ) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Trade Desk</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Ranked arbitrage signals — ranked by edge size and confidence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Confidence filter */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs font-mono">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setConfidenceFilter(level)}
                className={`px-3 py-1.5 transition-colors ${confidenceFilter === level ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded border border-border text-muted-foreground">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
            {isFetching ? 'Scanning...' : `${countdown}s`}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : !recommendations || recommendations.length === 0 ? (
        <Card className="border-border border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
            <h3 className="text-lg font-semibold text-foreground">No active signals</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              No crowd mispricing detected right now. The scanner refreshes every 60 seconds.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryBar recs={recommendations} />

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No {confidenceFilter} confidence signals at this time.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Section headers per confidence group */}
              {(['HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
                const levelRecs = filtered.filter(r => r.confidence === level);
                if (levelRecs.length === 0) return null;
                return (
                  <div key={level} className="space-y-2">
                    <div className="flex items-center gap-3 pt-2">
                      {level === 'HIGH' && <AlertTriangle className="h-3.5 w-3.5 text-primary" />}
                      {level === 'MEDIUM' && <Target className="h-3.5 w-3.5 text-blue-400" />}
                      <span className={`text-[11px] font-bold tracking-widest uppercase ${level === 'HIGH' ? 'text-primary' : level === 'MEDIUM' ? 'text-blue-400' : 'text-muted-foreground'}`}>
                        {level} CONFIDENCE — {levelRecs.length} signal{levelRecs.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2">
                      {levelRecs.map((rec) => (
                        <TradeCard key={rec.rank} rec={rec} isTop={rec.rank === 1 && level === 'HIGH'} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
