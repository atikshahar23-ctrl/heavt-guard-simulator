import { useMemo } from "react";
import {
  BarChart3, Brain, Bot, Layers, TrendingUp, TrendingDown,
  Activity, ShieldAlert, Sparkles, Trophy, Wallet, Target,
} from "lucide-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader } from "@/contexts/autotrader-context";
import { Sparkline } from "@/components/trade-analytics";
import { buildInsights, type ClassAgg, type BotAgg, type SymbolAgg } from "@/lib/insights";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

function usd(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function pnlColor(n: number): string {
  return n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#a1a1aa";
}

function SummaryCard({ label, value, sub, color, Icon }: {
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

function SymbolMini({ s, prefix }: { s: SymbolAgg; prefix: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
      <span className="text-muted-foreground truncate">{prefix} <span className="text-foreground/80 font-bold">{s.symbol}</span></span>
      <span className="font-bold tabular-nums shrink-0" style={{ color: pnlColor(s.net) }}>
        {s.net >= 0 ? "+" : ""}${usd(s.net, 0)}
      </span>
    </div>
  );
}

function ClassCard({ c }: { c: ClassAgg }) {
  const { lang } = useLanguage();
  const color = pnlColor(c.net);
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-bold truncate">{c.label}</span>
        </div>
        <span className="font-mono text-xs font-black tabular-nums shrink-0" style={{ color }}>
          {c.net >= 0 ? "+" : ""}${usd(c.net, 0)}
        </span>
      </div>

      {c.curve.length > 1 ? (
        <Sparkline pts={c.curve} className="w-full h-8" />
      ) : (
        <div className="h-8 flex items-center justify-center text-[9px] font-mono text-muted-foreground/60">{t("insights.noChartData", lang)}</div>
      )}

      <div className="grid grid-cols-3 gap-x-1 text-center border-t border-border/40 pt-1.5">
        <div>
          <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.trades", lang)}</div>
          <div className="text-[11px] font-mono font-bold tabular-nums">{c.trades}</div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.success", lang)}</div>
          <div className="text-[11px] font-mono font-bold tabular-nums" style={{ color: c.winRate >= 50 ? "#22c55e" : "#ef4444" }}>
            {c.winRate.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.avg", lang)}</div>
          <div className="text-[11px] font-mono font-bold tabular-nums" style={{ color: pnlColor(c.avg) }}>
            {c.avg >= 0 ? "+" : ""}${usd(c.avg, 0)}
          </div>
        </div>
      </div>

      {(c.best || c.worst) && (
        <div className="space-y-1 border-t border-border/40 pt-1.5">
          {c.best && c.best.net > 0 && <SymbolMini s={c.best} prefix={t("insights.best", lang)} />}
          {c.worst && c.worst.net < 0 && c.worst.symbol !== c.best?.symbol && <SymbolMini s={c.worst} prefix={t("insights.worst", lang)} />}
        </div>
      )}

      {c.openCount > 0 && (
        <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-muted-foreground border-t border-border/40 pt-1.5">
          <span>{t("insights.openPositionsCount", lang).replace("{n}", String(c.openCount))}</span>
          <span>{t("insights.invested", lang).replace("{amount}", usd(c.openCapital, 0))}</span>
        </div>
      )}
    </div>
  );
}

function BotCard({ b }: { b: BotAgg }) {
  const { lang } = useLanguage();
  const color = pnlColor(b.net);
  const tighter = b.edge > 1.0;
  const looser = b.edge < 1.0;
  const noteColor = tighter ? "#f59e0b" : looser ? "#22c55e" : "#a1a1aa";
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-bold truncate">{b.title}</span>
        </div>
        <span className="font-mono text-xs font-black tabular-nums shrink-0" style={{ color }}>
          {b.net >= 0 ? "+" : ""}${usd(b.net, 0)}
        </span>
      </div>

      {b.curve.length > 1 ? (
        <Sparkline pts={b.curve} className="w-full h-8" />
      ) : (
        <div className="h-8 flex items-center justify-center text-[9px] font-mono text-muted-foreground/60">{t("insights.noChartData", lang)}</div>
      )}

      <div className="grid grid-cols-3 gap-x-1 text-center border-t border-border/40 pt-1.5">
        <div>
          <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.trades", lang)}</div>
          <div className="text-[11px] font-mono font-bold tabular-nums">{b.trades}</div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.success", lang)}</div>
          <div className="text-[11px] font-mono font-bold tabular-nums" style={{ color: b.winRate >= 50 ? "#22c55e" : "#ef4444" }}>
            {b.winRate.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground font-mono uppercase leading-tight">{t("insights.stat.avg", lang)}</div>
          <div className="text-[11px] font-mono font-bold tabular-nums" style={{ color: pnlColor(b.avg) }}>
            {b.avg >= 0 ? "+" : ""}${usd(b.avg, 0)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/40 pt-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (b.edge / 2) * 100)}%`, background: noteColor }} />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground shrink-0">{t("insights.selectivity", lang).replace("{x}", b.edge.toFixed(2))}</span>
      </div>
    </div>
  );
}

export default function Insights() {
  const { lang, dir } = useLanguage();
  const {
    tradeHistory, binancePositions, stockPositions, polyPositions,
    fundingPositions, optionPositions,
  } = usePortfolio();
  const { settings } = useAutoTrader();

  const data = useMemo(
    () =>
      buildInsights(
        tradeHistory,
        {
          binance: binancePositions,
          stock: stockPositions,
          poly: polyPositions,
          funding: fundingPositions,
          option: optionPositions,
        },
        settings.assetStats,
        settings.botStats,
        lang,
      ),
    [tradeHistory, binancePositions, stockPositions, polyPositions, fundingPositions, optionPositions, settings.assetStats, settings.botStats, lang],
  );

  const activeClasses = data.classAggs.filter((c) => c.trades > 0 || c.openCount > 0);

  return (
    <div dir={dir} className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-black tracking-tight">{t("insights.title", lang)}</h1>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground">
          {t("insights.subtitle", lang)}
        </p>
      </div>

      {/* ── Top summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label={t("insights.summary.totalTrades", lang)} value={String(data.totalTrades)} sub={t("insights.summary.inGreen", lang).replace("{n}", String(data.totalWins))} Icon={Activity} />
        <SummaryCard label={t("insights.summary.winRate", lang)} value={`${data.overallWinRate.toFixed(0)}%`} color={data.overallWinRate >= 50 ? "#22c55e" : "#ef4444"} Icon={Target} />
        <SummaryCard label={t("insights.summary.netPnl", lang)} value={`${data.totalNet >= 0 ? "+" : ""}$${usd(data.totalNet, 0)}`} color={pnlColor(data.totalNet)} Icon={TrendingUp} />
        <SummaryCard label={t("insights.summary.openPositions", lang)} value={String(data.totalOpen)} Icon={Wallet} />
      </div>

      {/* ── Asset class breakdown ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black tracking-tight">{t("insights.byMarket", lang)}</h2>
          <span className="text-[9px] font-mono text-muted-foreground/70">({activeClasses.length})</span>
        </div>
        {activeClasses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeClasses.map((c) => <ClassCard key={c.key} c={c} />)}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground py-4">{t("insights.noClassData", lang)}</p>
        )}
      </div>

      {/* ── Best / worst symbols ── */}
      {(data.bestSymbols.length > 0 || data.worstSymbols.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Trophy className="h-3 w-3 text-emerald-400" /> {t("insights.topAssets", lang)}
            </div>
            <div className="space-y-1.5">
              {data.bestSymbols.filter((s) => s.net > 0).map((s) => (
                <div key={s.symbol} className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="text-foreground/80 font-bold truncate">{s.symbol}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{s.trades} {t("insights.tradesAbbr", lang)}</span>
                    <span className="text-muted-foreground">{s.winRate.toFixed(0)}%</span>
                    <span className="font-bold tabular-nums text-emerald-400">+${usd(s.net)}</span>
                  </div>
                </div>
              ))}
              {data.bestSymbols.filter((s) => s.net > 0).length === 0 && (
                <p className="text-[11px] text-muted-foreground">{t("insights.noProfitAsset", lang)}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-red-400" /> {t("insights.challengingAssets", lang)}
            </div>
            <div className="space-y-1.5">
              {data.worstSymbols.filter((s) => s.net < 0).map((s) => (
                <div key={s.symbol} className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="text-foreground/80 font-bold truncate">{s.symbol}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{s.trades} {t("insights.tradesAbbr", lang)}</span>
                    <span className="text-muted-foreground">{s.winRate.toFixed(0)}%</span>
                    <span className="font-bold tabular-nums text-red-400">-${usd(Math.abs(s.net))}</span>
                  </div>
                </div>
              ))}
              {data.worstSymbols.filter((s) => s.net < 0).length === 0 && (
                <p className="text-[11px] text-muted-foreground">{t("insights.noLossAsset", lang)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Per-bot breakdown ── */}
      {data.botAggs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-black tracking-tight">{t("insights.botPerformance", lang)}</h2>
            <span className="text-[9px] font-mono text-muted-foreground/70">({t("insights.activeCount", lang).replace("{n}", String(data.botAggs.length))})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.botAggs.map((b) => <BotCard key={b.key} b={b} />)}
          </div>
        </div>
      )}

      {/* ── Rising per-asset caution ── */}
      {data.cautioned.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-black tracking-tight">{t("insights.risingCaution", lang)}</h2>
            <span className="text-[9px] font-mono text-muted-foreground/70">({data.cautioned.length})</span>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-2">
            {data.cautioned.map((c) => (
              <div key={c.symbol} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-foreground/80 font-bold w-14 shrink-0 truncate">{c.symbol}</span>
                <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, ((c.caution - 1) / 0.8) * 100)}%` }} />
                </div>
                <span className="text-muted-foreground w-12 text-left shrink-0">{c.trades} {t("insights.tradesAbbr", lang)}</span>
                <span className="text-muted-foreground w-10 text-left shrink-0">{c.winRate.toFixed(0)}%</span>
                <span className="font-bold w-12 text-left shrink-0 text-amber-400">×{c.caution.toFixed(2)}</span>
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground/70 pt-1">
              {t("insights.cautionNote", lang)}
            </p>
          </div>
        </div>
      )}

      {/* ── Rule-based conclusions ── */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
          <Brain className="h-3 w-3" /> {t("insights.conclusionsTitle", lang)}
        </div>
        <ul className="space-y-1.5">
          {data.conclusions.map((s, i) => (
            <li key={i} className="text-[11px] text-foreground/90 leading-relaxed flex gap-1.5">
              <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
