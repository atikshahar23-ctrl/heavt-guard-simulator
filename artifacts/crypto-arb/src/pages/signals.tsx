import { useState, useRef, useEffect, useCallback } from "react";
import {
  useGetScalpSignals,
  useGetMomentumCoins,
  useSendTelegramMessage,
  getGetScalpSignalsQueryKey,
  getGetMomentumCoinsQueryKey,
  type ScalpSignal,
  type MomentumCoin,
} from "@workspace/api-client-react";
import {
  Bell, BellOff, Send, Settings2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, RefreshCw, CheckCircle,
  AlertCircle, Zap, Rocket, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { CryptoIcon } from "@/components/crypto-icon";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";

/* ── Price helpers ─────────────────────────────────────────────── */

function fmtPrice(p: number): string {
  if (p === 0) return "0";
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  if (p >= 0.000001) return p.toFixed(8);
  return p.toFixed(10);
}

function fmtPct(p: number): string {
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
}

/* ── Telegram message builder ──────────────────────────────────── */

function buildTelegramMessage(kind: "scalp" | "momentum", s: ScalpSignal | MomentumCoin): string {
  const tpPct = ((s.takeProfit - s.entry) / s.entry) * 100;
  const slPct = ((s.stopLoss - s.entry) / s.entry) * 100;

  const dirLine =
    kind === "scalp"
      ? (s as ScalpSignal).direction === "LONG" ? "LONG 🟢"
        : (s as ScalpSignal).direction === "SHORT" ? "SHORT 🔴"
        : "NEUTRAL ⚪"
      : "LONG 🟢";

  const typeLine =
    kind === "scalp"
      ? `SCALP 15m · Score: ${s.score}/100 · Confidence: ${(s as ScalpSignal).confidence}`
      : `MOMENTUM 5m · Score: ${s.score}/100 · Stage: ${(s as MomentumCoin).stage}`;

  const extraLine =
    kind === "scalp"
      ? `📐 R:R = 1:${(s as ScalpSignal).riskReward.toFixed(1)}`
      : `📊 RVol: ${(s as MomentumCoin).rvol.toFixed(1)}x · ROC15m: ${fmtPct((s as MomentumCoin).roc15m)}`;

  const reasons = s.reasons.slice(0, 3).map((r) => `• ${r}`).join("\n");

  const now = new Date().toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });

  return [
    "🔔 Heavy Guard Signal",
    "",
    `📊 ${s.asset} (${s.symbol}) — ${dirLine}`,
    `⚡ ${typeLine}`,
    "",
    `💰 Entry: $${fmtPrice(s.entry)}`,
    `🎯 TP: $${fmtPrice(s.takeProfit)} (${fmtPct(tpPct)})`,
    `🛑 SL: $${fmtPrice(s.stopLoss)} (${fmtPct(slPct)})`,
    extraLine,
    "",
    "📋 Analysis:",
    reasons,
    "",
    `⏰ ${now} — Heavy Guard Paper Simulator`,
  ].join("\n");
}

/* ── localStorage helpers ──────────────────────────────────────── */
const LS_TOKEN = "hg_tg_token";
const LS_CHATID = "hg_tg_chatid";
const LS_AUTO = "hg_tg_autosend";
const LS_MINSCORE = "hg_tg_minscore";

function loadStr(key: string): string {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}
function saveStr(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch {}
}
function loadBool(key: string, def = false): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "true";
  } catch { return def; }
}
function loadNum(key: string, def: number): number {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : Number(v);
  } catch { return def; }
}

/* ── Signal ID (session-stable) ─────────────────────────────────── */
function signalId(kind: "scalp" | "momentum", s: ScalpSignal | MomentumCoin): string {
  if (kind === "scalp") return `s-${s.symbol}-${(s as ScalpSignal).direction}`;
  return `m-${s.symbol}-${(s as MomentumCoin).stage}`;
}

/* ── Unified signal type ───────────────────────────────────────── */
type TabFilter = "all" | "scalp" | "momentum";
type DirFilter = "ALL" | "LONG" | "SHORT";
type SendState = "idle" | "sending" | "sent" | "error";

/* ── Direction meta ────────────────────────────────────────────── */
function dirMeta(direction: string) {
  if (direction === "LONG") return { Icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10 border-green-400/30", label: "LONG" };
  if (direction === "SHORT") return { Icon: TrendingDown, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30", label: "SHORT" };
  return { Icon: Minus, color: "text-zinc-400", bg: "bg-zinc-400/10 border-zinc-400/30", label: "NEUT" };
}

/* ── Score bar ─────────────────────────────────────────────────── */
function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-zinc-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{score}</span>
    </div>
  );
}

/* ── Telegram settings panel ───────────────────────────────────── */
function TelegramPanel({
  token, setToken, chatId, setChatId,
  autoSend, setAutoSend, minScore, setMinScore,
  lang,
}: {
  token: string; setToken: (v: string) => void;
  chatId: string; setChatId: (v: string) => void;
  autoSend: boolean; setAutoSend: (v: boolean) => void;
  minScore: number; setMinScore: (v: number) => void;
  lang: "he" | "en";
}) {
  const [open, setOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testState, setTestState] = useState<SendState>("idle");
  const { mutateAsync } = useSendTelegramMessage();

  const isConfigured = Boolean(token.trim() && chatId.trim());

  const handleSave = () => {
    saveStr(LS_TOKEN, token.trim());
    saveStr(LS_CHATID, chatId.trim());
    saveStr(LS_AUTO, String(autoSend));
    saveStr(LS_MINSCORE, String(minScore));
    toast({ title: lang === "he" ? "הגדרות נשמרו" : "Settings saved" });
  };

  const handleClear = () => {
    setToken("");
    setChatId("");
    saveStr(LS_TOKEN, "");
    saveStr(LS_CHATID, "");
    toast({ title: lang === "he" ? "הגדרות נוקו" : "Settings cleared" });
  };

  const handleTest = async () => {
    if (!isConfigured) return;
    setTestState("sending");
    try {
      await mutateAsync({ data: { chatId: chatId.trim(), botToken: token.trim(), message: "🔔 Heavy Guard Test\n\nחיבור לטלגרם פועל! ✅\nTelegram connection is working! ✅\n\n⏰ Heavy Guard Paper Simulator" } });
      setTestState("sent");
      setTimeout(() => setTestState("idle"), 3000);
    } catch (err: unknown) {
      setTestState("error");
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: lang === "he" ? "שגיאה בשליחה" : "Send error", description: msg, variant: "destructive" });
      setTimeout(() => setTestState("idle"), 3000);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isConfigured
            ? <Bell className="w-4 h-4 text-green-400" />
            : <BellOff className="w-4 h-4 text-zinc-500" />}
          <span className="text-sm font-medium">
            {isConfigured ? t("signals.tg.configured", lang) : t("signals.tg.notConfigured", lang)}
          </span>
          {isConfigured && autoSend && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-mono">
              {lang === "he" ? "אוטו" : "AUTO"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">{t("signals.tg.desc", lang)}</p>

          <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1 text-xs text-muted-foreground">
            <p>{t("signals.tg.step1", lang)}</p>
            <p>{t("signals.tg.step2", lang)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">{t("signals.tg.tokenLabel", lang)}</label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t("signals.tg.tokenPlaceholder", lang)}
                  className="bg-black/40 border-white/20 text-xs pr-8 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">{t("signals.tg.chatIdLabel", lang)}</label>
              <Input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder={t("signals.tg.chatIdPlaceholder", lang)}
                className="bg-black/40 border-white/20 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted-foreground font-medium">{t("signals.autoSend", lang)}</label>
              <Switch checked={autoSend} onCheckedChange={(v) => { setAutoSend(v); saveStr(LS_AUTO, String(v)); }} />
            </div>
            {autoSend && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-muted-foreground">{t("signals.minScore", lang)}: {minScore}</label>
                </div>
                <Slider
                  value={[minScore]}
                  onValueChange={([v]) => { setMinScore(v); saveStr(LS_MINSCORE, String(v)); }}
                  min={40}
                  max={90}
                  step={5}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground text-xs h-7">
              {t("signals.tg.save", lang)}
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear} className="border-white/20 text-xs h-7">
              {t("signals.tg.clear", lang)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={!isConfigured || testState === "sending"}
              className="border-white/20 text-xs h-7 ml-auto"
            >
              {testState === "sending" ? (
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
              ) : testState === "sent" ? (
                <CheckCircle className="w-3 h-3 text-green-400 mr-1" />
              ) : testState === "error" ? (
                <AlertCircle className="w-3 h-3 text-red-400 mr-1" />
              ) : (
                <Send className="w-3 h-3 mr-1" />
              )}
              {t("signals.tg.testBtn", lang)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Single signal card ────────────────────────────────────────── */
function SignalCard({
  kind,
  signal,
  token,
  chatId,
  lang,
}: {
  kind: "scalp" | "momentum";
  signal: ScalpSignal | MomentumCoin;
  token: string;
  chatId: string;
  lang: "he" | "en";
}) {
  const [sendState, setSendState] = useState<SendState>("idle");
  const [showReasons, setShowReasons] = useState(false);
  const { mutateAsync } = useSendTelegramMessage();

  const scalpSig = kind === "scalp" ? (signal as ScalpSignal) : null;
  const momSig = kind === "momentum" ? (signal as MomentumCoin) : null;

  const direction = scalpSig?.direction ?? "LONG";
  const { Icon: DirIcon, color: dirColor, bg: dirBg, label: dirLabel } = dirMeta(direction);

  const tpPct = ((signal.takeProfit - signal.entry) / signal.entry) * 100;
  const slPct = ((signal.stopLoss - signal.entry) / signal.entry) * 100;

  const isConfigured = Boolean(token.trim() && chatId.trim());

  const handleSend = async () => {
    if (!isConfigured) {
      toast({ title: lang === "he" ? "יש להגדיר טלגרם תחילה" : "Configure Telegram first", variant: "destructive" });
      return;
    }
    setSendState("sending");
    try {
      const message = buildTelegramMessage(kind, signal);
      await mutateAsync({ data: { chatId: chatId.trim(), botToken: token.trim(), message } });
      setSendState("sent");
      setTimeout(() => setSendState("idle"), 4000);
    } catch (err: unknown) {
      setSendState("error");
      const msg = err instanceof Error ? err.message : (lang === "he" ? "שגיאת שליחה" : "Send failed");
      toast({ title: t("signals.sendError", lang), description: msg, variant: "destructive" });
      setTimeout(() => setSendState("idle"), 3000);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur hover:border-white/20 transition-all p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CryptoIcon asset={signal.asset} size={28} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm tracking-wide">{signal.asset}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{signal.symbol}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${dirBg} ${dirColor}`}>
                <DirIcon className="w-2.5 h-2.5" />
                {dirLabel}
              </span>
              {kind === "scalp" ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono">
                  <Zap className="w-2 h-2 inline mr-0.5" />
                  {t("signals.badge.scalp", lang)}
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono">
                  <Rocket className="w-2 h-2 inline mr-0.5" />
                  {t("signals.badge.momentum", lang)}
                </span>
              )}
            </div>
          </div>
        </div>
        <ScoreBar score={signal.score} />
      </div>

      {/* Confidence / Stage */}
      <div className="text-[11px] text-muted-foreground">
        {scalpSig && (
          <span>
            {t("signals.confidence", lang)}: <span className={scalpSig.confidence === "HIGH" ? "text-green-400" : scalpSig.confidence === "MEDIUM" ? "text-amber-400" : "text-zinc-400"}>{scalpSig.confidence}</span>
            <span className="mx-1.5 opacity-40">·</span>RSI: <span className="text-foreground/80">{scalpSig.rsi.toFixed(0)}</span>
            <span className="mx-1.5 opacity-40">·</span>R:R: <span className="text-foreground/80">1:{scalpSig.riskReward.toFixed(1)}</span>
          </span>
        )}
        {momSig && (
          <span>
            {t("signals.stage", lang)}: <span className={momSig.stage === "SURGING" ? "text-green-400" : momSig.stage === "HOT" ? "text-amber-400" : "text-zinc-400"}>{momSig.stage}</span>
            <span className="mx-1.5 opacity-40">·</span>RVol: <span className="text-foreground/80">{momSig.rvol.toFixed(1)}x</span>
            <span className="mx-1.5 opacity-40">·</span>ROC15m: <span className={momSig.roc15m >= 0 ? "text-green-400" : "text-red-400"}>{fmtPct(momSig.roc15m)}</span>
          </span>
        )}
      </div>

      {/* Prices */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/5 border border-white/10 p-2">
          <div className="text-[9px] text-muted-foreground mb-0.5">{t("signals.entry", lang)}</div>
          <div className="text-xs font-mono font-semibold">${fmtPrice(signal.entry)}</div>
        </div>
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2">
          <div className="text-[9px] text-green-400 mb-0.5">{t("signals.tp", lang)}</div>
          <div className="text-xs font-mono font-semibold text-green-400">${fmtPrice(signal.takeProfit)}</div>
          <div className="text-[9px] text-green-400/70">{fmtPct(tpPct)}</div>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
          <div className="text-[9px] text-red-400 mb-0.5">{t("signals.sl", lang)}</div>
          <div className="text-xs font-mono font-semibold text-red-400">${fmtPrice(signal.stopLoss)}</div>
          <div className="text-[9px] text-red-400/70">{fmtPct(slPct)}</div>
        </div>
      </div>

      {/* Reasons */}
      {signal.reasons.length > 0 && (
        <div>
          <button
            onClick={() => setShowReasons(!showReasons)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showReasons ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {t("signals.reasons", lang)} ({signal.reasons.length})
          </button>
          {showReasons && (
            <ul className="mt-1.5 space-y-0.5">
              {signal.reasons.map((r, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Send button */}
      <Button
        size="sm"
        onClick={handleSend}
        disabled={sendState === "sending"}
        className={`w-full h-7 text-xs font-medium transition-all ${
          sendState === "sent"
            ? "bg-green-600 hover:bg-green-600 text-white"
            : sendState === "error"
            ? "bg-red-600 hover:bg-red-600 text-white"
            : isConfigured
            ? "bg-primary/90 hover:bg-primary text-primary-foreground"
            : "bg-white/10 hover:bg-white/15 text-muted-foreground border border-white/15"
        }`}
      >
        {sendState === "sending" ? (
          <><RefreshCw className="w-3 h-3 animate-spin mr-1.5" />{t("signals.sending", lang)}</>
        ) : sendState === "sent" ? (
          <><CheckCircle className="w-3 h-3 mr-1.5" />{t("signals.sent", lang)}</>
        ) : sendState === "error" ? (
          <><AlertCircle className="w-3 h-3 mr-1.5" />{t("signals.sendError", lang)}</>
        ) : (
          <><Send className="w-3 h-3 mr-1.5" />{t("signals.sendBtn", lang)}</>
        )}
      </Button>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */
export default function SignalsPage() {
  const { lang } = useLanguage();
  const { isSignedIn } = useUser();

  const { data: scalpData, isLoading: scalpLoading, refetch: refetchScalp } = useGetScalpSignals({
    query: { queryKey: getGetScalpSignalsQueryKey(), refetchInterval: 30_000 },
  });
  const { data: momentumData, isLoading: momentumLoading, refetch: refetchMomentum } = useGetMomentumCoins({
    query: { queryKey: getGetMomentumCoinsQueryKey(), refetchInterval: 30_000 },
  });

  const [tab, setTab] = useState<TabFilter>("all");
  const [dirFilter, setDirFilter] = useState<DirFilter>("ALL");
  const [minScore, setMinScore] = useState<number>(() => loadNum(LS_MINSCORE, 60));
  const [autoSend, setAutoSend] = useState<boolean>(() => loadBool(LS_AUTO, false));
  const [token, setToken] = useState<string>(() => loadStr(LS_TOKEN));
  const [chatId, setChatId] = useState<string>(() => loadStr(LS_CHATID));

  const { mutateAsync: sendTelegram } = useSendTelegramMessage();
  const autoSentRef = useRef<Set<string>>(new Set());
  const isConfigured = Boolean(token.trim() && chatId.trim());

  /* ── Auto-send effect ────────────────────────────────────────── */
  const doAutoSend = useCallback(async (
    kind: "scalp" | "momentum",
    signals: (ScalpSignal | MomentumCoin)[],
  ) => {
    if (!autoSend || !isConfigured) return;
    for (const sig of signals) {
      if (sig.score < minScore) continue;
      const id = signalId(kind, sig);
      if (autoSentRef.current.has(id)) continue;
      autoSentRef.current.add(id);
      try {
        const message = buildTelegramMessage(kind, sig);
        await sendTelegram({ data: { chatId: chatId.trim(), botToken: token.trim(), message } });
      } catch {
        // silent — don't spam user with toast on auto-send failures
      }
    }
  }, [autoSend, isConfigured, minScore, chatId, token, sendTelegram]);

  useEffect(() => {
    if (scalpData?.length) {
      void doAutoSend("scalp", scalpData);
    }
  }, [scalpData, doAutoSend]);

  useEffect(() => {
    if (momentumData?.length) {
      void doAutoSend("momentum", momentumData);
    }
  }, [momentumData, doAutoSend]);

  /* ── Merge + filter ─────────────────────────────────────────── */
  type UnifiedEntry =
    | { kind: "scalp"; signal: ScalpSignal }
    | { kind: "momentum"; signal: MomentumCoin };

  const unified: UnifiedEntry[] = [];

  if (tab !== "momentum") {
    (scalpData ?? []).forEach((s) => {
      if (dirFilter !== "ALL" && s.direction !== dirFilter) return;
      if (s.score < minScore - 20) return;
      unified.push({ kind: "scalp", signal: s });
    });
  }
  if (tab !== "scalp") {
    (momentumData ?? []).forEach((s) => {
      if (dirFilter === "SHORT") return; // momentum is always LONG
      if (s.score < minScore - 20) return;
      unified.push({ kind: "momentum", signal: s });
    });
  }
  unified.sort((a, b) => b.signal.score - a.signal.score);

  const isLoading = scalpLoading || momentumLoading;
  const handleRefresh = () => { void refetchScalp(); void refetchMomentum(); };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-wide">
            {t("signals.title", lang)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("signals.subtitle", lang)}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          className="border-white/20 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Telegram panel */}
      {isSignedIn && (
        <TelegramPanel
          token={token} setToken={setToken}
          chatId={chatId} setChatId={setChatId}
          autoSend={autoSend} setAutoSend={setAutoSend}
          minScore={minScore} setMinScore={setMinScore}
          lang={lang}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tab filter */}
        <div className="flex items-center rounded-lg border border-white/15 overflow-hidden text-xs">
          {(["all", "scalp", "momentum"] as TabFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTab(f)}
              className={`px-3 py-1.5 transition-colors ${
                tab === f ? "bg-white/15 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`signals.tab.${f}`, lang)}
            </button>
          ))}
        </div>

        {/* Direction filter */}
        <div className="flex items-center rounded-lg border border-white/15 overflow-hidden text-xs">
          {(["ALL", "LONG", "SHORT"] as DirFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDirFilter(d)}
              className={`px-3 py-1.5 transition-colors ${
                dirFilter === d ? "bg-white/15 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`signals.dir.${d.toLowerCase()}`, lang)}
            </button>
          ))}
        </div>

        {/* Min score quick filter */}
        <div className="flex items-center gap-1.5 ms-auto text-xs text-muted-foreground">
          <span>{t("signals.minScore", lang)}: {minScore - 20}+</span>
          <Slider
            value={[minScore]}
            onValueChange={([v]) => setMinScore(v)}
            min={40}
            max={90}
            step={5}
            className="w-24"
          />
        </div>
      </div>

      {/* Signal grid */}
      {isLoading && unified.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : unified.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Bell className="w-8 h-8 opacity-30" />
          <p className="text-sm">{t("signals.noSignals", lang)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {unified.map((entry) => (
            <SignalCard
              key={signalId(entry.kind, entry.signal)}
              kind={entry.kind}
              signal={entry.signal}
              token={token}
              chatId={chatId}
              lang={lang}
            />
          ))}
        </div>
      )}
    </div>
  );
}
