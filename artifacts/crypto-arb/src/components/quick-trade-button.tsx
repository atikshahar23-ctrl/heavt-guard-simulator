import { useState } from "react";
import {
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  type StockRecommendation,
} from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { Zap, Check, AlertTriangle, Loader2 } from "lucide-react";

/** Fraction of available cash committed by a one-click quick trade. */
const QUICK_TRADE_CASH_FRACTION = 0.1;
const QUICK_TRADE_MAX_USD = 2000;

function topTradable(recs: StockRecommendation[] | undefined): StockRecommendation | null {
  if (!recs) return null;
  return recs.find((r) => r.action === "BUY" || r.action === "SELL") ?? null;
}

/**
 * One-click execution of the highest-ranked actionable stock recommendation into
 * the ACTIVE wallet, with default position sizing and auto SL/TP. BUY → LONG,
 * SELL → SHORT. `compact` renders an icon-only trigger for tight headers.
 */
export function QuickTradeButton({ compact = false }: { compact?: boolean }) {
  const { cash, openStockPosition, activeWalletName } = usePortfolio();
  const { data: recs, isLoading } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: 60000 },
  });

  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const top = topTradable(recs);
  const disabled = isLoading || !top;

  function execute() {
    if (!top) { setStatus({ kind: "err", msg: "אין כרגע המלצה זמינה לביצוע" }); return; }
    const direction = top.action === "SELL" ? "SHORT" : "LONG";
    const amount = Math.min(QUICK_TRADE_MAX_USD, Math.max(0, cash * QUICK_TRADE_CASH_FRACTION));
    if (amount < 1) { setStatus({ kind: "err", msg: "אין מספיק מזומן בארנק" }); return; }

    const { sl, tp } = recommendLevels(top.price, direction, { slPct: 0.03, tpPct: 0.06 });
    const err = openStockPosition(
      {
        symbol: top.symbol,
        name: top.name,
        direction,
        entryPrice: top.price,
        slPrice: sl,
        tpPrice: tp,
        source: "Quick Trade",
      },
      amount,
    );
    if (err) { setStatus({ kind: "err", msg: err }); return; }
    setStatus({
      kind: "ok",
      msg: `${direction === "LONG" ? "קנייה" : "מכירה"} ${top.symbol} ב-$${amount.toFixed(0)} → ${activeWalletName}`,
    });
    setTimeout(() => setStatus(null), 4000);
  }

  if (compact) {
    return (
      <button
        onClick={execute}
        disabled={disabled}
        title={top ? `מסחר מהיר: ${top.action} ${top.symbol}` : "אין המלצה זמינה"}
        className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2 py-1 text-[11px] font-mono font-bold text-primary hover:bg-primary/25 disabled:opacity-40 transition-colors"
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        מהיר
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={execute}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/15 px-4 py-2.5 text-sm font-mono font-black text-primary hover:bg-primary/25 disabled:opacity-40 transition-all active:scale-[0.99]"
        style={{ boxShadow: top ? "0 0 24px hsl(207 30% 70% / 0.12)" : undefined }}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        מסחר מהיר — בצע את ההמלצה המובילה
      </button>
      {top && (
        <p className="text-[10px] font-mono text-muted-foreground text-center">
          {top.action === "SELL" ? "מכירה (SHORT)" : "קנייה (LONG)"} {top.symbol} @ ${top.price.toFixed(2)} ·
          {" "}10% מהמזומן · SL/TP אוטומטי 3%/6%
        </p>
      )}
      {status && (
        <p className={`flex items-center justify-center gap-1 text-[11px] font-mono ${status.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {status.kind === "ok" ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {status.msg}
        </p>
      )}
    </div>
  );
}
