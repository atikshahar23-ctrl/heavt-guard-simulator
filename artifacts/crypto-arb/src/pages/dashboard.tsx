import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetScanResults, getGetScanResultsQueryKey,
  useGetRecommendations, getGetRecommendationsQueryKey,
  ScanResult, GetScanResultsAsset, Recommendation,
} from "@workspace/api-client-react";
import {
  RefreshCw, TrendingUp, TrendingDown, Search, Zap, ArrowRight,
  Bot, Layers, Activity, ShieldCheck, BarChart3, Cpu,
} from "lucide-react";
import { CryptoIcon } from "@/components/crypto-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefresh } from "@/contexts/refresh-context";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader } from "@/contexts/autotrader-context";

/* ─────────────────────────── Matrix Rain Canvas ─────────────────────────── */
const MATRIX_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ₿ETHSOLBNBXRP⚡↑↓×%$#אבגדהוזחטיכלמנסעפצקרשת";

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let cols = 0;
    const drops: number[] = [];
    const fontSize = 13;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      cols = Math.floor(canvas.width / fontSize);
      drops.length = 0;
      for (let i = 0; i < cols; i++) drops[i] = Math.random() * -60;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      if (!canvas || !ctx) return;
      ctx.fillStyle = "rgba(10, 10, 10, 0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px 'Space Mono', monospace`;

      for (let i = 0; i < cols; i++) {
        const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const y = drops[i] * fontSize;

        const head = drops[i] > 4;
        if (head) {
          ctx.fillStyle = "rgba(184, 134, 46, 0.9)";
        } else {
          const alpha = 0.08 + Math.random() * 0.22;
          ctx.fillStyle = `rgba(184, 134, 46, ${alpha})`;
        }
        ctx.fillText(ch, i * fontSize, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.4 + Math.random() * 0.3;
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
      aria-hidden
    />
  );
}

/* ──────────────────────────── Helper Components ──────────────────────────── */
function AssetBadge({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    BTC: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    ETH: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    SOL: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    BNB: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 font-mono text-[10px] ${
        colors[tag] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      <CryptoIcon asset={tag} size={14} /> {tag}
    </Badge>
  );
}

function SignalBadge({ signal }: { signal: ScanResult["markets"][0]["signal"] }) {
  if (signal.type === "overbought_sentiment")
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25 text-[10px]">
        OVERBOUGHT
      </Badge>
    );
  if (signal.type === "underpriced_probability")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25 text-[10px]">
        UNDERPRICED
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground border-muted text-[10px]">
      NEUTRAL
    </Badge>
  );
}

function TopAlertCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const isBuyYes = rec.action === "BUY_YES";
  const isBuyNo = rec.action === "BUY_NO";

  return (
    <Link href="/recommendations">
      <div className="group relative rounded-lg border border-primary/20 bg-background/60 backdrop-blur-sm p-4 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-primary/50 to-transparent" />
        <div className="absolute top-2 right-2 text-[10px] font-mono text-primary/30">#{rank}</div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-black tracking-tight ${
                isBuyYes ? "text-emerald-400" : isBuyNo ? "text-amber-400" : "text-muted-foreground"
              }`}
            >
              {isBuyYes ? "BUY YES" : isBuyNo ? "BUY NO" : "WATCH"}
            </span>
            <AssetBadge tag={rec.market.assetTag} />
          </div>
          <span
            className={`text-sm font-black font-mono ${
              isBuyYes ? "text-emerald-400" : isBuyNo ? "text-amber-400" : "text-foreground"
            }`}
          >
            {rec.potentialReturn >= 100 ? "100×+" : `${rec.potentialReturn.toFixed(1)}×`}
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {rec.market.question}
        </p>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <span className="text-primary/70">Edge {rec.edge.toFixed(0)}pts</span>
            <span>|</span>
            <span>{rec.market.yesProbabilityPercent.toFixed(1)}% crowd</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────── System Stat Tile ────────────────────────────── */
function SystemTile({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  accent?: "gold" | "green" | "red" | "blue";
}) {
  const accentCls = {
    gold: "text-primary",
    green: "text-emerald-400",
    red: "text-red-400",
    blue: "text-sky-400",
  }[accent ?? "gold"];

  const inner = (
    <div className="relative flex flex-col gap-2 rounded-lg border border-primary/20 bg-background/70 backdrop-blur-sm p-4 overflow-hidden transition-all hover:border-primary/40 hover:bg-primary/5 h-full">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/5 blur-xl" />
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accentCls}`} />
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{label}</span>
      </div>
      <div className={`text-2xl font-black font-mono tracking-tight ${accentCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground font-mono">{sub}</div>}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ═══════════════════════════════════ PAGE ════════════════════════════════════ */
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
      },
    }
  );

  const { data: topRecs, isLoading: recsLoading } = useGetRecommendations({
    query: {
      queryKey: getGetRecommendationsQueryKey(),
      refetchInterval: intervalFor(60000, 30000),
    },
  });

  const { cash, totalDeposited, binancePositions, stockPositions, polyPositions, tradeHistory } =
    usePortfolio();
  const { settings } = useAutoTrader();

  const isFetching = scanFetching;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isFetching) {
      setCountdown(Math.round(scanInterval / 1000));
    } else {
      timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [isFetching, scanInterval]);

  const btcAsset = useMemo(
    () => data?.binanceAssets?.find((b) => b.asset === "BTC"),
    [data],
  );
  const filteredMarkets = useMemo(
    () =>
      data?.markets?.filter((m) =>
        m.market.question.toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );
  const top3 = useMemo(() => topRecs?.slice(0, 3) ?? [], [topRecs]);

  const openPos = binancePositions.length + stockPositions.length + polyPositions.length;
  const winRate = useMemo(() => {
    if (tradeHistory.length === 0) return null;
    const closedWins = tradeHistory.filter((t) => t.pnl > 0).length;
    return Math.round((closedWins / tradeHistory.length) * 100);
  }, [tradeHistory]);

  const portfolioValue = useMemo(() => {
    return cash;
  }, [cash]);

  const pnlPercent =
    totalDeposited > 0 ? ((portfolioValue - totalDeposited) / totalDeposited) * 100 : 0;

  const activeBots = Object.values(settings.botStats).filter((s) => s.trades > 0).length;
  const botsArmed = settings.enabled;

  return (
    <div className="relative min-h-screen p-4 md:p-6 space-y-5 md:space-y-6 max-w-7xl mx-auto">

      {/* ── Matrix rain lives behind everything, clipped to page container ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <MatrixRain />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/60" />
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-primary uppercase">
              Sentinel Terminal — v2.0
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400">ONLINE</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight" style={{ textShadow: "0 0 30px hsl(43 74% 52% / 0.4)" }}>
            Market Scanner
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono" dir="rtl">
            סקאן בזמן אמת · פיוצ׳רס Binance × סנטימנט Polymarket · בוטים × ניהול סיכונים
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono bg-background/70 backdrop-blur-sm border border-primary/20 px-3 py-1.5 rounded">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            <span className={isFetching ? "text-primary" : "text-muted-foreground"}>
              {isFetching ? "SCANNING..." : `REFRESH ${countdown}s`}
            </span>
          </div>
          <Tabs value={assetFilter} onValueChange={(v) => setAssetFilter(v as GetScanResultsAsset)}>
            <TabsList className="bg-background/70 backdrop-blur-sm border border-primary/20 h-8">
              {(["ALL", "BTC", "ETH", "SOL", "BNB"] as const).map((a) => (
                <TabsTrigger key={a} value={a} className="text-xs px-3 h-6 font-mono">
                  {a}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ── System Overview Tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2 md:col-span-3 lg:col-span-2">
          <SystemTile
            icon={BarChart3}
            label="Portfolio Balance"
            value={`$${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub={
              <span className={pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}>
                {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}% from deposit
              </span>
            }
            href="/simulator"
          />
        </div>
        <SystemTile
          icon={Layers}
          label="Open Positions"
          value={openPos}
          sub={`${binancePositions.length} crypto · ${stockPositions.length} stocks · ${polyPositions.length} poly`}
          href="/simulator"
          accent="blue"
        />
        <SystemTile
          icon={Activity}
          label="Win Rate"
          value={winRate !== null ? `${winRate}%` : "—"}
          sub={`${tradeHistory.length} סגורות`}
          href="/simulator"
          accent={winRate !== null && winRate >= 50 ? "green" : "red"}
        />
        <SystemTile
          icon={Bot}
          label="Bots"
          value={botsArmed ? "ARMED" : "OFF"}
          sub={`${activeBots} active · ${Object.keys(settings.botStats).length} tracked`}
          href="/bots"
          accent={botsArmed ? "green" : "red"}
        />
        <SystemTile
          icon={ShieldCheck}
          label="Signals Now"
          value={data ? data.signalCounts.underpriced + data.signalCounts.overbought : "—"}
          sub={
            data
              ? `${data.signalCounts.underpriced} BUY · ${data.signalCounts.overbought} NO`
              : "loading..."
          }
          accent="gold"
        />
      </div>

      {/* ── BTC live price row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-background/70 backdrop-blur-sm border-primary/20 col-span-2 md:col-span-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
              BTC Mark Price
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {scanLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div
                className="text-2xl font-black font-mono tracking-tight text-primary"
                style={{ textShadow: "0 0 20px hsl(43 74% 52% / 0.5)" }}
              >
                {btcAsset
                  ? `$${btcAsset.markPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : "—"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background/70 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
              BTC Funding
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {scanLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div
                className={`text-2xl font-black font-mono flex items-center gap-1.5 ${
                  btcAsset && btcAsset.fundingRatePercent > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {btcAsset && btcAsset.fundingRatePercent > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {btcAsset ? `${btcAsset.fundingRatePercent.toFixed(4)}%` : "—"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background/70 backdrop-blur-sm border-primary/20 col-span-2">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
              Signal Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {scanLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {data?.signalCounts.underpriced ?? 0}
                  </span>
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">
                    BUY YES
                  </span>
                </div>
                <div>
                  <span className="text-2xl font-black font-mono text-amber-400">
                    {data?.signalCounts.overbought ?? 0}
                  </span>
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">
                    BUY NO
                  </span>
                </div>
                <div>
                  <span className="text-2xl font-black font-mono text-muted-foreground/50">
                    {data?.signalCounts.neutral ?? 0}
                  </span>
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">
                    Neutral
                  </span>
                </div>
                <div className="flex-1" />
                {data?.totalMarkets != null && (
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {data.totalMarkets} markets scanned
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Other assets strip ── */}
      {assetFilter === "ALL" && data?.binanceAssets && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.binanceAssets
            .filter((b) => b.asset !== "BTC")
            .map((asset) => (
              <div
                key={asset.asset}
                className="rounded-md border border-primary/15 bg-background/60 backdrop-blur-sm px-3 py-2 flex items-center justify-between hover:border-primary/35 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CryptoIcon asset={asset.asset} size={24} />
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {asset.asset}
                    </div>
                    <div className="text-sm font-bold font-mono">
                      ${asset.markPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-mono font-semibold ${
                    asset.fundingRatePercent > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {asset.fundingRatePercent > 0 ? "+" : ""}
                  {asset.fundingRatePercent.toFixed(4)}%
                </span>
              </div>
            ))}
        </div>
      )}

      {/* ── Top Opportunities ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-mono tracking-[0.2em] text-primary uppercase">
              Top Opportunities
            </span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <Link
            href="/recommendations"
            className="text-xs text-muted-foreground hover:text-primary font-mono flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : top3.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-primary/15 rounded-lg font-mono">
            // NO ACTIONABLE SIGNALS DETECTED
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top3.map((rec, i) => (
              <TopAlertCard key={rec.rank} rec={rec} rank={i + 1} />
            ))}
          </div>
        )}
      </div>

      {/* ── Market scanner table ── */}
      <Card className="border-primary/15 bg-background/70 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono tracking-wide">
              Polymarket × Binance Reality
            </CardTitle>
            {data?.totalMarkets != null && (
              <span className="text-[10px] font-mono text-muted-foreground bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                {data.totalMarkets}
              </span>
            )}
          </div>
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search markets..."
              className="pl-8 bg-background/50 border-primary/20 h-8 text-xs font-mono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border border-primary/15 overflow-hidden">
            <Table>
              <TableHeader className="bg-primary/5">
                <TableRow className="hover:bg-transparent border-primary/15">
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
                    <TableRow key={i} className="border-primary/10">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !filteredMarkets || filteredMarkets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground text-xs font-mono"
                    >
                      // NO MARKETS FOUND
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMarkets.map((m) => (
                    <TableRow
                      key={m.market.conditionId}
                      className="hover:bg-primary/5 border-primary/10 text-xs transition-colors"
                    >
                      <TableCell>
                        <AssetBadge tag={m.market.assetTag} />
                      </TableCell>
                      <TableCell
                        className="font-medium max-w-[280px] truncate text-foreground/80"
                        title={m.market.question}
                      >
                        {m.market.question}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {m.market.targetPrice
                          ? `$${m.market.targetPrice.toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary font-semibold">
                        {m.market.yesProbabilityPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.distanceToTargetPercent !== 0 ? (
                          <span
                            className={
                              m.distanceToTargetPercent > 0 ? "text-emerald-400" : "text-red-400"
                            }
                          >
                            {m.distanceToTargetPercent > 0 ? "+" : ""}
                            {m.distanceToTargetPercent.toFixed(2)}%
                          </span>
                        ) : (
                          "—"
                        )}
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
