import type {
  ClosedTrade,
  BinancePosition,
  StockPosition,
  PolyPosition,
  FundingPosition,
  OptionPosition,
} from "@/contexts/portfolio-context";
import type { BotStat } from "@/contexts/autotrader-context";
import { assetCautionFromStat } from "@/contexts/autotrader-context";
import { t, type Lang } from "@/lib/i18n";

/* ──────────────────────────────────────────────────────────────────────────
 * Rule-based analytics & insights engine.
 *
 * Pure functions only — no React, no paid AI. Aggregates closed-trade history,
 * open positions and the per-asset caution scorecards into per-asset-class and
 * per-bot summaries plus plain-language Hebrew conclusions, framed strictly as
 * educational observations (never advice or guarantees).
 * ──────────────────────────────────────────────────────────────────────── */

export type AssetClass = ClosedTrade["type"];

export const ASSET_CLASSES: AssetClass[] = [
  "BINANCE",
  "STOCK",
  "POLYMARKET",
  "OPTION",
  "FUNDING",
];

const CLASS_LABEL_KEY: Record<AssetClass, string> = {
  BINANCE: "insights.class.binance",
  STOCK: "insights.class.stock",
  POLYMARKET: "insights.class.polymarket",
  OPTION: "insights.class.option",
  FUNDING: "insights.class.funding",
};

export interface SymbolAgg {
  symbol: string;
  trades: number;
  wins: number;
  winRate: number;
  net: number;
  avg: number;
}

export interface ClassAgg {
  key: AssetClass;
  label: string;
  trades: number;
  wins: number;
  winRate: number;
  net: number;
  avg: number;
  /** Net of the most recent (up to 8) trades — short-term momentum. */
  recentNet: number;
  best: SymbolAgg | null;
  worst: SymbolAgg | null;
  symbols: SymbolAgg[];
  /** Chronological cumulative-PnL curve for a sparkline. */
  curve: number[];
  openCount: number;
  /** Capital currently committed to open positions of this class (USD). */
  openCapital: number;
}

export interface BotDef {
  key: string;
  titleKey: string;
  match: (t: ClosedTrade) => boolean;
}

/** Per-bot matchers — mirrors the labelling used on the History page. */
export const BOT_DEFS: BotDef[] = [
  { key: "scalp", titleKey: "insights.bot.scalp", match: (t) => (t.source ?? "").includes("Scalp") },
  { key: "momentum", titleKey: "insights.bot.momentum", match: (t) => (t.source ?? "").includes("Momentum") },
  { key: "smart", titleKey: "insights.bot.smart", match: (t) => (t.source ?? "").includes("Smart-Money") },
  { key: "dipbuyer", titleKey: "insights.bot.dipbuyer", match: (t) => t.source === "Dip Buyer" },
  { key: "breakout", titleKey: "insights.bot.breakout", match: (t) => t.source === "Breakout Hunter" },
  { key: "dca", titleKey: "insights.bot.dca", match: (t) => t.source === "Blue-Chip DCA" },
  { key: "poly", titleKey: "insights.bot.poly", match: (t) => t.type === "POLYMARKET" },
  { key: "funding", titleKey: "insights.bot.funding", match: (t) => t.type === "FUNDING" },
  { key: "options", titleKey: "insights.bot.options", match: (t) => t.type === "OPTION" },
];

export interface BotAgg {
  key: string;
  title: string;
  trades: number;
  wins: number;
  winRate: number;
  net: number;
  avg: number;
  recentNet: number;
  curve: number[];
  /** Adaptive selectivity multiplier from the manager (1 = baseline). */
  edge: number;
}

export interface CautionEntry {
  symbol: string;
  caution: number;
  trades: number;
  winRate: number;
  net: number;
}

export interface OpenPositions {
  binance: BinancePosition[];
  stock: StockPosition[];
  poly: PolyPosition[];
  funding: FundingPosition[];
  option: OptionPosition[];
}

export interface InsightsData {
  totalTrades: number;
  totalWins: number;
  overallWinRate: number;
  totalNet: number;
  totalOpen: number;
  classAggs: ClassAgg[];
  botAggs: BotAgg[];
  bestSymbols: SymbolAgg[];
  worstSymbols: SymbolAgg[];
  cautioned: CautionEntry[];
  conclusions: string[];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function fmtUsd(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function signed(n: number, dp = 2): string {
  return `${n >= 0 ? "+" : "-"}$${fmtUsd(Math.abs(n), dp)}`;
}

/** Cumulative-PnL curve over trades, oldest → newest (history is newest-first). */
function curveOf(trades: ClosedTrade[]): number[] {
  const chrono = [...trades].reverse();
  let c = 0;
  const pts: number[] = [0];
  for (const t of chrono) {
    c += t.pnl;
    pts.push(c);
  }
  return pts;
}

/** Net PnL of the most recent `n` trades (history is newest-first). */
function recentNetOf(trades: ClosedTrade[], n = 8): number {
  return trades.slice(0, n).reduce((a, t) => a + t.pnl, 0);
}

export function computeSymbolAggs(trades: ClosedTrade[]): SymbolAgg[] {
  const map = new Map<string, { trades: number; wins: number; net: number }>();
  for (const t of trades) {
    const symbol = (t.symbol ?? t.description ?? "—").toUpperCase();
    const e = map.get(symbol) ?? { trades: 0, wins: 0, net: 0 };
    e.trades += 1;
    if (t.pnl > 0) e.wins += 1;
    e.net += t.pnl;
    map.set(symbol, e);
  }
  return [...map.entries()].map(([symbol, e]) => ({
    symbol,
    trades: e.trades,
    wins: e.wins,
    winRate: e.trades ? (e.wins / e.trades) * 100 : 0,
    net: e.net,
    avg: e.trades ? e.net / e.trades : 0,
  }));
}

function openCapitalFor(key: AssetClass, open: OpenPositions): { count: number; capital: number } {
  switch (key) {
    case "BINANCE":
      return {
        count: open.binance.length,
        capital: open.binance.reduce((a, p) => a + (p.leverage ? p.notional / p.leverage : p.notional), 0),
      };
    case "STOCK":
      return { count: open.stock.length, capital: open.stock.reduce((a, p) => a + p.cost, 0) };
    case "POLYMARKET":
      return { count: open.poly.length, capital: open.poly.reduce((a, p) => a + p.cost, 0) };
    case "FUNDING":
      return { count: open.funding.length, capital: open.funding.reduce((a, p) => a + p.notionalPerLeg, 0) };
    case "OPTION":
      return { count: open.option.length, capital: open.option.reduce((a, p) => a + p.premiumPaid, 0) };
    default:
      return { count: 0, capital: 0 };
  }
}

export function computeClassAggs(tradeHistory: ClosedTrade[], open: OpenPositions, lang: Lang): ClassAgg[] {
  return ASSET_CLASSES.map((key) => {
    const trades = tradeHistory.filter((t) => t.type === key);
    const wins = trades.filter((t) => t.pnl > 0).length;
    const net = trades.reduce((a, t) => a + t.pnl, 0);
    const symbols = computeSymbolAggs(trades).sort((a, b) => b.net - a.net);
    const { count, capital } = openCapitalFor(key, open);
    return {
      key,
      label: t(CLASS_LABEL_KEY[key], lang),
      trades: trades.length,
      wins,
      winRate: trades.length ? (wins / trades.length) * 100 : 0,
      net,
      avg: trades.length ? net / trades.length : 0,
      recentNet: recentNetOf(trades),
      best: symbols.length ? symbols[0] : null,
      worst: symbols.length ? symbols[symbols.length - 1] : null,
      symbols,
      curve: curveOf(trades),
      openCount: count,
      openCapital: capital,
    };
  });
}

export function computeBotAggs(tradeHistory: ClosedTrade[], botStats: Record<string, BotStat>, lang: Lang): BotAgg[] {
  return BOT_DEFS.map((b) => {
    const trades = tradeHistory.filter(b.match);
    const wins = trades.filter((t) => t.pnl > 0).length;
    const net = trades.reduce((a, t) => a + t.pnl, 0);
    return {
      key: b.key,
      title: t(b.titleKey, lang),
      trades: trades.length,
      wins,
      winRate: trades.length ? (wins / trades.length) * 100 : 0,
      net,
      avg: trades.length ? net / trades.length : 0,
      recentNet: recentNetOf(trades),
      curve: curveOf(trades),
      edge: botStats[b.key]?.edge ?? 1,
    };
  }).filter((b) => b.trades > 0);
}

/** Coins/stocks where the engine has raised its caution multiplier above 1. */
export function computeCautioned(assetStats: Record<string, BotStat>): CautionEntry[] {
  return Object.entries(assetStats)
    .map(([symbol, stat]) => ({
      symbol,
      caution: assetCautionFromStat(stat),
      trades: stat.trades,
      winRate: stat.trades ? (stat.wins / stat.trades) * 100 : 0,
      net: stat.netPnl,
    }))
    .filter((e) => e.caution > 1)
    .sort((a, b) => b.caution - a.caution || a.net - b.net);
}

/* ── Rule-based conclusions ──────────────────────────────────────────────────
 * Educational observations only. No advice, no win-rate/return promises. */
function buildConclusions(d: Omit<InsightsData, "conclusions">, lang: Lang): string[] {
  const out: string[] = [];

  if (d.totalTrades === 0) {
    out.push(t("insights.concl.empty", lang));
    return out;
  }

  // Overall picture.
  out.push(
    t("insights.concl.overall", lang)
      .replace("{trades}", String(d.totalTrades))
      .replace("{winRate}", d.overallWinRate.toFixed(0))
      .replace("{net}", signed(d.totalNet)),
  );

  // Strongest / weakest asset class.
  const active = d.classAggs.filter((c) => c.trades > 0);
  const ranked = [...active].sort((a, b) => b.net - a.net);
  if (ranked.length) {
    const best = ranked[0];
    out.push(
      t("insights.concl.bestClass", lang)
        .replace("{label}", best.label)
        .replace("{net}", signed(best.net))
        .replace("{trades}", String(best.trades))
        .replace("{winRate}", best.winRate.toFixed(0)),
    );
    const worst = ranked[ranked.length - 1];
    if (ranked.length > 1 && worst.net < 0) {
      out.push(
        t("insights.concl.worstClass", lang)
          .replace("{label}", worst.label)
          .replace("{net}", signed(worst.net))
          .replace("{winRate}", worst.winRate.toFixed(0)),
      );
    }
  }

  // Best / worst symbol across coins & stocks.
  if (d.bestSymbols.length && d.bestSymbols[0].net > 0) {
    const s = d.bestSymbols[0];
    out.push(
      t("insights.concl.bestSymbol", lang)
        .replace("{symbol}", s.symbol)
        .replace("{net}", signed(s.net))
        .replace("{trades}", String(s.trades)),
    );
  }
  if (d.worstSymbols.length && d.worstSymbols[0].net < 0) {
    const s = d.worstSymbols[0];
    out.push(
      t("insights.concl.worstSymbol", lang)
        .replace("{symbol}", s.symbol)
        .replace("{net}", signed(s.net))
        .replace("{trades}", String(s.trades)),
    );
  }

  // Best / worst bot.
  const botsRanked = [...d.botAggs].sort((a, b) => b.net - a.net);
  if (botsRanked.length) {
    const bb = botsRanked[0];
    if (bb.net > 0) {
      out.push(
        t("insights.concl.bestBot", lang)
          .replace("{title}", bb.title)
          .replace("{net}", signed(bb.net))
          .replace("{winRate}", bb.winRate.toFixed(0)),
      );
    }
    const wb = botsRanked[botsRanked.length - 1];
    if (botsRanked.length > 1 && wb.net < 0) {
      out.push(
        t("insights.concl.worstBot", lang)
          .replace("{title}", wb.title)
          .replace("{net}", signed(wb.net))
          .replace("{winRate}", wb.winRate.toFixed(0)),
      );
    }
  }

  // Rising per-asset caution.
  if (d.cautioned.length) {
    const top = d.cautioned.slice(0, 4).map((c) => `${c.symbol} (×${c.caution.toFixed(2)})`).join(", ");
    out.push(t("insights.concl.caution", lang).replace("{list}", top));
  }

  // Short-term trend.
  const recent = d.classAggs.reduce((a, c) => a + c.recentNet, 0);
  if (Math.abs(recent) > 0.5) {
    out.push(
      (recent >= 0
        ? t("insights.concl.trendUp", lang)
        : t("insights.concl.trendDown", lang)
      ).replace("{net}", signed(recent)),
    );
  }

  // Low overall win-rate note.
  if (d.totalTrades >= 10 && d.overallWinRate < 45) {
    out.push(t("insights.concl.lowWinRate", lang));
  }

  out.push(t("insights.concl.disclaimer", lang));
  return out;
}

/** Build the full insights dataset from history, open positions and scorecards. */
export function buildInsights(
  tradeHistory: ClosedTrade[],
  open: OpenPositions,
  assetStats: Record<string, BotStat>,
  botStats: Record<string, BotStat>,
  lang: Lang,
): InsightsData {
  const totalTrades = tradeHistory.length;
  const totalWins = tradeHistory.filter((t) => t.pnl > 0).length;
  const totalNet = tradeHistory.reduce((a, t) => a + t.pnl, 0);
  const classAggs = computeClassAggs(tradeHistory, open, lang);
  const botAggs = computeBotAggs(tradeHistory, botStats, lang);
  const cautioned = computeCautioned(assetStats);
  const totalOpen =
    open.binance.length + open.stock.length + open.poly.length + open.funding.length + open.option.length;

  // Best/worst leaderboard across tradable coins, stocks and options.
  const tradableSymbols = computeSymbolAggs(
    tradeHistory.filter((t) => t.type === "BINANCE" || t.type === "STOCK" || t.type === "OPTION"),
  );
  const bestSymbols = [...tradableSymbols].sort((a, b) => b.net - a.net).slice(0, 5);
  const worstSymbols = [...tradableSymbols].sort((a, b) => a.net - b.net).slice(0, 5);

  const base: Omit<InsightsData, "conclusions"> = {
    totalTrades,
    totalWins,
    overallWinRate: totalTrades ? (totalWins / totalTrades) * 100 : 0,
    totalNet,
    totalOpen,
    classAggs,
    botAggs,
    bestSymbols,
    worstSymbols,
    cautioned,
  };

  return { ...base, conclusions: buildConclusions(base, lang) };
}
