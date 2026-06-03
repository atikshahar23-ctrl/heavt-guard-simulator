import { useState } from "react";
import type { StockQuote } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { StockChart } from "@/components/stock-chart";
import { usePortfolio } from "@/contexts/portfolio-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { toast } from "@/hooks/use-toast";
import {
  X, TrendingUp, TrendingDown, Sparkles, Lightbulb, Newspaper, ExternalLink, ShieldAlert, Target,
} from "lucide-react";

const LEVERAGES = [1, 2, 3, 5, 10] as const;

const CATEGORY_LABEL: Record<string, string> = {
  TECH: "Technology", ENERGY: "Energy", RESOURCES: "Resources", LARGE_CAP: "Large Cap", INDEX: "Index / ETF",
};

function fmt(n: number, d = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtVolume(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function rangePos(price: number, lo: number | null | undefined, hi: number | null | undefined): number | null {
  if (lo == null || hi == null || hi === lo) return null;
  return ((price - lo) / (hi - lo)) * 100;
}

function outlook(s: StockQuote): { tone: "bull" | "bear" | "neutral"; verdict: string; detail: string } {
  const mom = s.momentum5dPercent ?? 0;
  const score = mom + s.changePercent * 0.5;
  if (score > 3) return { tone: "bull", verdict: "Bullish", detail: `Up ${mom.toFixed(1)}% over 5 sessions — momentum favors more upside near term.` };
  if (score < -3) return { tone: "bear", verdict: "Bearish", detail: `Down ${Math.abs(mom).toFixed(1)}% over 5 sessions — selling pressure likely to persist; wait or trim.` };
  return { tone: "neutral", verdict: "Neutral", detail: `Roughly flat (5d ${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%) — no clear edge yet, watch for a breakout.` };
}

const OUTLOOK_STYLE: Record<string, string> = {
  bull: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  bear: "bg-red-500/10 text-red-400 border-red-500/30",
  neutral: "bg-secondary/50 text-muted-foreground border-border",
};

interface Props {
  stock: StockQuote;
  onClose: () => void;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 px-2.5 py-2">
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono font-bold text-sm text-foreground">{value}</div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground">{sub}</div>}
    </div>
  );
}

function RangeBar({ pos, lo, hi, current }: { pos: number; lo: number; hi: number; current: number }) {
  return (
    <div className="space-y-1">
      <div className="relative h-1.5 rounded-full bg-secondary/60">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow"
          style={{ left: `calc(${Math.min(100, Math.max(0, pos))}% - 4px)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
        <span>${fmt(lo)}</span>
        <span className="text-primary">${fmt(current)}</span>
        <span>${fmt(hi)}</span>
      </div>
    </div>
  );
}

export function StockDetailPanel({ stock: s, onClose }: Props) {
  const { openStockPosition, cash } = usePortfolio();
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState<number>(1);
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [err, setErr] = useState("");

  const up = s.changePercent >= 0;
  const view = outlook(s);
  const dayPos = rangePos(s.price, s.dayLow, s.dayHigh);
  const monthPos = rangePos(s.price, s.monthLow, s.monthHigh);
  const tvUrl = `https://www.tradingview.com/symbols/${s.tradingViewSymbol}/`;
  const googleNews = `https://news.google.com/search?q=${encodeURIComponent(`${s.symbol} ${s.name} stock`)}`;
  const yahooNews = `https://finance.yahoo.com/quote/${encodeURIComponent(s.symbol)}/news`;

  function applyAuto() {
    const lv = recommendLevels(s.price, "LONG", { slPct: 0.03, tpPct: 0.06 });
    setSl(String(lv.sl));
    setTp(String(lv.tp));
    setErr("");
  }

  function buy() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setErr("Enter a valid amount"); return; }
    const slRaw = parseFloat(sl);
    const tpRaw = parseFloat(tp);
    const error = openStockPosition(
      {
        symbol: s.symbol,
        name: s.name,
        entryPrice: s.price,
        slPrice: Number.isFinite(slRaw) ? slRaw : undefined,
        tpPrice: Number.isFinite(tpRaw) ? tpRaw : undefined,
      },
      amt,
      leverage,
    );
    if (error) { setErr(error); return; }
    setErr("");
    setAmount("");
    setSl("");
    setTp("");
    toast({
      title: `Bought ${s.symbol}${leverage > 1 ? ` ${leverage}x` : ""}`,
      description: `$${amt} @ $${fmt(s.price)} (paper trade)`,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-lg text-foreground">{s.symbol}</span>
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
                {CATEGORY_LABEL[s.category] ?? s.category}
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{s.name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {/* Price */}
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono font-black text-3xl text-foreground">${fmt(s.price)}</div>
              <div className="text-[10px] font-mono text-muted-foreground">prev close ${fmt(s.previousClose)}</div>
            </div>
            <div className={`flex flex-col items-end ${up ? "text-emerald-400" : "text-red-400"}`}>
              <div className="flex items-center gap-1 font-mono font-bold text-lg">
                {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {up ? "+" : ""}{s.changePercent.toFixed(2)}%
              </div>
              <div className="text-xs font-mono opacity-80">{up ? "+" : ""}{fmt(s.change)} today</div>
            </div>
          </div>

          {/* Outlook */}
          <div className={`flex items-start gap-2 rounded-md border px-3 py-2 ${OUTLOOK_STYLE[view.tone]}`}>
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider">{view.verdict}</div>
              <div className="text-[11px] leading-snug opacity-90">{view.detail}</div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-56">
            <StockChart symbol={s.symbol} />
          </div>

          {/* Detailed metrics */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Detailed stats</div>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="5d momentum" value={s.momentum5dPercent == null ? "—" : `${s.momentum5dPercent >= 0 ? "+" : ""}${s.momentum5dPercent.toFixed(1)}%`} />
              <Metric label="Volume" value={fmtVolume(s.volume ?? null)} />
              <Metric label="Currency" value={s.currency} />
              <Metric label="Day high" value={s.dayHigh == null ? "—" : `$${fmt(s.dayHigh)}`} />
              <Metric label="Day low" value={s.dayLow == null ? "—" : `$${fmt(s.dayLow)}`} />
              <Metric label="Day range" value={dayPos == null ? "—" : `${dayPos.toFixed(0)}%`} sub="of range" />
              <Metric label="Month high" value={s.monthHigh == null ? "—" : `$${fmt(s.monthHigh)}`} />
              <Metric label="Month low" value={s.monthLow == null ? "—" : `$${fmt(s.monthLow)}`} />
              <Metric label="Month range" value={monthPos == null ? "—" : `${monthPos.toFixed(0)}%`} sub="of range" />
            </div>
            {monthPos != null && s.monthLow != null && s.monthHigh != null && (
              <div className="mt-3">
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Position in monthly range</div>
                <RangeBar pos={monthPos} lo={s.monthLow} hi={s.monthHigh} current={s.price} />
              </div>
            )}
          </div>

          {/* Quick buy */}
          <div className="rounded-lg border border-border bg-secondary/10 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-widest uppercase text-primary">Quick Buy · Paper</span>
              <span className="text-[10px] font-mono text-muted-foreground">Cash ${fmt(cash)}</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount USD"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background/60 font-mono text-sm"
              />
              <button
                onClick={buy}
                className="px-4 rounded-md bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Buy
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground mr-1">Leverage</span>
              {LEVERAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => setLeverage(l)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
                    leverage === l ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l}x
                </button>
              ))}
            </div>
            <button
              onClick={applyAuto}
              className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
            >
              <Lightbulb className="h-2.5 w-2.5" /> Auto SL/TP (3% / 6%)
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <ShieldAlert className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-red-400/70" />
                <Input
                  type="number"
                  placeholder="Stop loss"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                  className="pl-7 bg-background/60 font-mono text-xs"
                />
              </div>
              <div className="relative">
                <Target className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-emerald-400/70" />
                <Input
                  type="number"
                  placeholder="Take profit"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                  className="pl-7 bg-background/60 font-mono text-xs"
                />
              </div>
            </div>
            {err && <div className="text-[11px] font-mono text-red-400">{err}</div>}
          </div>

          {/* External links */}
          <div className="flex items-center gap-1.5">
            <a href={tvUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
              TradingView <ExternalLink className="h-3 w-3" />
            </a>
            <a href={googleNews} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
              <Newspaper className="h-3 w-3" /> Google News
            </a>
            <a href={yahooNews} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
              <Newspaper className="h-3 w-3" /> Yahoo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
