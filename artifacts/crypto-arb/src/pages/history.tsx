import { useMemo, useState } from "react";
import { useGetMarketOverview, getGetMarketOverviewQueryKey } from "@workspace/api-client-react";
import {
  History as HistoryIcon, TrendingUp, TrendingDown, Trophy, Target,
  Bot, Hand, Wallet, Trash2, Activity,
} from "lucide-react";
import { usePortfolio, type ClosedTrade } from "@/contexts/portfolio-context";

type TypeFilter = "ALL" | "BINANCE" | "STOCK" | "POLYMARKET";
type ResultFilter = "ALL" | "WINS" | "LOSSES";
type SourceFilter = "ALL" | "AUTO" | "MANUAL";

function fmtUsd(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_LABEL: Record<ClosedTrade["type"], string> = {
  BINANCE: "Futures",
  STOCK: "Stock",
  POLYMARKET: "Prediction",
};

function StatCard({ label, value, sub, color, Icon }: {
  label: string; value: string; sub?: string; color?: string; Icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="font-mono text-lg font-black" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground">{sub}</div>}
    </div>
  );
}

function OpenPositions() {
  const { binancePositions, closeBinancePosition } = usePortfolio();
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of overview ?? []) m[c.asset] = c.price;
    return m;
  }, [overview]);

  if (binancePositions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-black tracking-tight flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-primary" /> Open Positions ({binancePositions.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {binancePositions.map((p) => {
          const cur = priceMap[p.asset] ?? p.entryPrice;
          const margin = p.notional / p.leverage;
          const delta = p.direction === "LONG"
            ? (cur - p.entryPrice) / p.entryPrice
            : (p.entryPrice - cur) / p.entryPrice;
          const pnl = delta * p.notional;
          const pnlPct = (pnl / margin) * 100;
          const up = pnl >= 0;
          const accent = p.direction === "LONG" ? "#22c55e" : "#ef4444";
          return (
            <div key={p.id} className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: `${accent}30` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-sm">{p.asset}</span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${accent}1a`, color: accent }}>
                    {p.direction} {p.leverage}x
                  </span>
                  {p.auto && (
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-0.5">
                      <Bot className="h-2.5 w-2.5" /> AUTO
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-[10px] font-mono text-muted-foreground">
                  <div>Entry ${fmtPrice(p.entryPrice)}</div>
                  <div>Mark ${fmtPrice(cur)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm" style={{ color: up ? "#22c55e" : "#ef4444" }}>
                    {up ? "+" : ""}${fmtUsd(pnl)}
                  </div>
                  <div className="font-mono text-[10px]" style={{ color: up ? "#22c55e" : "#ef4444" }}>
                    {up ? "+" : ""}{pnlPct.toFixed(1)}%
                  </div>
                </div>
              </div>
              <button
                onClick={() => closeBinancePosition(p.id, cur)}
                className="w-full rounded py-1.5 text-[11px] font-mono font-bold bg-secondary/60 hover:bg-secondary transition-colors"
              >
                Close @ ${fmtPrice(cur)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { tradeHistory, resetPortfolio, cash, totalDeposited } = usePortfolio();
  const [typeF, setTypeF] = useState<TypeFilter>("ALL");
  const [resultF, setResultF] = useState<ResultFilter>("ALL");
  const [sourceF, setSourceF] = useState<SourceFilter>("ALL");

  const stats = useMemo(() => {
    const n = tradeHistory.length;
    const wins = tradeHistory.filter((t) => t.pnl > 0).length;
    const losses = tradeHistory.filter((t) => t.pnl < 0).length;
    const totalPnl = tradeHistory.reduce((a, t) => a + t.pnl, 0);
    const best = tradeHistory.reduce((a, t) => Math.max(a, t.pnl), 0);
    const worst = tradeHistory.reduce((a, t) => Math.min(a, t.pnl), 0);
    const winRate = n > 0 ? (wins / n) * 100 : 0;
    const autoCount = tradeHistory.filter((t) => t.auto).length;
    const grossWin = tradeHistory.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(tradeHistory.filter((t) => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    return { n, wins, losses, totalPnl, best, worst, winRate, autoCount, profitFactor };
  }, [tradeHistory]);

  const filtered = useMemo(() => {
    return tradeHistory.filter((t) => {
      if (typeF !== "ALL" && t.type !== typeF) return false;
      if (resultF === "WINS" && t.pnl <= 0) return false;
      if (resultF === "LOSSES" && t.pnl >= 0) return false;
      if (sourceF === "AUTO" && !t.auto) return false;
      if (sourceF === "MANUAL" && t.auto) return false;
      return true;
    });
  }, [tradeHistory, typeF, resultF, sourceF]);

  const pnlColor = stats.totalPnl > 0 ? "#22c55e" : stats.totalPnl < 0 ? "#ef4444" : undefined;

  function exit(t: ClosedTrade) {
    if (t.exit === "TP") return { label: "TP", color: "#22c55e" };
    if (t.exit === "SL") return { label: "SL", color: "#ef4444" };
    return { label: "Manual", color: "#a1a1aa" };
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">Trade History</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your complete demo-trading track record — every closed position, win rate &amp; P&amp;L.
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm("Reset demo portfolio? This clears balance, open positions and all trade history.")) resetPortfolio();
          }}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-mono font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors flex-shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      {/* Account row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Balance" value={`$${fmtUsd(cash, 0)}`} Icon={Wallet} sub={`Deposited $${fmtUsd(totalDeposited, 0)}`} />
        <StatCard label="Realized P&L" value={`${stats.totalPnl >= 0 ? "+" : ""}$${fmtUsd(stats.totalPnl)}`} color={pnlColor} Icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown} sub={`${stats.n} closed trades`} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} Icon={Trophy} sub={`${stats.wins}W · ${stats.losses}L`} />
        <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} Icon={Target} sub={`${stats.autoCount} auto-traded`} />
      </div>

      {/* Best/Worst row */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Best Trade" value={`+$${fmtUsd(stats.best)}`} color="#22c55e" Icon={TrendingUp} />
        <StatCard label="Worst Trade" value={`-$${fmtUsd(Math.abs(stats.worst))}`} color="#ef4444" Icon={TrendingDown} />
      </div>

      <OpenPositions />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterGroup label="Type" value={typeF} setValue={(v) => setTypeF(v as TypeFilter)} options={["ALL", "BINANCE", "STOCK", "POLYMARKET"]} render={(o) => (o === "ALL" ? "All" : TYPE_LABEL[o as ClosedTrade["type"]])} />
        <FilterGroup label="Result" value={resultF} setValue={(v) => setResultF(v as ResultFilter)} options={["ALL", "WINS", "LOSSES"]} render={(o) => o[0] + o.slice(1).toLowerCase()} />
        <FilterGroup label="Source" value={sourceF} setValue={(v) => setSourceF(v as SourceFilter)} options={["ALL", "AUTO", "MANUAL"]} render={(o) => o[0] + o.slice(1).toLowerCase()} />
      </div>

      {/* Table */}
      {tradeHistory.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <HistoryIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No closed trades yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Open a demo trade from the Scalp Signals or Simulator page to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">No trades match these filters.</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 border-b border-border text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>Trade</span><span className="text-right">Exit</span><span className="text-right">Margin</span><span className="text-right">P&amp;L</span><span className="text-right">When</span>
          </div>
          <div className="divide-y divide-border/60">
            {filtered.map((t) => {
              const up = t.pnl >= 0;
              const ex = exit(t);
              const pct = t.cost > 0 ? (t.pnl / t.cost) * 100 : 0;
              return (
                <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 px-3 py-2.5 items-center text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">{TYPE_LABEL[t.type]}</span>
                      {t.auto ? (
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-0.5"><Bot className="h-2.5 w-2.5" /> AUTO</span>
                      ) : (
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/40 text-muted-foreground flex items-center gap-0.5"><Hand className="h-2.5 w-2.5" /> MANUAL</span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-foreground/90 truncate mt-0.5">{t.description}</div>
                  </div>
                  <div className="text-right sm:order-none order-last col-span-2 sm:col-span-1">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${ex.color}1a`, color: ex.color }}>{ex.label}</span>
                  </div>
                  <div className="hidden sm:block text-right font-mono text-[11px] text-muted-foreground">${fmtUsd(t.cost)}</div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold" style={{ color: up ? "#22c55e" : "#ef4444" }}>{up ? "+" : ""}${fmtUsd(t.pnl)}</div>
                    <div className="font-mono text-[10px]" style={{ color: up ? "#22c55e" : "#ef4444" }}>{up ? "+" : ""}{pct.toFixed(1)}%</div>
                  </div>
                  <div className="hidden sm:block text-right font-mono text-[10px] text-muted-foreground">{timeAgo(t.closedAt)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, value, setValue, options, render }: {
  label: string; value: string; setValue: (v: string) => void; options: string[]; render: (o: string) => string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => setValue(o)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
              value === o ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
            style={value === o ? { boxShadow: "inset 0 0 0 1px hsl(43 74% 52% / 0.3)" } : {}}
          >
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
