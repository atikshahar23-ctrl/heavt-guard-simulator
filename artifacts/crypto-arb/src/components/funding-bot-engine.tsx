import { useEffect, useRef } from "react";
import {
  useGetFundingOpportunities, getGetFundingOpportunitiesQueryKey,
} from "@workspace/api-client-react";
import type { FundingOpportunity } from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, cashReserveFloor, intensityProfile } from "@/contexts/autotrader-context";
import { toast } from "@/hooks/use-toast";

/** Don't re-open the same asset within this window after an auto action. */
const COOLDOWN_MS = 15 * 60 * 1000;
const BOOST_COOLDOWN_MS = 5 * 1000;

/** Source label — also used to attribute and close funding bot positions. */
const SOURCE = "Funding Arb Agent";

/** Accrue simulated funding on this cadence (independent of arm state). */
const ACCRUAL_INTERVAL_MS = 30 * 1000;

/**
 * Headless engine for the Funding Arbitrage Agent. It opens delta-neutral
 * cash-and-carry paper pairs (base leg + opposite perp leg) on the highest
 * annualized-funding opportunities, then accrues simulated funding into every
 * open funding position on a steady timer. It is fully isolated from the other
 * bot engines and honors the per-bot arm/disarm flag plus the fleet cash floor.
 */
export function FundingBotEngine() {
  const {
    fundingPositions, cash, totalDeposited,
    openFundingPosition, accrueFunding,
  } = usePortfolio();
  const { settings } = useAutoTrader();

  const boostActive = settings.boostUntil > Date.now();
  const prof = intensityProfile(settings.intensity, settings.tradeMode);
  const cooldownMs = boostActive ? BOOST_COOLDOWN_MS : Math.round(COOLDOWN_MS * prof.cooldownMult);
  const armed = settings.fundingEnabled;

  const { data: opportunities } = useGetFundingOpportunities({
    query: {
      queryKey: getGetFundingOpportunitiesQueryKey(),
      refetchInterval: armed ? (boostActive ? 20000 : 60000) : false,
      staleTime: boostActive ? 15000 : 45000,
      enabled: armed,
    },
  });

  const cooldownRef = useRef<Record<string, number>>({});

  // ── Steady accrual: grow simulated funding on every open pair, always on ──
  useEffect(() => {
    if (fundingPositions.length === 0) return;
    accrueFunding();
    const timer = setInterval(() => accrueFunding(), ACCRUAL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundingPositions.length]);

  // ── Auto-open delta-neutral pairs on the best funding opportunities ──
  useEffect(() => {
    if (!armed) return;
    const stake = settings.fundingStake;
    if (!(stake > 0)) return;
    const cashFloor = cashReserveFloor(totalDeposited, settings.cashFloorPct);
    const maxOpen = Math.max(1, Math.round(settings.fundingMaxOpen * prof.maxOpenMult));
    const minAnnualized = settings.fundingMinAnnualizedPct;
    const now = Date.now();

    let open = fundingPositions.filter((p) => p.source === SOURCE).length;
    let avail = cash;
    const openAssets = new Set(fundingPositions.map((p) => p.asset));

    const ranked = ((opportunities ?? []) as FundingOpportunity[])
      .filter((o) => o.viability === "STRONG" || o.viability === "MODERATE")
      .filter((o) => Math.abs(o.annualizedPercent) >= minAnnualized)
      .filter((o) => Number.isFinite(o.spotPrice) && o.spotPrice > 0)
      .filter((o) => !openAssets.has(o.asset))
      .filter((o) => now - (cooldownRef.current[o.asset] ?? 0) > cooldownMs)
      .sort((a, b) => Math.abs(b.annualizedPercent) - Math.abs(a.annualizedPercent));

    for (const o of ranked) {
      if (open >= maxOpen) break;
      if (avail - stake < cashFloor) break;
      const err = openFundingPosition({
        asset: o.asset,
        side: o.side,
        notionalPerLeg: stake,
        entryPrice: o.spotPrice,
        annualizedPercent: Math.abs(o.annualizedPercent),
        auto: true,
        source: SOURCE,
      }, cashFloor);
      if (err) continue;
      cooldownRef.current[o.asset] = now;
      avail -= stake;
      open += 1;
      const sideLabel = o.side === "SHORT_PERP" ? "Long base / Short perp" : "Short base / Long perp";
      toast({
        title: `Funding Arb · ${o.asset}`,
        description: `${sideLabel} · ${o.annualizedPercent.toFixed(1)}% APR · $${stake}/leg`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunities, settings, cash, fundingPositions]);

  return null;
}
