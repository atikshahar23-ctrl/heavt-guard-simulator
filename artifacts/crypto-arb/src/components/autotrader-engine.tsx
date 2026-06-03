import { useEffect, useRef } from "react";
import {
  useGetScalpSignals, getGetScalpSignalsQueryKey,
  useGetMarketOverview, getGetMarketOverviewQueryKey,
} from "@workspace/api-client-react";
import type { ScalpSignal } from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, type ScalpConfidence } from "@/contexts/autotrader-context";
import { useFavorites } from "@/contexts/favorites-context";
import { toast } from "@/hooks/use-toast";

const CONF_RANK: Record<ScalpConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
/** Don't re-open the same asset within this window after an auto action. */
const COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Headless engine mounted once under the providers. It (1) runs SL/TP checks
 * across all open Binance demo positions using live prices, and (2) opens new
 * auto-trades from scalp signals when the Auto-Trader is enabled.
 */
export function AutoTraderEngine() {
  const { binancePositions, cash, openBinancePosition, checkSlTp } = usePortfolio();
  const { settings } = useAutoTrader();
  const { isFavorite } = useFavorites();

  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: signals } = useGetScalpSignals({
    query: {
      queryKey: getGetScalpSignalsQueryKey(),
      refetchInterval: settings.enabled ? 60000 : false,
      staleTime: 45000,
      enabled: settings.enabled,
    },
  });

  const cooldownRef = useRef<Record<string, number>>({});

  // Build a live price map and run SL/TP auto-exit globally.
  const priceMap: Record<string, number> = {};
  for (const c of overview ?? []) priceMap[c.asset] = c.price;

  useEffect(() => {
    if (Object.keys(priceMap).length > 0) checkSlTp(priceMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, checkSlTp]);

  // Auto-trade evaluation.
  useEffect(() => {
    if (!settings.enabled || !signals || signals.length === 0) return;

    const now = Date.now();
    const margin = settings.marginPerTrade;
    if (!(margin > 0) || !(settings.leverage >= 1)) return;

    let autoOpen = binancePositions.filter((p) => p.auto).length;
    let availableCash = cash;
    const openAssets = new Set(binancePositions.map((p) => p.asset));

    const candidates = (signals as ScalpSignal[])
      .filter((s) => s.direction !== "NEUTRAL")
      .filter((s) => CONF_RANK[s.confidence] >= CONF_RANK[settings.minConfidence])
      .filter((s) => (s.direction === "LONG" ? settings.allowLong : settings.allowShort))
      .filter((s) => !settings.favoritesOnly || isFavorite(`coin:${s.asset}`))
      .filter((s) => !openAssets.has(s.asset))
      .filter((s) => {
        const last = cooldownRef.current[s.asset] ?? 0;
        return now - last > COOLDOWN_MS;
      })
      .filter((s) => Number.isFinite(s.entry) && s.entry > 0)
      .sort((a, b) => b.score - a.score);

    for (const s of candidates) {
      if (autoOpen >= settings.maxOpenPositions) break;
      if (availableCash < margin) break;

      const notional = margin * settings.leverage;
      const err = openBinancePosition({
        asset: s.asset,
        direction: s.direction as "LONG" | "SHORT",
        notional,
        entryPrice: s.entry,
        leverage: settings.leverage,
        slPrice: s.stopLoss,
        tpPrice: s.takeProfit,
        auto: true,
        source: "Scalp signal",
      });
      if (err) continue;

      cooldownRef.current[s.asset] = now;
      availableCash -= margin;
      autoOpen += 1;
      toast({
        title: `Auto-Trade · ${s.direction} ${s.asset}`,
        description: `Opened ${settings.leverage}x · $${margin} margin @ $${s.entry} (${s.confidence})`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, settings, cash, binancePositions, isFavorite]);

  return null;
}
