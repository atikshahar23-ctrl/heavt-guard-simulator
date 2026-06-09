import { useState } from "react";
import {
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  type StockRecommendation,
} from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";
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
  const { lang } = useLanguage();
  const { data: recs, isLoading } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: 60000 },
  });

  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const top = topTradable(recs);
  const disabled = isLoading || !top;

  function execute() {
    if (!top) { setStatus({ kind: "err", msg: t("qt.noRec", lang) }); return; }
    const direction = top.action === "SELL" ? "SHORT" : "LONG";
    const amount = Math.min(QUICK_TRADE_MAX_USD, Math.max(0, cash * QUICK_TRADE_CASH_FRACTION));
    if (amount < 1) { setStatus({ kind: "err", msg: t("qt.noCash", lang) }); return; }

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
      msg: `${direction === "LONG" ? t("sim.buy", lang) : t("qt.sell", lang)} ${top.symbol} ${t("qt.forUsd", lang)}${amount.toFixed(0)} → ${activeWalletName}`,
    });
    setTimeout(() => setStatus(null), 4000);
  }

  if (compact) {
    return (
      <button
        onClick={execute}
        disabled={disabled}
        title={top ? `${t("qt.quickTradeTitle", lang)}: ${top.action} ${top.symbol}` : t("qt.noRecShort", lang)}
        className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2 py-1 text-[11px] font-mono font-bold text-primary hover:bg-primary/25 disabled:opacity-40 transition-colors"
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        {t("qt.fast", lang)}
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
        {t("qt.executeTop", lang)}
      </button>
      {top && (
        <p className="text-[10px] font-mono text-muted-foreground text-center">
          {top.action === "SELL" ? t("qt.sellShort", lang) : t("qt.buyLong", lang)} {top.symbol} @ ${top.price.toFixed(2)} ·
          {" "}{t("qt.tenPctCash", lang)} · {t("qt.autoSlTp", lang)}
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
