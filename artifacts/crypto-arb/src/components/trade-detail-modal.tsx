import { useEffect } from "react";
import {
  X, TrendingUp, TrendingDown, Bot, Hand, Clock, Target, Cpu,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import type { ClosedTrade } from "@/contexts/portfolio-context";
import { TradeDetailChart } from "@/components/trade-detail-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { StockIcon } from "@/components/stock-icon";

const TYPE_LABEL: Record<ClosedTrade["type"], string> = {
  BINANCE: "פיוצ'רס קריפטו",
  STOCK: "מניות",
  POLYMARKET: "שוק חיזוי",
};

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

function directionLabel(d: ClosedTrade["direction"]): string {
  switch (d) {
    case "LONG": return "לונג (LONG)";
    case "SHORT": return "שורט (SHORT)";
    case "YES": return "כן (YES)";
    case "NO": return "לא (NO)";
    default: return "—";
  }
}

function exitInfo(t: ClosedTrade): { label: string; color: string } {
  if (t.exit === "TP") return { label: "יעד רווח (TP)", color: "#22c55e" };
  if (t.exit === "SL") return { label: "סטופ לוס (SL)", color: "#ef4444" };
  if (t.exit === "LIQ") return { label: "יציאת חירום (LIQ)", color: "#f59e0b" };
  return { label: "סגירה ידנית", color: "#a1a1aa" };
}

function botLabel(t: ClosedTrade): string {
  if (t.source && BOT_SOURCE_LABEL[t.source]) return BOT_SOURCE_LABEL[t.source];
  if (t.source) return t.source;
  return t.auto ? "אוטו-טריידר" : "ידני";
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

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function holdingDuration(t: ClosedTrade): string | null {
  if (!t.openedAt) return null;
  const ms = new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime();
  if (!(ms > 0)) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} דקות`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ש׳ ${m % 60} ד׳`;
  return `${Math.floor(h / 24)} ימים ${h % 24} ש׳`;
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
  const ex = exitInfo(trade);
  const dur = holdingDuration(trade);
  const hasStructured = Number.isFinite(trade.entryPrice);
  const leverage = trade.leverage ?? 1;

  const qtyLabel =
    trade.type === "STOCK" ? `${(trade.qty ?? 0).toFixed(2)} מניות`
      : trade.type === "POLYMARKET" ? `${(trade.qty ?? 0).toFixed(2)} יחידות`
        : `$${fmtUsd(trade.qty ?? 0, 0)} נומינלי`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
      dir="rtl"
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
                <span className="font-mono font-black text-base">{trade.symbol ?? TYPE_LABEL[trade.type]}</span>
                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">
                  {TYPE_LABEL[trade.type]}
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
          <button onClick={onClose} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title="סגור">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* P&L banner */}
          <div className="rounded-lg border p-3 flex items-center justify-between" style={{ borderColor: won ? "#22c55e40" : "#ef444440", background: won ? "#22c55e0d" : "#ef44440d" }}>
            <div className="flex items-center gap-2">
              {won ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
              <span className="text-xs font-mono text-muted-foreground">רווח/הפסד</span>
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
              <DetailRow label="מחיר כניסה" value={`$${fmtPrice(trade.entryPrice as number)}`} />
              <DetailRow label="מחיר יציאה" value={`$${fmtPrice(trade.exitPrice ?? (trade.entryPrice as number))}`} />
              <DetailRow label="כיוון" value={directionLabel(trade.direction)} />
              <DetailRow label="מינוף" value={leverage > 1 ? `${leverage}x` : "ללא"} />
              <DetailRow label="גודל פוזיציה" value={qtyLabel} />
              <DetailRow label="מרג'ין / עלות" value={`$${fmtUsd(trade.cost)}`} />
              <DetailRow label="סיבת יציאה" value={ex.label} color={ex.color} />
              <DetailRow label="מקור / בוט" value={botLabel(trade)} />
              <DetailRow label="משך החזקה" value={dur ?? "—"} />
              <DetailRow label="נפתחה" value={trade.openedAt ? fmtDateTime(trade.openedAt) : "—"} />
              <DetailRow label="נסגרה" value={fmtDateTime(trade.closedAt)} />
              <DetailRow label="תקבול" value={`$${fmtUsd(trade.proceeds)}`} />
            </div>
          ) : (
            // Legacy trade without structured fields — show description + basics.
            <div className="space-y-2">
              <div className="rounded-lg border bg-card/60 p-3">
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">פרטי העסקה</div>
                <div className="font-mono text-xs text-foreground/90 break-words">{trade.description}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DetailRow label="עלות" value={`$${fmtUsd(trade.cost)}`} />
                <DetailRow label="סיבת יציאה" value={ex.label} color={ex.color} />
                <DetailRow label="מקור / בוט" value={botLabel(trade)} />
                {dur && <DetailRow label="משך החזקה" value={dur} />}
                <DetailRow label="נסגרה" value={fmtDateTime(trade.closedAt)} />
              </div>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <Cpu className="h-3 w-3" /> הדמיה חינוכית בלבד — ללא כסף אמיתי וללא הבטחת תשואות.
          </p>
        </div>
      </div>
    </div>
  );
}
