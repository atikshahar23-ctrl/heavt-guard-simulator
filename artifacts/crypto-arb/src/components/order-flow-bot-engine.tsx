import { useEffect, useRef } from "react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, resolveSizing, cashReserveFloor, intensityProfile } from "@/contexts/autotrader-context";
import { useOrderFlow } from "@/contexts/order-flow-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { toast } from "@/hooks/use-toast";

/** Source label — attributes and closes Order Flow Bot positions. */
const SOURCE = "Order Flow Bot";

/** Minimum ms between consecutive opens on the same symbol. */
const COOLDOWN_MS = 5 * 60 * 1000;
const BOOST_COOLDOWN_MS = 3 * 1000;

/** Scalp-style SL/TP for the flow bot (tight). */
const FLOW_SL_PCT = 0.015;
const FLOW_TP_PCT = 0.03;

/**
 * Headless engine for the Order Flow Bot.
 *
 * Reads the live Order Flow "feel" (computed from Binance depth + tape in real time)
 * and opens a directional LONG/SHORT paper position when the feel exceeds the
 * configured threshold and strength.  Positions are auto-closed after the
 * configured hold-time seconds (like a quick scalp).
 */
export function OrderFlowBotEngine() {
  const {
    binancePositions, cash, totalDeposited, tradeHistory,
    openBinancePosition, closeBinancePosition,
  } = usePortfolio();
  const { settings } = useAutoTrader();
  const flow = useOrderFlow();

  const boostActive = settings.boostUntil > Date.now();
  const prof = intensityProfile(settings.intensity, settings.tradeMode);
  const cooldownMs = boostActive ? BOOST_COOLDOWN_MS : Math.round(COOLDOWN_MS * prof.cooldownMult);
  const armed = settings.flowBotEnabled;

  const cooldownRef = useRef<Record<string, number>>({});
  const openedAtRef = useRef<Record<string, number>>({});

  const symbol = settings.flowBotSymbol.toUpperCase();
  const asset = symbol.replace("USDT", "");
  const m = flow.metrics;
  const now = Date.now();

  // ── Auto-close held positions after maxHoldSec ──
  useEffect(() => {
    if (!armed) return;
    const maxHoldMs = (settings.flowBotMaxHoldSec ?? 60) * 1000;
    const openFlow = binancePositions.filter(
      (p) => p.source === SOURCE && p.asset === asset,
    );
    for (const p of openFlow) {
      const openedAt = openedAtRef.current[p.id] ?? Date.now();
      if (now - openedAt >= maxHoldMs) {
        const mid = m.mid;
        if (mid > 0) {
          closeBinancePosition(p.id, mid);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binancePositions, m.mid, settings.flowBotMaxHoldSec, armed, asset]);

  // ── Auto-open on strong feel ──
  useEffect(() => {
    if (!armed) return;
    if (settings.fleetPaused) return;

    const sizing = resolveSizing(settings, cash, totalDeposited, tradeHistory, "flowbot");
    const lev = Math.max(1, sizing.leverage);
    const stake = sizing.margin;
    if (!(stake > 0)) return;

    const cashFloor = cashReserveFloor(totalDeposited, settings.cashFloorPct);

    // Daily loss guard
    if (settings.dailyStopEnabled) {
      const cap = (settings.dailyMaxLossPct / 100) * totalDeposited;
      if (cap > 0 && realizedPnlToday(tradeHistory) <= -cap) return;
    }

    const minFeel = Math.max(0, settings.flowBotMinFeel * prof.selectivityMult);
    const minStrength = Math.max(0, settings.flowBotMinStrength + prof.scoreAdd * 10);

    const openFlow = binancePositions.filter((p) => p.source === SOURCE && p.asset === asset);
    const maxOpen = Math.max(1, Math.round(settings.flowBotMaxOpen * prof.maxOpenMult));
    if (openFlow.length >= maxOpen) return;

    // Feel must be clear enough
    const feel = m.feel;
    const strength = m.feelStrength;
    const absFeel = Math.abs(feel);
    if (absFeel < minFeel) return;
    if (strength < minStrength) return;

    // Cooldown
    if (now - (cooldownRef.current[asset] ?? 0) < cooldownMs) return;

    // Cash guard
    if (cash - stake < cashFloor) return;

    // Mid price must be live
    const price = m.mid;
    if (!(price > 0)) return;

    const direction = feel > 0 ? "LONG" : "SHORT";
    const { sl, tp } = recommendLevels(price, direction, {
      slPct: FLOW_SL_PCT,
      tpPct: FLOW_TP_PCT,
    });

    const err = openBinancePosition(
      {
        asset,
        direction,
        notional: stake * lev,
        entryPrice: price,
        leverage: lev,
        slPrice: sl,
        tpPrice: tp,
        auto: true,
        source: SOURCE,
      },
      cashFloor,
    );
    if (err) return;

    cooldownRef.current[asset] = now;

    // Track opened time for the auto-close effect
    // We can't know the exact id here without ref, so we rely on the next
    // render seeing the new position and recording it.
    const toastTitle = direction === "LONG" ? `Order Flow Bot · LONG ${asset}` : `Order Flow Bot · SHORT ${asset}`;
    toast({
      title: toastTitle,
      description: `feel ${feel.toFixed(2)} · strength ${strength}% · ${lev}x · $${stake} @ $${price.toFixed(1)}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, settings, cash, binancePositions]);

  // ── Record opened-at timestamps for positions we just opened ──
  useEffect(() => {
    if (!armed) return;
    const openFlow = binancePositions.filter((p) => p.source === SOURCE && p.asset === asset);
    for (const p of openFlow) {
      if (!openedAtRef.current[p.id]) {
        openedAtRef.current[p.id] = Date.now();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binancePositions, armed, asset]);

  return null;
}

/** Sum realized PnL from trades closed today (local time). */
function realizedPnlToday(history: { pnl: number; closedAt: string }[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  let sum = 0;
  for (const t of history) {
    const ts = new Date(t.closedAt).getTime();
    if (ts >= startMs) sum += t.pnl;
  }
  return sum;
}
