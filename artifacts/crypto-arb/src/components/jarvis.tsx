import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useGetRecommendations, getGetRecommendationsQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetInfluencerSignals, getGetInfluencerSignalsQueryKey,
  useGetMomentumCoins, getGetMomentumCoinsQueryKey,
  useGetScalpSignals, getGetScalpSignalsQueryKey,
  Recommendation, StockRecommendation,
} from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader } from "@/contexts/autotrader-context";
import { useLocation } from "wouter";
import { X, Send, Sparkles, ExternalLink, Mic, MicOff, Volume2, VolumeX, Zap } from "lucide-react";
import logoUrl from "@/assets/logo-heavy-guard.png";

interface MsgLink {
  label: string;
  href: string;
  /** When true the link navigates inside the app (wouter) instead of opening a new tab. */
  internal?: boolean;
}
interface Msg {
  id: string;
  role: "jarvis" | "user";
  text: string;
  links?: MsgLink[];
  lang?: Lang;
}

type Lang = "en" | "he";
const LANG_STORAGE = "jarvis-lang";

function loadLang(): Lang {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANG_STORAGE) === "he" ? "he" : "en";
}

type Intent = "help" | "smart" | "buy" | "sell" | "crypto" | "portfolio" | "mood" | "boost";

interface QuickAction {
  intent: Intent;
  en: string;
  he: string;
}
const QUICK_ACTIONS: QuickAction[] = [
  { intent: "buy", en: "Top stock to buy", he: "מניה לקנייה" },
  { intent: "sell", en: "Stocks to avoid", he: "מניות להימנע" },
  { intent: "smart", en: "Smart money", he: "כסף חכם" },
  { intent: "crypto", en: "Crypto signal", he: "סיגנל קריפטו" },
  { intent: "boost", en: "Boost now?", he: "להפעיל בוסט?" },
  { intent: "mood", en: "Market mood", he: "מצב השוק" },
  { intent: "portfolio", en: "My portfolio", he: "התיק שלי" },
];

function greeting(l: Lang): string {
  return l === "he"
    ? "ג'רוויס מחובר. אני קורא את הסיגנלים החיים של בינאנס, פולימרקט, מניות וכסף חכם, וגם את התיק שלך בסימולטור. גרור אותי לכל מקום, דבר איתי במיקרופון, או הקש על קיצור למטה."
    : "JARVIS online, sir. I am monitoring the live Binance, Polymarket, equity and Smart-Money feeds, along with your simulator portfolio. Drag me anywhere, address me through the microphone, or select a shortcut below.";
}

function horizonHe(h: string): string {
  return h === "SHORT" ? "קצר" : h === "LONG" ? "ארוך" : "בינוני";
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function tvLink(tvSymbol: string): MsgLink {
  return { label: "Chart", href: `https://www.tradingview.com/symbols/${tvSymbol}/` };
}
function newsLink(symbol: string, name: string): MsgLink {
  return { label: "News", href: `https://news.google.com/search?q=${encodeURIComponent(`${symbol} ${name} stock`)}` };
}

/* ─────────────────────────────────────────────────────────────
   JARVIS avatar — the brand bull logo inside a glowing ring that
   pulses while JARVIS is speaking.
   ───────────────────────────────────────────────────────────── */
function JarvisFace({ speaking, size = 48 }: { speaking: boolean; size?: number }) {
  const gold = "hsl(207 30% 70%)";
  const cyan = "hsl(39 28% 72%)";
  return (
    <div className="relative grid place-items-center rounded-full" style={{ width: size, height: size }}>
      {/* scanning aura ring echoing the brand bull */}
      <span
        className="absolute rounded-full jarvis-ring"
        style={{ inset: -2, border: `1px dashed ${cyan}`, opacity: 0.5 }}
      />
      <img
        src={logoUrl}
        alt="JARVIS"
        draggable={false}
        className={`h-full w-full rounded-full object-cover ${speaking ? "jarvis-speaking" : ""}`}
        style={{
          boxShadow: `inset 0 0 0 1.5px ${gold}`,
          filter: speaking
            ? "drop-shadow(0 0 7px hsl(207 30% 70% / 0.85))"
            : "drop-shadow(0 0 3px hsl(207 30% 70% / 0.5))",
        }}
      />
    </div>
  );
}

export function Jarvis() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<Lang>(loadLang);
  const langRef = useRef(lang);
  langRef.current = lang;
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(LANG_STORAGE, lang);
  }, [lang]);

  const initialMsg = useRef<Msg>({ id: uid(), role: "jarvis", text: greeting(loadLang()), lang: loadLang() });
  const [messages, setMessages] = useState<Msg[]>(() => [initialMsg.current]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: cryptoRecs } = useGetRecommendations({
    query: { queryKey: getGetRecommendationsQueryKey(), refetchInterval: open ? 30000 : 90000 },
  });
  const { data: stockRecs } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: open ? 30000 : 90000 },
  });
  const { data: stocks } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: open ? 30000 : 90000 },
  });
  const { data: influencers } = useGetInfluencerSignals({
    query: { queryKey: getGetInfluencerSignalsQueryKey(), refetchInterval: open ? 60000 : 180000 },
  });
  // Live crypto "heat" feeds powering the Boost advisor. Shared query keys so these
  // dedupe with the momentum/scalp pages instead of multiplying upstream fan-out.
  const { data: momentum } = useGetMomentumCoins({
    query: { queryKey: getGetMomentumCoinsQueryKey(), refetchInterval: open ? 30000 : 60000 },
  });
  const { data: scalp } = useGetScalpSignals({
    query: { queryKey: getGetScalpSignalsQueryKey(), refetchInterval: open ? 30000 : 60000 },
  });

  const { settings: atSettings, startBoost } = useAutoTrader();
  const { cash, totalDeposited, polyPositions, binancePositions, stockPositions, tradeHistory } = usePortfolio();
  const [, navigate] = useLocation();

  // Internal "quick demo-trade" link offered alongside each recommendation.
  const tradeLink = useCallback((kind: "stock" | "crypto"): MsgLink => ({
    label: lang === "he" ? "מסחר מהיר בדמו" : "Quick demo trade",
    href: kind === "crypto" ? "/markets" : "/recommendations",
    internal: true,
  }), [lang]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  /* ── Voice output (TTS) ─────────────────────────────────────── */
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Available system voices (loaded asynchronously by the browser).
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!ttsSupported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, [ttsSupported]);

  const pickVoice = useCallback((l: Lang): SpeechSynthesisVoice | undefined => {
    const voices = voicesRef.current;
    if (!voices.length) return undefined;
    const all = voices.filter((v) => v.lang?.toLowerCase().startsWith(l === "he" ? "he" : "en"));
    if (!all.length) return undefined;
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      const name = v.name.toLowerCase();
      if (/premium|enhanced|neural|wavenet|advanced|pro/.test(name)) s += 100;
      if (v.name.includes("Google")) s += 60;
      if (v.name.includes("Apple")) s += 50;
      if (v.name.includes("Microsoft")) s += 40;
      if (l === "en") {
        if (/daniel|arthur|oliver|george|british|uk english male/i.test(name)) s += 20;
      } else {
        if (/carmit|hebrew|il|premium/i.test(name)) s += 20;
      }
      if (/basic|compact|low|test|default/.test(name)) s -= 30;
      return s;
    };
    const sorted = [...all].sort((a, b) => score(b) - score(a));
    return sorted[0];
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || mutedRef.current) return;
      try {
        window.speechSynthesis.cancel();
        const l = langRef.current;
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice(l);
        if (v) u.voice = v;
        if (l === "he") {
          u.lang = v?.lang ?? "he-IL";
          u.rate = 1.0;
          u.pitch = 1.0;
        } else {
          // Measured, slightly synthetic sci-fi cadence — Iron Man's JARVIS.
          u.lang = v?.lang ?? "en-GB";
          u.rate = 0.92;
          u.pitch = 0.7;
        }
        u.volume = 1;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } catch {
        setSpeaking(false);
      }
    },
    [ttsSupported, pickVoice],
  );

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [ttsSupported]);

  // Speak each new JARVIS message once.
  // Seeded with the greeting's id so JARVIS stays SILENT on app open — it only
  // speaks replies to messages the user actually triggers.
  const lastSpokenRef = useRef<string | null>(initialMsg.current.id);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "jarvis") return;
    if (lastSpokenRef.current === last.id) return;
    lastSpokenRef.current = last.id;
    if (!muted) speak(last.text);
  }, [messages, muted, speak]);

  useEffect(() => {
    if (muted) stopSpeaking();
  }, [muted, stopSpeaking]);

  const topBuys = useMemo(() => (stockRecs ?? []).filter((r) => r.action === "BUY"), [stockRecs]);
  const topSells = useMemo(() => (stockRecs ?? []).filter((r) => r.action === "SELL"), [stockRecs]);
  const topGainers = useMemo(
    () => [...(stocks ?? [])].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
    [stocks],
  );

  // ── Proactive recommendations that pop up while the panel is closed ──
  interface Tip { id: string; label: string; tone: "buy" | "crypto" | "sell" | "smart"; text: string; links?: MsgLink[]; }
  const tips = useMemo<Tip[]>(() => {
    const he = lang === "he";
    const out: Tip[] = [];
    const buy = topBuys[0];
    if (buy) {
      out.push({
        id: `buy-${buy.symbol}`,
        label: he ? `קנייה ${buy.symbol} · ${buy.confidence}` : `Buy ${buy.symbol} · ${buy.confidence}`,
        tone: "buy",
        text: he
          ? `המניה החזקה ביותר לקנייה: ${buy.symbol} (${buy.name}) — ביטחון ${buy.confidence}. ${buy.rationale}`
          : `Strongest stock to buy, sir: ${buy.symbol} (${buy.name}) — ${buy.confidence} confidence. ${buy.rationale}`,
        links: [tradeLink("stock"), tvLink(buy.tradingViewSymbol), newsLink(buy.symbol, buy.name)],
      });
    }
    const inf = (influencers ?? [])[0];
    if (inf) {
      const conf = Math.round(inf.confidence);
      out.push({
        id: `smart-${inf.influencer}-${inf.ticker}`,
        label: `${inf.direction} ${inf.ticker} · ${conf}%`,
        tone: "smart",
        text: he
          ? `כסף חכם: ${inf.influencer} מזיז את ${inf.ticker} (${inf.name}). סיגנל ${inf.direction} בביטחון ${conf}%. "${inf.headline}"`
          : `Smart-Money, sir: ${inf.influencer} is moving ${inf.ticker} (${inf.name}). Signal ${inf.direction} at ${conf}% conviction. "${inf.headline}"`,
        links: [tradeLink("stock"), { label: he ? "כתבה" : "Article", href: inf.url }, tvLink(inf.ticker.replace(".", ""))],
      });
    }
    const crypto = (cryptoRecs ?? []).filter((r) => r.action !== "WATCH")[0];
    if (crypto) {
      const dir = crypto.action === "BUY_YES" ? "BUY YES" : "BUY NO";
      out.push({
        id: `crypto-${crypto.binanceSymbol}`,
        label: `${dir} ${crypto.binanceSymbol} · ${crypto.confidence}`,
        tone: "crypto",
        text: he
          ? `הסיגנל המוביל בקריפטו/פולימרקט: ${dir} על ${crypto.binanceSymbol} (ביטחון ${crypto.confidence}). ${crypto.rationale} יתרון ~${crypto.edge.toFixed(1)} נק', פוטנציאל ${crypto.potentialReturn.toFixed(1)}x.`
          : `Top crypto/Polymarket signal, sir: ${dir} on ${crypto.binanceSymbol} (${crypto.confidence} confidence). ${crypto.rationale} Edge ~${crypto.edge.toFixed(1)} pts, potential ${crypto.potentialReturn.toFixed(1)}x.`,
        links: [tradeLink("crypto"), tvLink(crypto.binanceSymbol.replace("USDT", "USD"))],
      });
    }
    const sell = topSells[0];
    if (sell) {
      out.push({
        id: `sell-${sell.symbol}`,
        label: he ? `הימנע ${sell.symbol}` : `Avoid ${sell.symbol}`,
        tone: "sell",
        text: he
          ? `כדאי להימנע או לצמצם את ${sell.symbol} (${sell.name}). ${sell.rationale}`
          : `Avoid or consider trimming ${sell.symbol} (${sell.name}), sir. ${sell.rationale}`,
        links: [tradeLink("stock"), tvLink(sell.tradingViewSymbol), newsLink(sell.symbol, sell.name)],
      });
    }
    return out;
  }, [topBuys, topSells, cryptoRecs, influencers, lang, tradeLink]);

  const [tipIdx, setTipIdx] = useState(0);
  const [mutedUntil, setMutedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Cap how often each distinct tip nags: once a tip id has surfaced twice we
  // stop showing it and move on to the next eligible one. Counts are keyed by
  // tip id (e.g. `buy-AAPL`) and live in a ref so incrementing never re-renders.
  const TIP_CAP = 2;
  const seenCountsRef = useRef<Record<string, number>>({});

  // Drop counts for tips that no longer exist so fresh recommendations (new ids)
  // start uncapped — i.e. the cap resets whenever the tip ids change.
  const tipIdsKey = tips.map((t) => t.id).join("|");
  useEffect(() => {
    const valid = new Set(tips.map((t) => t.id));
    for (const k of Object.keys(seenCountsRef.current)) {
      if (!valid.has(k)) delete seenCountsRef.current[k];
    }
  }, [tipIdsKey]);

  // Rotate proactive tips and keep a clock so the muted window re-opens on its own.
  // The clock ticks whenever the panel is closed (even with no tips) so the Boost
  // advisor stays responsive.
  useEffect(() => {
    if (open) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (tips.length > 0) setTipIdx((i) => i + 1);
    }, 16000);
    return () => clearInterval(t);
  }, [open, tips.length]);

  // Only rotate through tips that haven't hit the surfacing cap yet.
  const eligibleTips = tips.filter((t) => (seenCountsRef.current[t.id] ?? 0) < TIP_CAP);
  const currentTip = eligibleTips.length > 0 ? eligibleTips[tipIdx % eligibleTips.length] : null;
  const showTip = !open && currentTip != null && now >= mutedUntil;

  // Count one surfacing each time a tip takes its rotation slot (not muted/open).
  useEffect(() => {
    if (open || !currentTip || now < mutedUntil) return;
    seenCountsRef.current[currentTip.id] = (seenCountsRef.current[currentTip.id] ?? 0) + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipIdx, currentTip?.id]);

  const openWithTip = useCallback((tip: Tip) => {
    setMessages((prev) => [...prev, { id: uid(), role: "jarvis", text: tip.text, links: tip.links, lang: langRef.current }]);
    setOpen(true);
  }, []);

  const dismissTip = useCallback(() => {
    setNow(Date.now());
    setMutedUntil(Date.now() + 3 * 60 * 1000);
  }, []);

  /* ── Boost advisor ───────────────────────────────────────────
     Reads the live crypto "heat" (momentum surges + strong scalp signals) and
     decides whether a max-cadence Boost run is worthwhile and for how long.
     Educational/demo only — it suggests a trading-tempo window, never a return. */
  const boostAdvice = useMemo(() => {
    const he = lang === "he";
    const coins = momentum ?? [];
    const sigs = scalp ?? [];
    const strong = coins.filter((c) => c.score >= 70 && (c.stage === "SURGING" || c.stage === "HOT"));
    const building = coins.filter((c) => c.score >= 55 && c.stage === "BUILDING");
    const hiScalps = sigs.filter((s) => s.confidence === "HIGH" && s.direction !== "NEUTRAL");
    const medScalps = sigs.filter((s) => s.confidence === "MEDIUM" && s.direction !== "NEUTRAL");
    const avgRvol = strong.length ? strong.reduce((a, c) => a + (c.rvol || 0), 0) / strong.length : 0;

    const heat = Math.round(Math.min(100,
      strong.length * 16 + building.length * 6 +
      hiScalps.length * 12 + medScalps.length * 4 +
      Math.min(18, Math.max(0, (avgRvol - 1) * 12)),
    ));

    const worth = heat >= 45 && (strong.length >= 2 || hiScalps.length >= 3);
    const durationMin = heat >= 80 ? 60 : heat >= 62 ? 30 : 15;
    const level: "warm" | "strong" | "extreme" = heat >= 80 ? "extreme" : heat >= 62 ? "strong" : "warm";
    const names = strong.slice(0, 3).map((c) => c.asset).join(", ");

    const label = he
      ? (level === "extreme" ? `שוק רותח · בוסט ${durationMin}ד׳` : level === "strong" ? `שוק חם · בוסט ${durationMin}ד׳` : `חלון פעולה · בוסט ${durationMin}ד׳`)
      : (level === "extreme" ? `Market on fire · Boost ${durationMin}m` : level === "strong" ? `Hot market · Boost ${durationMin}m` : `Active window · Boost ${durationMin}m`);
    const coinsHe = strong.length === 1 ? "מטבע אחד בזינוק" : `${strong.length} מטבעות בזינוק`;
    const coinsEn = strong.length === 1 ? "1 coin surging" : `${strong.length} coins surging`;
    const scalpsHe = hiScalps.length === 1 ? "סיגנל סקאלפ חזק אחד" : `${hiScalps.length} סיגנלי סקאלפ חזקים`;
    const scalpsEn = hiScalps.length === 1 ? "1 strong scalp signal" : `${hiScalps.length} strong scalp signals`;
    const text = he
      ? `התראת בוסט: השוק חם עכשיו — ${coinsHe}${names ? ` (${names})` : ""} ו-${scalpsHe}. זה החלון להפעיל מהירות האור ל-${durationMin} דקות. (לימוד/דמו בלבד — בלי הבטחת רווח.)`
      : `Boost alert, sir: the market is hot — ${coinsEn}${names ? ` (${names})` : ""} and ${scalpsEn}. This is the window to engage light-speed for ${durationMin} minutes. (Demo/educational only — no profit promised.)`;
    return { worth, heat, durationMin, level, strong: strong.length, hiScalps: hiScalps.length, label, text };
  }, [momentum, scalp, lang]);

  const [boostMutedUntil, setBoostMutedUntil] = useState(0);
  const boostActive = atSettings.boostUntil > now;
  const showBoostAlert = !open && boostAdvice.worth && atSettings.boostUntil <= now && now >= boostMutedUntil;

  // Announce a fresh boost window once (per level/duration) so the alert is impossible to miss.
  const boostSpokeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showBoostAlert) {
      if (!boostAdvice.worth) boostSpokeRef.current = null;
      return;
    }
    const sig = `${boostAdvice.level}-${boostAdvice.durationMin}`;
    if (boostSpokeRef.current === sig) return;
    boostSpokeRef.current = sig;
    // JARVIS only speaks when explicitly activated by the user, not on auto-alerts.
  }, [showBoostAlert, boostAdvice]);

  const activateBoost = useCallback(() => {
    const min = boostAdvice.durationMin;
    startBoost(min * 60_000);
    setBoostMutedUntil(Date.now() + 30 * 60 * 1000);
    const l = langRef.current;
    setMessages((prev) => [...prev, {
      id: uid(), role: "jarvis", lang: l,
      text: l === "he"
        ? `מצוין. הפעלתי מהירות האור ל-${min} דקות — כל הבוטים בקצב מקסימלי. אעדכן כשהחלון נסגר. (דמו/לימוד בלבד.)`
        : `Engaged, sir. Light-speed is on for ${min} minutes — the whole fleet is at maximum cadence. I'll advise when the window closes. (Demo/educational only.)`,
    }]);
  }, [boostAdvice.durationMin, startBoost]);

  const dismissBoost = useCallback(() => {
    setNow(Date.now());
    setBoostMutedUntil(Date.now() + 8 * 60 * 1000);
  }, []);

  const respond = useCallback(
    (raw: string, l: Lang, forced?: Intent): Msg => {
      const q = raw.toLowerCase().trim();
      const id = uid();
      const he = l === "he";

      const detect = (): Intent => {
        if (/\b(help|what can you|how do you|commands)\b/.test(q) || /עזרה|מה אתה|פקודות/.test(raw)) return "help";
        if (/\b(smart money|smart-money|influencer|trump|musk|elon|buffett|powell|pelosi|cathie|whale)/.test(q) || /כסף חכם|משפיע|טראמפ|מאסק|פאוול|באפט/.test(raw)) return "smart";
        if (/\b(portfolio|balance|account|my money|how am i|wallet|position)/.test(q) || /תיק|יתרה|חשבון|פוזיצי/.test(raw)) return "portfolio";
        if (/\b(crypto|btc|bitcoin|eth|ethereum|sol|coin|poly|polymarket|arb|futures)/.test(q) || /קריפטו|ביטקוי|את'ריום|פולימרקט/.test(raw)) return "crypto";
        if (/\b(sell|short|avoid|dump|drop|exit|weak)/.test(q) || /מכירה|מכור|שורט|להימנע|לצמצם/.test(raw)) return "sell";
        if (/\b(mood|market|sentiment|overall|outlook|today)/.test(q) || /מצב השוק|סנטימנט|מצב רוח/.test(raw)) return "mood";
        if (/\b(boost|turbo|light.?speed|max speed|faster|fast mode)/.test(q) || /בוסט|מהירות האור|טורבו|להאיץ|מהיר/.test(raw)) return "boost";
        if (/\b(buy|long|enter|best stock|top stock|invest|gain)/.test(q) || /קנייה|קנה|לונג|להשקיע/.test(raw)) return "buy";
        return q.length > 0 ? "buy" : "mood";
      };
      const intent = forced ?? detect();

      if (intent === "boost") {
        const active = atSettings.boostUntil > Date.now();
        if (active) {
          const remain = Math.max(1, Math.round((atSettings.boostUntil - Date.now()) / 60000));
          return {
            id, role: "jarvis",
            text: he
              ? `מהירות האור כבר פעילה — נשארו כ-${remain} דקות. אתן לה לרוץ ואתריע כשתסתיים.`
              : `Light-speed is already active, sir — about ${remain} minute${remain > 1 ? "s" : ""} remain. I'll let it run and advise when it ends.`,
          };
        }
        if (boostAdvice.worth) return { id, role: "jarvis", text: boostAdvice.text };
        return {
          id, role: "jarvis",
          text: he
            ? `השוק רגוע כרגע (חום ${boostAdvice.heat}/100) — חבל לבזבז בוסט. אני סורק את הקריפטו כל הזמן ואתריע ברגע שייפתח חלון חם.`
            : `The market is calm right now, sir (heat ${boostAdvice.heat}/100) — no need to spend a Boost. I'm scanning the crypto feeds continuously and will alert you the moment a hot window opens.`,
        };
      }

      if (intent === "help") {
        return {
          id,
          role: "jarvis",
          text: he
            ? "לשירותך. אני יכול להציג את המניה החזקה ביותר לקנייה, מניות שכדאי להימנע מהן, סיגנלים של כסף חכם ממשפיענים (טראמפ, מאסק, פאוול…), את העסקה הטובה ביותר בקריפטו/פולימרקט, את מצב השוק, וקריאה של התיק שלך בסימולטור. השתמש בקיצורים, הקלד, או הקש על המיקרופון ודבר."
            : "At your service, sir. I can surface the strongest equity to BUY, names to AVOID, Smart-Money influencer signals (Trump, Musk, Powell…), the optimal crypto/Polymarket play, the prevailing market mood, and a reading of your simulator portfolio. Use the shortcuts, type, or tap the microphone and speak.",
        };
      }

      if (intent === "smart") {
        const pick = (influencers ?? [])[0];
        if (!pick) {
          return {
            id, role: "jarvis",
            text: he
              ? "עדיין לא נטענו סיגנלים של כסף חכם — תן לפיד החדשות רגע ונסה שוב."
              : "No Smart-Money signals have loaded yet, sir — allow the news feed a moment and ask again.",
          };
        }
        const conf = Math.round(pick.confidence);
        return {
          id, role: "jarvis",
          text: he
            ? `כסף חכם: ${pick.influencer} מזיז את ${pick.ticker} (${pick.name}) — סיגנל ${pick.direction} בביטחון ${conf}% (טווח ${horizonHe(pick.horizon)}). כותרת: "${pick.headline}".`
            : `Smart-Money, sir: ${pick.influencer} is moving ${pick.ticker} (${pick.name}) — signal ${pick.direction} at ${conf}% conviction (${pick.horizon.toLowerCase()}-term). Headline: "${pick.headline}".`,
          links: [tradeLink("stock"), { label: he ? "כתבה" : "Article", href: pick.url }, tvLink(pick.ticker.replace(".", ""))],
        };
      }

      if (intent === "portfolio") {
        const openCount = polyPositions.length + binancePositions.length + stockPositions.length;
        const realized = tradeHistory.reduce((s, t) => s + t.pnl, 0);
        const wins = tradeHistory.filter((t) => t.pnl > 0).length;
        const winRate = tradeHistory.length ? Math.round((wins / tradeHistory.length) * 100) : 0;
        const cashStr = cash.toLocaleString(undefined, { maximumFractionDigits: 0 });
        const depStr = totalDeposited.toLocaleString(undefined, { maximumFractionDigits: 0 });
        const realStr = `${realized >= 0 ? "+" : "-"}$${Math.abs(realized).toFixed(0)}`;
        if (he) {
          const deployed = openCount === 0 ? "אין לך פוזיציות פתוחות — יש הרבה תחמושת לפעולה." : `יש לך ${openCount} פוזיציות פתוחות.`;
          const advice = realized < 0 ? "הדק את הכניסות — פעל רק על סיגנלים בביטחון גבוה או בינוני." : "כל הכבוד — שמור על סיכון קטן ותן לסיגנלי המומנטום להוביל.";
          return { id, role: "jarvis", text: `מזומן זמין: $${cashStr} מתוך $${depStr} שהופקדו. ${deployed} עסקאות סגורות: ${tradeHistory.length} (${winRate}% הצלחה, ממומש ${realStr}). ${advice}` };
        }
        const deployed = openCount === 0 ? "You hold no open positions — ample dry powder to deploy." : `You hold ${openCount} open position${openCount > 1 ? "s" : ""}.`;
        const advice = realized < 0 ? "Tighten your entries — act only on HIGH or MEDIUM conviction signals." : "Well played — keep the risk small and let the momentum signals lead.";
        return { id, role: "jarvis", text: `Cash available: $${cashStr} of $${depStr} deposited, sir. ${deployed} Closed trades: ${tradeHistory.length} (${winRate}% win rate, realized ${realStr}). ${advice}` };
      }

      if (intent === "crypto") {
        const actionable = (cryptoRecs ?? []).filter((r) => r.action !== "WATCH");
        const pick: Recommendation | undefined = actionable[0] ?? (cryptoRecs ?? [])[0];
        if (!pick) {
          return {
            id, role: "jarvis",
            text: he
              ? "עדיין לא נטענו סיגנלי קריפטו — תן לסורק רגע ונסה שוב."
              : "No crypto signals have loaded yet, sir — give the scanner a moment and ask again.",
          };
        }
        const dir = pick.action === "BUY_YES" ? "BUY YES" : pick.action === "BUY_NO" ? "BUY NO" : "WATCH";
        return {
          id, role: "jarvis",
          text: he
            ? `הסיגנל המוביל בקריפטו/פולימרקט: ${dir} על ${pick.binanceSymbol} (ביטחון ${pick.confidence}). ${pick.rationale} יתרון ~${pick.edge.toFixed(1)} נק', פוטנציאל ${pick.potentialReturn.toFixed(1)}x.`
            : `Top crypto/Polymarket signal, sir: ${dir} on ${pick.binanceSymbol} (${pick.confidence} confidence). ${pick.rationale} Edge ~${pick.edge.toFixed(1)} pts, potential ${pick.potentialReturn.toFixed(1)}x.`,
          links: [tradeLink("crypto"), tvLink(pick.binanceSymbol.replace("USDT", "USD"))],
        };
      }

      if (intent === "sell") {
        const pick: StockRecommendation | undefined = topSells[0];
        if (!pick) {
          return {
            id, role: "jarvis",
            text: he
              ? "כרגע שום דבר לא מאותת מכירה חזקה — המומנטום בעיקר ניטרלי עד חיובי."
              : "Nothing is flashing a strong SELL at present, sir — momentum is broadly neutral-to-positive.",
          };
        }
        return {
          id, role: "jarvis",
          text: he
            ? `כדאי להימנע או לצמצם את ${pick.symbol} (${pick.name}). ${pick.rationale}`
            : `Avoid or consider trimming ${pick.symbol} (${pick.name}), sir. ${pick.rationale}`,
          links: [tradeLink("stock"), tvLink(pick.tradingViewSymbol), newsLink(pick.symbol, pick.name)],
        };
      }

      if (intent === "buy") {
        const pick: StockRecommendation | undefined = topBuys[0];
        if (!pick) {
          const g = topGainers[0];
          const gainer = g
            ? (he
              ? `${g.symbol} (${g.changePercent >= 0 ? "+" : ""}${g.changePercent.toFixed(1)}% היום)`
              : `${g.symbol} (${g.changePercent >= 0 ? "+" : ""}${g.changePercent.toFixed(1)}% today)`)
            : (he ? "הנתונים עדיין נטענים." : "data still loading.");
          return {
            id, role: "jarvis",
            text: he
              ? `אין כרגע קנייה בביטחון גבוה במניות. הביצוע החזק ביותר בטווח הקרוב: ${gainer}`
              : `No high-conviction equity BUY at the moment, sir. Best near-term performer: ${gainer}`,
            links: g ? [tradeLink("stock"), tvLink(g.tradingViewSymbol), newsLink(g.symbol, g.name)] : [tradeLink("stock")],
          };
        }
        return {
          id, role: "jarvis",
          text: he
            ? `המניה החזקה ביותר לקנייה: ${pick.symbol} (${pick.name}) — ביטחון ${pick.confidence}. ${pick.rationale}`
            : `Strongest equity to buy, sir: ${pick.symbol} (${pick.name}) — ${pick.confidence} confidence. ${pick.rationale}`,
          links: [tradeLink("stock"), tvLink(pick.tradingViewSymbol), newsLink(pick.symbol, pick.name)],
        };
      }

      // Market mood (default)
      const buys = topBuys.length;
      const sells = topSells.length;
      const moodEn = buys > sells * 1.5 ? "risk-on — buyers in control" : sells > buys * 1.5 ? "risk-off — sellers in control" : "mixed — no clear bias";
      const moodHe = buys > sells * 1.5 ? "ריסק-און — הקונים בשליטה" : sells > buys * 1.5 ? "ריסק-אוף — המוכרים בשליטה" : "מעורב — אין הטיה ברורה";
      const leaders = topGainers.map((g) => `${g.symbol} ${g.changePercent >= 0 ? "+" : ""}${g.changePercent.toFixed(1)}%`).join(", ");
      if (he) {
        const gl = topGainers.length ? ` המובילות היום: ${leaders}.` : "";
        return { id, role: "jarvis", text: `מצב השוק: ${moodHe}. סיגנלי מניות: ${buys} קנייה מול ${sells} מכירה.${gl}` };
      }
      const gl = topGainers.length ? ` Today's leaders: ${leaders}.` : "";
      return { id, role: "jarvis", text: `Market mood is ${moodEn}, sir. Equity signals: ${buys} BUY versus ${sells} SELL.${gl}` };
    },
    [cryptoRecs, topBuys, topSells, topGainers, influencers, cash, totalDeposited, polyPositions, binancePositions, stockPositions, tradeHistory, tradeLink, atSettings.boostUntil, boostAdvice],
  );

  const send = useCallback(
    (text: string, intent?: Intent) => {
      const clean = text.trim();
      if (!clean) return;
      const l = langRef.current;
      const userMsg: Msg = { id: uid(), role: "user", text: clean, lang: l };
      const reply = { ...respond(clean, l, intent), lang: l };
      setMessages((prev) => [...prev, userMsg, reply]);
      setInput("");
    },
    [respond],
  );

  /* ── Voice input (SpeechRecognition) ────────────────────────── */
  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? ((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)
      : undefined;
  const micSupported = !!SpeechRecognitionCtor;
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const he = langRef.current === "he";
    if (!micSupported) {
      setMicError(he ? "קלט קולי אינו נתמך בדפדפן זה." : "Voice input isn't supported in this browser.");
      return;
    }
    setMicError(null);
    stopSpeaking();
    try {
      const Ctor = SpeechRecognitionCtor as new () => any;
      const rec = new Ctor();
      rec.lang = he ? "he-IL" : "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onstart = () => setListening(true);
      rec.onresult = (e: any) => {
        const transcript = e?.results?.[0]?.[0]?.transcript ?? "";
        if (transcript) {
          if (!open) setOpen(true);
          send(transcript);
        }
      };
      rec.onerror = (e: any) => {
        setListening(false);
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          setMicError(he ? "ההרשאה למיקרופון נדחתה. אפשר אותה בדפדפן כדי לדבר עם ג'רוויס." : "Microphone permission denied. Enable it in your browser to talk to JARVIS.");
        } else if (e?.error === "no-speech") {
          setMicError(he ? "לא קלטתי — נסה שוב." : "Didn't catch that — try again.");
        }
      };
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setListening(false);
      setMicError(he ? "לא הצלחתי להפעיל את המיקרופון." : "Couldn't start the microphone.");
    }
  }, [micSupported, SpeechRecognitionCtor, stopSpeaking, open, send]);

  const toggleMic = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [ttsSupported]);

  /* ── Draggable avatar ───────────────────────────────────────── */
  const AVATAR = 64;
  const initialPos = () => {
    if (typeof window === "undefined") return { x: 100, y: 100 };
    return { x: window.innerWidth - AVATAR - 20, y: window.innerHeight - AVATAR - 24 };
  };
  const [pos, setPos] = useState(initialPos);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean; dragging: boolean }>({
    dx: 0, dy: 0, moved: false, dragging: false,
  });

  const clamp = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - AVATAR - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - AVATAR - 8)),
    };
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false, dragging: true };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const nx = e.clientX - dragRef.current.dx;
    const ny = e.clientY - dragRef.current.dy;
    if (Math.abs(e.clientX - (pos.x + dragRef.current.dx)) > 4 || Math.abs(e.clientY - (pos.y + dragRef.current.dy)) > 4) {
      dragRef.current.moved = true;
    }
    setPos(clamp(nx, ny));
  }, [clamp, pos]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    const wasDrag = dragRef.current.moved;
    dragRef.current.dragging = false;
    if (!wasDrag) setOpen(true);
  }, []);

  // Anchor the panel near the avatar, clamped to the viewport.
  const panelStyle = useMemo(() => {
    if (typeof window === "undefined") return { right: 20, bottom: 20 } as React.CSSProperties;
    const W = Math.min(380, window.innerWidth - 24);
    const H = Math.min(560, window.innerHeight - 24);
    let left = pos.x + AVATAR + 12;
    if (left + W > window.innerWidth - 8) left = pos.x - W - 12;
    if (left < 8) left = Math.max(8, (window.innerWidth - W) / 2);
    let top = pos.y - H + AVATAR;
    top = Math.max(12, Math.min(top, window.innerHeight - H - 12));
    return { left, top, width: W, height: H } as React.CSSProperties;
  }, [pos]);

  const voiceControls = (
    <div className="flex items-center gap-1">
      {micSupported && (
        <button
          onClick={toggleMic}
          aria-label={listening ? "Stop listening" : "Talk to JARVIS"}
          className={`p-1.5 rounded transition-colors ${listening ? "bg-red-500/20 text-red-400 animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-secondary/60"}`}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}
      {ttsSupported && (
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute JARVIS" : "Mute JARVIS"}
          className={`p-1.5 rounded transition-colors ${muted ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60" : "text-primary hover:bg-secondary/60"}`}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Draggable avatar + proactive recommendation bubble */}
      {!open && (
        <div
          className="fixed z-50 select-none touch-none"
          style={{ left: pos.x, top: pos.y, width: AVATAR }}
        >
          {showBoostAlert && (
            <div
              className="absolute bottom-full right-0 mb-3 w-[min(320px,calc(100vw-2.5rem))] rounded-2xl border-2 border-primary bg-card/97 backdrop-blur shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300 jarvis-boost-alert"
              style={{ boxShadow: "0 0 40px hsl(207 30% 70% / 0.5)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, hsl(39 28% 72%), hsl(207 30% 70%), hsl(39 28% 72%))" }} />
              <div className="flex items-start gap-2.5 p-3">
                <div className="shrink-0 mt-0.5"><JarvisFace speaking={speaking} size={34} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest text-primary mb-1 jarvis-boost-pulse">
                    <Zap className="h-3 w-3" /> {lang === "he" ? "ג'רוויס · התראת בוסט" : "JARVIS · Boost alert"}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-primary/20 text-primary border border-primary/50">
                      {boostAdvice.label}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-[#9fb4c7]">{lang === "he" ? `חום ${boostAdvice.heat}/100` : `Heat ${boostAdvice.heat}/100`}</span>
                  </div>
                  <p dir={lang === "he" ? "rtl" : "ltr"} className="text-[11px] leading-snug text-foreground/90 line-clamp-3">{boostAdvice.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={activateBoost}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity jarvis-boost-pulse"
                    >
                      <Zap className="h-3 w-3" /> {lang === "he" ? `הפעל בוסט · ${boostAdvice.durationMin}ד׳` : `Boost now · ${boostAdvice.durationMin}m`}
                    </button>
                    <button
                      onClick={dismissBoost}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {lang === "he" ? "אחר כך" : "Later"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={dismissBoost}
                  aria-label="Dismiss boost alert"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {!showBoostAlert && showTip && currentTip && (
            <div
              className="absolute bottom-full right-0 mb-3 w-[min(300px,calc(100vw-2.5rem))] rounded-2xl border border-primary/30 bg-card/95 backdrop-blur shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300"
              style={{ boxShadow: "0 0 32px hsl(207 30% 70% / 0.18)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(207 30% 70%), transparent)" }} />
              <div className="flex items-start gap-2.5 p-3">
                <div className="shrink-0 mt-0.5"><JarvisFace speaking={speaking} size={34} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest text-primary mb-1">
                    <Sparkles className="h-3 w-3" /> {lang === "he" ? "ג'רוויס · טיפ חי" : "JARVIS · Live tip"}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        currentTip.tone === "buy"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : currentTip.tone === "sell"
                            ? "bg-red-500/15 text-red-400 border border-red-500/30"
                            : currentTip.tone === "smart"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-primary/15 text-primary border border-primary/30"
                      }`}
                    >
                      {currentTip.label}
                    </span>
                  </div>
                  <p dir={lang === "he" ? "rtl" : "ltr"} className="text-[11px] leading-snug text-foreground/85 line-clamp-3">{currentTip.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => openWithTip(currentTip)}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      {lang === "he" ? "פרטים" : "View details"} <Send className="h-2.5 w-2.5" />
                    </button>
                    {(() => {
                      const trade = currentTip.links?.find((l) => l.internal);
                      if (!trade) return null;
                      return (
                        <button
                          onClick={() => { dismissTip(); navigate(trade.href); }}
                          className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Zap className="h-2.5 w-2.5" /> {trade.label}
                        </button>
                      );
                    })()}
                  </div>
                </div>
                <button
                  onClick={dismissTip}
                  aria-label="Dismiss tip"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <button
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            aria-label="Open JARVIS"
            className="relative grid place-items-center rounded-full cursor-grab active:cursor-grabbing jarvis-float"
            style={{ width: AVATAR, height: AVATAR, boxShadow: "0 0 28px hsl(207 30% 70% / 0.28)" }}
          >
            <JarvisFace speaking={speaking} size={AVATAR} />
            <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
            {boostAdvice.worth && !boostActive ? (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 text-[8px] font-mono font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap jarvis-boost-pulse">
                <Zap className="h-2.5 w-2.5" /> {lang === "he" ? "בוסט!" : "BOOST!"}
              </span>
            ) : tips.length > 0 && !showTip ? (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {tips.length} tips
              </span>
            ) : null}
          </button>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden"
          style={{ ...panelStyle, boxShadow: "0 0 40px hsl(207 30% 70% / 0.15)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <JarvisFace speaking={speaking} size={36} />
              <div>
                <div className="text-sm font-black font-mono tracking-widest text-primary uppercase leading-none">JARVIS</div>
                <div className="text-[9px] text-muted-foreground font-mono tracking-wider mt-1 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {listening
                    ? (lang === "he" ? "מקשיב…" : "Listening…")
                    : speaking
                      ? (lang === "he" ? "מדבר…" : "Speaking…")
                      : (lang === "he" ? "מנוע ייעוץ · סיגנלים חיים" : "Advisory engine · live signals")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setLang((prev) => {
                    const next = prev === "en" ? "he" : "en";
                    setMessages((m) => [
                      ...m,
                      { id: uid(), role: "jarvis", text: next === "he" ? "עברתי לעברית, אדוני. כיצד אוכל לסייע?" : "Switching to English, sir. How may I assist?", lang: next },
                    ]);
                    return next;
                  })
                }
                aria-label="Toggle language"
                title={lang === "en" ? "עברית" : "English"}
                className="px-1.5 h-7 rounded text-[10px] font-mono font-bold border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {lang === "en" ? "עב" : "EN"}
              </button>
              {voiceControls}
              <button onClick={() => { stopSpeaking(); stopListening(); setOpen(false); }} className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {micError && (
            <div className="px-4 py-1.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 border-b border-amber-500/20">{micError}</div>
          )}

          {boostAdvice.worth && !boostActive && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/30 bg-primary/10 jarvis-boost-alert">
              <Zap className="h-4 w-4 text-primary shrink-0 jarvis-boost-pulse" />
              <div className="min-w-0 flex-1" dir={lang === "he" ? "rtl" : "ltr"}>
                <div className="text-[10px] font-mono font-bold text-primary truncate">{boostAdvice.label}</div>
                <div className="text-[9px] text-muted-foreground truncate">
                  {lang === "he"
                    ? `${boostAdvice.strong} בזינוק · ${boostAdvice.hiScalps} סיגנלים · חום ${boostAdvice.heat}/100`
                    : `${boostAdvice.strong} surging · ${boostAdvice.hiScalps} signals · heat ${boostAdvice.heat}/100`}
                </div>
              </div>
              <button
                onClick={activateBoost}
                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0 jarvis-boost-pulse"
              >
                <Zap className="h-3 w-3" /> {lang === "he" ? `${boostAdvice.durationMin}ד׳` : `${boostAdvice.durationMin}m`}
              </button>
            </div>
          )}
          {boostActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#9fb4c7]/30 bg-[#9fb4c7]/10">
              <Zap className="h-3.5 w-3.5 text-[#9fb4c7] shrink-0 jarvis-boost-pulse" />
              <span className="text-[10px] font-mono font-bold text-[#9fb4c7]" dir={lang === "he" ? "rtl" : "ltr"}>
                {lang === "he" ? "מהירות האור פעילה — הצי בקצב מקסימלי" : "Light-speed active — fleet at max cadence"}
              </span>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary/15 text-foreground border border-primary/20"
                    : "bg-secondary/40 text-foreground/90 border border-border"
                }`}>
                  {m.role === "jarvis" && (
                    <div className="flex items-center gap-1 mb-1 text-[9px] font-mono font-bold uppercase tracking-widest text-primary">
                      <Sparkles className="h-3 w-3" /> JARVIS
                    </div>
                  )}
                  <p dir={(m.lang ?? lang) === "he" ? "rtl" : "ltr"}>{m.text}</p>
                  {m.links && m.links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.links.map((l) =>
                        l.internal ? (
                          <button
                            key={l.href}
                            onClick={() => { setOpen(false); navigate(l.href); }}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <Zap className="h-2.5 w-2.5" /> {l.label}
                          </button>
                        ) : (
                          <a
                            key={l.href}
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                          >
                            {l.label} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="px-3 pt-2 flex flex-wrap gap-1.5 border-t border-border">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.intent}
                onClick={() => send(lang === "he" ? a.he : a.en, a.intent)}
                className="text-[10px] font-mono px-2 py-1 rounded-full border border-border bg-secondary/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {lang === "he" ? a.he : a.en}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 p-3"
          >
            {micSupported && (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={listening ? "Stop listening" : "Talk to JARVIS"}
                className={`h-9 w-9 flex items-center justify-center rounded-lg flex-shrink-0 border transition-colors ${listening ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse" : "border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/50"}`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              dir={lang === "he" ? "rtl" : "ltr"}
              placeholder={listening ? (lang === "he" ? "מקשיב…" : "Listening…") : (lang === "he" ? "שאל את ג'רוויס..." : "Ask JARVIS...")}
              className="flex-1 h-9 rounded-lg bg-secondary/40 border border-border px-3 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <button
              type="submit"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
