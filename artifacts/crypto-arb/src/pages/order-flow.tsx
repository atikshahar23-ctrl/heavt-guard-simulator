import { useState, useMemo, useRef, useEffect } from "react";
import { useOrderFlow, useOrderFlowSymbol } from "@/contexts/order-flow-context";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { PageIntro } from "@/components/page-intro";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowDown,
  ArrowUp,
  Zap,
  Circle,
  Eye,
  BarChart3,
} from "lucide-react";

export default function OrderFlowPage() {
  const { lang } = useLanguage();
  const state = useOrderFlow();
  const { symbol, setSymbol } = useOrderFlowSymbol();
  const [input, setInput] = useState(symbol.replace("USDT", ""));
  const m = state.metrics;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = input.trim().toUpperCase();
    if (s) setSymbol(s + "USDT");
  };

  const feelColor =
    m.feel > 0.2 ? "text-green-400" : m.feel < -0.2 ? "text-red-400" : "text-yellow-400";
  const feelBg =
    m.feel > 0.2 ? "bg-green-500/10" : m.feel < -0.2 ? "bg-red-500/10" : "bg-yellow-500/10";
  const feelBorder =
    m.feel > 0.2 ? "border-green-500/20" : m.feel < -0.2 ? "border-red-500/20" : "border-yellow-500/20";

  const tapeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tapeRef.current) {
      tapeRef.current.scrollTop = tapeRef.current.scrollHeight;
    }
  }, [state.trades.length]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4" dir={lang === "he" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-gold" />
            {t("orderFlow.title", lang)}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("orderFlow.subtitle", lang)}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder={t("orderFlow.symbol", lang)}
            className="w-32 uppercase text-center"
          />
          <Button type="submit" size="sm">
            {t("orderFlow.watch", lang)}
          </Button>
          <div className="flex items-center gap-1">
            <Circle
              className={`w-2.5 h-2.5 ${state.connected ? "text-green-500 fill-green-500" : "text-red-500 fill-red-500"}`}
            />
            <span className="text-xs text-muted-foreground">
              {state.connected
                ? t("orderFlow.live", lang)
                : t("orderFlow.reconnecting", lang)}
            </span>
          </div>
        </form>
      </div>

      <PageIntro title={t("orderFlow.intro.title", lang)} description={t("orderFlow.intro.desc", lang)} />

      {/* Feel Card */}
      <Card className={`p-4 border ${feelBorder} ${feelBg}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {m.feel > 0.2 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : m.feel < -0.2 ? (
                <TrendingDown className="w-5 h-5 text-red-400" />
              ) : (
                <Activity className="w-5 h-5 text-yellow-400" />
              )}
              <span className="text-sm text-muted-foreground uppercase tracking-wider">
                {t("orderFlow.feel", lang)}
              </span>
            </div>
            <div className={`text-3xl font-bold ${feelColor}`}>
              {lang === "he" ? m.feelTextHe : m.feelText}
            </div>
            <div className="text-sm text-muted-foreground">
              {t("orderFlow.feelDesc", lang)}
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <Metric
              label={t("orderFlow.mid", lang)}
              value={m.mid > 0 ? m.mid.toLocaleString("en", { minimumFractionDigits: 2 }) : "—"}
            />
            <Metric
              label={t("orderFlow.spread", lang)}
              value={m.spread > 0 ? m.spread.toLocaleString("en", { minimumFractionDigits: 2 }) : "—"}
            />
            <Metric
              label={t("orderFlow.tapeSpeed", lang)}
              value={m.tapeSpeed.toLocaleString("en", { maximumFractionDigits: 3 })}
              unit={t("orderFlow.qty", lang)}
            />
            <Metric
              label={t("orderFlow.trades", lang)}
              value={String(m.tapeCount)}
            />
          </div>
        </div>

        {/* Feel bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>
              {t("orderFlow.bearish", lang)} →
            </span>
            <span>
              {m.feelStrength}% {t("orderFlow.confidence", lang)}
            </span>
            <span>
              → {t("orderFlow.bullish", lang)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.max(0, Math.min(100, (m.feel + 1) / 2 * 100))}%`,
                background:
                  m.feel > 0
                    ? "linear-gradient(90deg, #3b82f6, #22c55e)"
                    : "linear-gradient(90deg, #ef4444, #3b82f6)",
              }}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Depth */}
        <Card className="p-4 border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gold" />
              {t("orderFlow.depth", lang)} — {state.symbol}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-green-400 border-green-500/20">
                {t("orderFlow.bids", lang)} {m.bidDepth.toLocaleString("en", { maximumFractionDigits: 2 })}
              </Badge>
              <Badge variant="outline" className="text-red-400 border-red-500/20">
                {t("orderFlow.asks", lang)} {m.askDepth.toLocaleString("en", { maximumFractionDigits: 2 })}
              </Badge>
            </div>
          </div>

          <div className="space-y-1">
            {/* Asks (reversed, top = closest to spread) */}
            {[...state.asks]
              .slice(0, 10)
              .reverse()
              .map((a) => (
                <DepthRow
                  key={a.price}
                  side="ask"
                  level={a}
                  maxTotal={Math.max(
                    state.bids[0]?.total ?? 0,
                    state.asks[state.asks.length - 1]?.total ?? 0,
                  )}
                />
              ))}

            {/* Spread indicator */}
            <div className="text-center text-xs text-muted-foreground py-1">
              {t("orderFlow.spread", lang)} {m.spread > 0 ? m.spread.toFixed(m.spread < 1 ? 4 : 2) : "—"}
            </div>

            {/* Bids */}
            {state.bids.slice(0, 10).map((b) => (
              <DepthRow
                key={b.price}
                side="bid"
                level={b}
                maxTotal={Math.max(
                  state.bids[state.bids.length - 1]?.total ?? 0,
                  state.asks[0]?.total ?? 0,
                )}
              />
            ))}
          </div>
        </Card>

        {/* Tape */}
        <Card className="p-4 border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-gold" />
              {t("orderFlow.tape", lang)} — {state.symbol}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-3 h-3 text-green-400" />
                {m.buyVolume.toLocaleString("en", { maximumFractionDigits: 3 })}
              </span>
              <span className="flex items-center gap-1">
                <ArrowDown className="w-3 h-3 text-red-400" />
                {m.sellVolume.toLocaleString("en", { maximumFractionDigits: 3 })}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {m.delta > 0 ? "+" : ""}
                {m.delta.toLocaleString("en", { maximumFractionDigits: 3 })}
              </span>
            </div>
          </div>

          <div
            ref={tapeRef}
            className="h-80 overflow-y-auto space-y-0.5 pr-1"
            style={{ scrollBehavior: "auto" }}
          >
            {state.trades.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                {t("orderFlow.waiting", lang)}
              </div>
            )}
            {state.trades.slice(-100).map((t, i) => (
              <div
                key={i}
                className={`flex items-center justify-between text-xs px-2 py-0.5 rounded ${
                  t.isBuy ? "bg-green-500/5" : "bg-red-500/5"
                }`}
              >
                <span className={t.isBuy ? "text-green-400" : "text-red-400"}>
                  {t.isBuy ? "▲" : "▼"} {t.qty.toLocaleString("en", { maximumFractionDigits: 4 })}
                </span>
                <span className="text-muted-foreground">
                  {t.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </span>
                <span className="text-muted-foreground/50">
                  {new Date(t.ts).toLocaleTimeString("he-IL", { hour12: false })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">
        {label}
        {unit ? ` (${unit})` : ""}
      </div>
    </div>
  );
}

function DepthRow({
  side,
  level,
  maxTotal,
}: {
  side: "bid" | "ask";
  level: { price: number; qty: number; total: number };
  maxTotal: number;
}) {
  const pct = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
  const color = side === "bid" ? "bg-green-500/20" : "bg-red-500/20";
  const textColor = side === "bid" ? "text-green-400" : "text-red-400";

  return (
    <div className="relative flex items-center justify-between text-xs px-2 py-0.5 rounded overflow-hidden">
      <div
        className={`absolute top-0 ${side === "bid" ? "right-0" : "left-0"} h-full ${color}`}
        style={{ width: `${pct}%` }}
      />
      <span className={`relative z-10 ${textColor}`}>
        {level.qty.toLocaleString("en", { maximumFractionDigits: 4 })}
      </span>
      <span className="relative z-10 text-foreground font-mono">
        {level.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
      </span>
    </div>
  );
}
