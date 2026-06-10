import { useEffect } from "react";
import {
  X, TrendingUp, TrendingDown, Bot, Hand, Clock, Target, Cpu,
  ArrowUpRight, ArrowDownRight, Lightbulb, ClipboardList, Flag, Brain,
} from "lucide-react";
import type { ClosedTrade } from "@/contexts/portfolio-context";
import { TradeDetailChart } from "@/components/trade-detail-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { StockIcon } from "@/components/stock-icon";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";

const TYPE_LABEL_KEY: Record<ClosedTrade["type"], string> = {
  BINANCE: "td.typeBinance",
  STOCK: "td.typeStock",
  POLYMARKET: "td.typePolymarket",
  FUNDING: "td.typeFunding",
  OPTION: "td.typeOption",
};

function typeLabel(type: ClosedTrade["type"], lang: Lang): string {
  return t(TYPE_LABEL_KEY[type], lang);
}

const BOT_SOURCE_LABEL: Record<string, string> = {
  "Dip Buyer": "Dip Buyer",
  "Breakout Hunter": "Breakout Hunter",
  "Blue-Chip DCA": "Blue-Chip DCA",
  "Scalp signal": "Scalp Signal",
  "Momentum surge": "Momentum Signal",
  "Smart-Money": "Smart Money",
  "Smart-Money (technical + influencer)": "Smart Money",
  "Quick Trade": "Quick Trade",
};

function directionLabel(d: ClosedTrade["direction"], lang: Lang): string {
  switch (d) {
    case "LONG": return t("td.dirLong", lang);
    case "SHORT": return t("td.dirShort", lang);
    case "YES": return t("td.dirYes", lang);
    case "NO": return t("td.dirNo", lang);
    default: return "—";
  }
}

function exitInfo(trade: ClosedTrade, lang: Lang): { label: string; color: string } {
  if (trade.exit === "TP") return { label: t("td.exitTp", lang), color: "#22c55e" };
  if (trade.exit === "SL") return { label: t("td.exitSl", lang), color: "#ef4444" };
  if (trade.exit === "LIQUIDATION") return { label: t("td.exitLiquidation", lang), color: "#dc2626" };
  if (trade.exit === "LIQ") return { label: t("td.exitLiq", lang), color: "#f59e0b" };
  return { label: t("td.exitManual", lang), color: "#a1a1aa" };
}

function botLabel(trade: ClosedTrade, lang: Lang): string {
  if (trade.source && BOT_SOURCE_LABEL[trade.source]) return BOT_SOURCE_LABEL[trade.source];
  if (trade.source) return trade.source;
  return trade.auto ? t("td.botAuto", lang) : t("td.botManual", lang);
}

function fmtUsd(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

function fmtDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "en" ? "en-US" : "he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function holdingDuration(trade: ClosedTrade, lang: Lang): string | null {
  if (!trade.openedAt) return null;
  const ms = new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime();
  if (!(ms > 0)) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} ${t("td.durMinutes", lang)}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t("td.durHr", lang)} ${m % 60} ${t("td.durMinAbbr", lang)}`;
  return `${Math.floor(h / 24)} ${t("td.durDays", lang)} ${h % 24} ${t("td.durHr", lang)}`;
}

const SOURCE_REASON_KEY: Record<string, string> = {
  "Dip Buyer": "td.reasonDipBuyer",
  "Breakout Hunter": "td.reasonBreakoutHunter",
  "Blue-Chip DCA": "td.reasonBlueChipDca",
  "Scalp signal": "td.reasonScalpSignal",
  "Momentum surge": "td.reasonMomentumSurge",
  "Smart-Money": "td.reasonSmartMoney",
  "Smart-Money (technical + influencer)": "td.reasonSmartMoneyTech",
  "Quick Trade": "td.reasonQuickTrade",
};

function fmtRR(rr: number): string {
  return `1:${rr.toFixed(2)}`;
}

interface TradeAnalysis {
  why: string;
  plan: string[];
  outcome: string[];
  lesson: string;
  lessonTone: "good" | "bad" | "neutral";
}

/** Build a narrative breakdown of one closed trade from its stored fields. */
function buildAnalysis(trade: ClosedTrade, lang: Lang): TradeAnalysis {
  const won = trade.pnl >= 0;
  const lev = trade.leverage ?? 1;
  const dirWord =
    trade.direction === "LONG" ? t("td.dirwordLong", lang) :
    trade.direction === "SHORT" ? t("td.dirwordShort", lang) :
    trade.direction === "YES" ? t("td.dirwordYes", lang) :
    trade.direction === "NO" ? t("td.dirwordNo", lang) : t("td.dirwordDefault", lang);

  // ── Why we entered ──
  let why: string;
  if (trade.source && SOURCE_REASON_KEY[trade.source]) why = t(SOURCE_REASON_KEY[trade.source], lang);
  else if (trade.auto) why = t("td.whyAuto", lang);
  else why = t("td.whyManual", lang);
  why += `. ${t("td.whyDirectionChosen", lang)}: ${dirWord}${lev > 1 ? `, ${t("td.whyLeverage", lang)} ${lev}x` : ""}.`;

  // ── The plan (targets) ──
  const plan: string[] = [];
  if (Number.isFinite(trade.entryPrice)) plan.push(`${t("td.planEntry", lang)}: $${fmtPrice(trade.entryPrice as number)}`);
  if (trade.tpPrice != null) plan.push(`${t("td.planTp", lang)}: $${fmtPrice(trade.tpPrice)}`);
  if (trade.slPrice != null) plan.push(`${t("td.planSl", lang)}: $${fmtPrice(trade.slPrice)}`);
  if (trade.tpPrice != null && trade.slPrice != null && Number.isFinite(trade.entryPrice)) {
    const entry = trade.entryPrice as number;
    const risk = Math.abs(entry - trade.slPrice);
    const reward = Math.abs(trade.tpPrice - entry);
    if (risk > 0) plan.push(`${t("td.planRr", lang)}: ${fmtRR(reward / risk)}`);
  }
  if (plan.length === 0) plan.push(t("td.planNone", lang));

  // ── What happened ──
  const outcome: string[] = [];
  const ex = exitInfo(trade, lang);
  outcome.push(`${t("td.outcomeExitReason", lang)}: ${ex.label}`);
  if (trade.exitPrice != null) outcome.push(`${t("td.outcomeExitPrice", lang)}: $${fmtPrice(trade.exitPrice)}`);
  const pct = trade.cost > 0 ? (trade.pnl / trade.cost) * 100 : 0;
  const feeStr = (trade.fees ?? 0) > 0 ? ` · ${t("td.outcomeFees", lang)}: $${fmtUsd(trade.fees!)}` : "";
  outcome.push(`${t("td.outcomeResult", lang)}: ${won ? "+" : ""}$${fmtUsd(trade.pnl)} (${won ? "+" : ""}${pct.toFixed(2)}% ${t("td.outcomeOnMargin", lang)})${feeStr}`);
  const dur = holdingDuration(trade, lang);
  if (dur) outcome.push(`${t("td.rowHolding", lang)}: ${dur}`);

  // ── Lesson ──
  let lesson: string;
  let lessonTone: "good" | "bad" | "neutral" = "neutral";
  if (trade.exit === "TP") { lesson = t("td.lessonTp", lang); lessonTone = "good"; }
  else if (trade.exit === "SL") { lesson = t("td.lessonSl", lang); lessonTone = "bad"; }
  else if (trade.exit === "LIQUIDATION") { lesson = t("td.lessonLiquidation", lang); lessonTone = "bad"; }
  else if (trade.exit === "LIQ") { lesson = t("td.lessonLiq", lang); lessonTone = "bad"; }
  else if (won) { lesson = t("td.lessonWonManual", lang); lessonTone = "good"; }
  else { lesson = t("td.lessonLostManual", lang); lessonTone = "bad"; }

  return { why, plan, outcome, lesson, lessonTone };
}

function AnalysisBlock({ trade, lang }: { trade: ClosedTrade; lang: Lang }) {
  const a = buildAnalysis(trade, lang);
  const lessonColor = a.lessonTone === "good" ? "#22c55e" : a.lessonTone === "bad" ? "#ef4444" : "#a1a1aa";
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Brain className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold tracking-tight">{t("td.analysisTitle", lang)}</h3>
      </div>

      <div className="rounded-lg border bg-card/60 p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="h-3 w-3" /> {t("td.analysisWhy", lang)}
        </div>
        <p className="text-xs text-foreground/85 leading-relaxed">{a.why}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <div className="rounded-lg border bg-card/60 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <ClipboardList className="h-3 w-3" /> {t("td.analysisPlan", lang)}
          </div>
          <ul className="space-y-0.5">
            {a.plan.map((line, i) => (
              <li key={i} className="text-[11px] text-foreground/85 leading-relaxed flex gap-1.5">
                <span className="text-primary/70">•</span> <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border bg-card/60 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Flag className="h-3 w-3" /> {t("td.analysisOutcome", lang)}
          </div>
          <ul className="space-y-0.5">
            {a.outcome.map((line, i) => (
              <li key={i} className="text-[11px] text-foreground/85 leading-relaxed flex gap-1.5">
                <span className="text-primary/70">•</span> <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: `${lessonColor}40`, background: `${lessonColor}0d` }}>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: lessonColor }}>
          <Brain className="h-3 w-3" /> {t("td.analysisLesson", lang)}
        </div>
        <p className="text-xs text-foreground/90 leading-relaxed">{a.lesson}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card/60 p-2.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-bold" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

interface Props {
  trade: ClosedTrade | null;
  onClose: () => void;
}

export function TradeDetailModal({ trade, onClose }: Props) {
  const { lang, dir } = useLanguage();
  useEffect(() => {
    if (!trade) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [trade, onClose]);

  if (!trade) return null;

  const won = trade.pnl >= 0;
  const pct = trade.cost > 0 ? (trade.pnl / trade.cost) * 100 : 0;
  const ex = exitInfo(trade, lang);
  const dur = holdingDuration(trade, lang);
  const hasStructured = Number.isFinite(trade.entryPrice);
  const leverage = trade.leverage ?? 1;

  const qtyLabel =
    trade.type === "STOCK" ? `${(trade.qty ?? 0).toFixed(2)} ${t("td.qtyShares", lang)}`
      : trade.type === "POLYMARKET" ? `${(trade.qty ?? 0).toFixed(2)} ${t("td.qtyUnits", lang)}`
        : `$${fmtUsd(trade.qty ?? 0, 0)} ${t("td.qtyNotional", lang)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
      dir={dir}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            {trade.type === "BINANCE" && trade.symbol && <CryptoIcon asset={trade.symbol} size={22} />}
            {trade.type === "STOCK" && trade.symbol && <StockIcon symbol={trade.symbol} size={22} />}
            {trade.type === "POLYMARKET" && <Target className="h-5 w-5 text-primary" />}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-black text-base">{trade.symbol ?? typeLabel(trade.type, lang)}</span>
                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">
                  {typeLabel(trade.type, lang)}
                </span>
                {trade.direction && (
                  <span
                    className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                    style={{
                      background: won ? "#22c55e1a" : "#ef44441a",
                      color: trade.direction === "LONG" || trade.direction === "YES" ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {trade.direction === "LONG" || trade.direction === "YES"
                      ? <ArrowUpRight className="h-2.5 w-2.5" />
                      : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {trade.direction}{leverage > 1 ? ` ${leverage}x` : ""}
                  </span>
                )}
                {trade.auto ? (
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-0.5"><Bot className="h-2.5 w-2.5" /> AUTO</span>
                ) : (
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/40 text-muted-foreground flex items-center gap-0.5"><Hand className="h-2.5 w-2.5" /> MANUAL</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title={t("td.closeBtn", lang)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* P&L banner */}
          <div className="rounded-lg border p-3 flex items-center justify-between" style={{ borderColor: won ? "#22c55e40" : "#ef444440", background: won ? "#22c55e0d" : "#ef44440d" }}>
            <div className="flex items-center gap-2">
              {won ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
              <span className="text-xs font-mono text-muted-foreground">{t("td.pnlLabel", lang)}</span>
            </div>
            <div className="text-right">
              <div className="font-mono text-xl font-black" style={{ color: won ? "#22c55e" : "#ef4444" }}>
                {won ? "+" : ""}${fmtUsd(trade.pnl)}
              </div>
              <div className="font-mono text-xs" style={{ color: won ? "#22c55e" : "#ef4444" }}>
                {won ? "+" : ""}{pct.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Polymarket question */}
          {trade.type === "POLYMARKET" && trade.question && (
            <p className="text-sm text-foreground/85 leading-relaxed">{trade.question}</p>
          )}

          {/* Chart */}
          <TradeDetailChart trade={trade} />

          {/* Detail grid */}
          {hasStructured ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <DetailRow label={t("td.rowEntryPrice", lang)} value={`$${fmtPrice(trade.entryPrice as number)}`} />
              <DetailRow label={t("td.rowExitPrice", lang)} value={`$${fmtPrice(trade.exitPrice ?? (trade.entryPrice as number))}`} />
              <DetailRow label={t("td.rowDirection", lang)} value={directionLabel(trade.direction, lang)} />
              <DetailRow label={t("td.rowLeverage", lang)} value={leverage > 1 ? `${leverage}x` : t("td.rowNoLeverage", lang)} />
              <DetailRow label={t("td.rowPositionSize", lang)} value={qtyLabel} />
              <DetailRow label={t("td.rowMargin", lang)} value={`$${fmtUsd(trade.cost)}`} />
              <DetailRow label={t("td.rowExitReason", lang)} value={ex.label} color={ex.color} />
              <DetailRow label={t("td.rowSource", lang)} value={botLabel(trade, lang)} />
              <DetailRow label={t("td.rowHolding", lang)} value={dur ?? "—"} />
              <DetailRow label={t("td.rowOpened", lang)} value={trade.openedAt ? fmtDateTime(trade.openedAt, lang) : "—"} />
              <DetailRow label={t("td.rowClosed", lang)} value={fmtDateTime(trade.closedAt, lang)} />
              <DetailRow label={t("td.rowProceeds", lang)} value={`$${fmtUsd(trade.proceeds)}`} />
              {(trade.fees ?? 0) > 0 && (
                <DetailRow label={t("td.rowFees", lang)} value={`$${fmtUsd(trade.fees!)}`} color="#f59e0b" />
              )}
            </div>
          ) : (
            // Legacy trade without structured fields — show description + basics.
            <div className="space-y-2">
              <div className="rounded-lg border bg-card/60 p-3">
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("td.rowTradeDetails", lang)}</div>
                <div className="font-mono text-xs text-foreground/90 break-words">{trade.description}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DetailRow label={t("td.rowCost", lang)} value={`$${fmtUsd(trade.cost)}`} />
                <DetailRow label={t("td.rowExitReason", lang)} value={ex.label} color={ex.color} />
                <DetailRow label={t("td.rowSource", lang)} value={botLabel(trade, lang)} />
                {dur && <DetailRow label={t("td.rowHolding", lang)} value={dur} />}
                <DetailRow label={t("td.rowClosed", lang)} value={fmtDateTime(trade.closedAt, lang)} />
              </div>
            </div>
          )}

          {/* Full per-trade analysis */}
          <AnalysisBlock trade={trade} lang={lang} />

          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <Cpu className="h-3 w-3" /> {t("td.disclaimer", lang)}
          </p>
        </div>
      </div>
    </div>
  );
}
