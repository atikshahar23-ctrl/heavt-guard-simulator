import { useMemo } from "react";
import {
  Newspaper, TrendingUp, TrendingDown, Activity, Gauge, AlertTriangle,
  Bitcoin, LineChart, Globe, Clock, Sparkles, ShieldAlert, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";
import {
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetScalpSignals, getGetScalpSignalsQueryKey,
  useGetMomentumCoins, getGetMomentumCoinsQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  useGetShortTermMarkets, getGetShortTermMarketsQueryKey,
  useGetMarketMovers, getGetMarketMoversQueryKey,
  type CoinTicker, type ScalpSignal, type MomentumCoin,
  type StockRecommendation, type PolymarketMarket,
} from "@workspace/api-client-react";
import { getMarketNotes, formatHebrewDate } from "@/lib/market-calendar";
import { Link } from "wouter";

type Scenario = { icon: typeof TrendingUp; tone: "up" | "down" | "flat"; title: string; body: string };

function toneColor(t: "up" | "down" | "flat"): string {
  return t === "up" ? "152 60% 45%" : t === "down" ? "0 72% 51%" : "207 30% 70%";
}

export default function BriefingPage() {
  const { lang } = useLanguage();
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: signals } = useGetScalpSignals({
    query: { queryKey: getGetScalpSignalsQueryKey(), refetchInterval: 60000, staleTime: 45000 },
  });
  const { data: momentum } = useGetMomentumCoins({
    query: { queryKey: getGetMomentumCoinsQueryKey(), refetchInterval: 60000, staleTime: 45000 },
  });
  const { data: stockRecs } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: 60000, staleTime: 45000 },
  });
  const { data: shortTerm } = useGetShortTermMarkets({
    query: { queryKey: getGetShortTermMarketsQueryKey(), refetchInterval: 90000, staleTime: 60000 },
  });
  const { data: movers } = useGetMarketMovers({
    query: { queryKey: getGetMarketMoversQueryKey(), refetchInterval: 180000, staleTime: 120000 },
  });

  const now = new Date();
  const calNotes = getMarketNotes(now, lang);

  const coins = (overview ?? []) as CoinTicker[];
  const scalp = (signals ?? []) as ScalpSignal[];
  const mom = (momentum ?? []) as MomentumCoin[];
  const recs = (stockRecs ?? []) as StockRecommendation[];
  const poly = (shortTerm ?? []) as PolymarketMarket[];

  const btc = coins.find((c) => c.asset === "BTC");
  const eth = coins.find((c) => c.asset === "ETH");
  const avgChange = coins.length ? coins.reduce((s, c) => s + c.changePercent, 0) / coins.length : 0;
  const fg = movers?.fearGreed;

  const topScalp = useMemo(
    () => [...scalp].sort((a, b) => b.score - a.score).slice(0, 3),
    [scalp],
  );
  const topMom = useMemo(
    () => [...mom].sort((a, b) => b.rvol - a.rvol).slice(0, 3),
    [mom],
  );
  const topStockSignals = useMemo(
    () => recs.filter((r) => r.action !== "HOLD").slice(0, 6),
    [recs],
  );
  const strongPoly = useMemo(
    () => [...poly]
      .filter((m) => m.active)
      .sort((a, b) => Math.abs(b.yesProbabilityPercent - 50) - Math.abs(a.yesProbabilityPercent - 50))
      .slice(0, 3),
    [poly],
  );

  // ── Opportunity detection: a "strong" setup is a high-confidence scalp,
  // an extreme momentum surge, a high-confidence stock BUY, or a lopsided market. ──
  const strongScalp = scalp.find((s) => s.confidence === "HIGH");
  const strongMom = mom.find((m) => m.rvol >= 3 && m.roc15m > 0);
  const strongBuy = recs.find((r) => r.action === "BUY" && r.confidence === "HIGH");
  const hasOpportunity = Boolean(strongScalp || strongMom || strongBuy);

  // ── Educational 2-hour scenarios (NOT advice — things to watch) ──
  const scenarios: Scenario[] = [];
  if (btc) {
    if (btc.changePercent > 1.5) scenarios.push({ icon: TrendingUp, tone: "up",
      title: lang === "en" ? "Bitcoin positive momentum" : "ביטקוין במומנטום חיובי",
      body: lang === "en"
        ? `BTC ${btc.changePercent.toFixed(2)}% in 24h. Watch the next 2 hours: if it holds above $${Math.round(btc.price).toLocaleString()}, the bullish picture stays intact. Learning point: identify when momentum starts fading.`
        : `BTC ${btc.changePercent.toFixed(2)}% ביממה. בשעתיים הקרובות שווה לעקוב אם הוא מחזיק מעל $${Math.round(btc.price).toLocaleString()} — אזור שבירה כלפי מטה יבטל את התמונה החיובית. נקודה ללימוד: לזהות מתי מומנטום נחלש.` });
    else if (btc.changePercent < -1.5) scenarios.push({ icon: TrendingDown, tone: "down",
      title: lang === "en" ? "Bitcoin under selling pressure" : "ביטקוין בלחץ מכירות",
      body: lang === "en"
        ? `BTC ${btc.changePercent.toFixed(2)}% in 24h. Watch for stabilisation near $${Math.round(btc.low24h).toLocaleString()} (today's low). Scenario to study: the difference between consolidation and continued decline.`
        : `BTC ${btc.changePercent.toFixed(2)}% ביממה. בשעתיים הקרובות שווה לראות אם נוצר ייצוב סביב $${Math.round(btc.low24h).toLocaleString()} (שפל היום). תרחיש ללימוד: ההבדל בין דשדוש לבין המשך ירידה.` });
    else scenarios.push({ icon: Activity, tone: "flat",
      title: lang === "en" ? "Bitcoin consolidating" : "ביטקוין בדשדוש",
      body: lang === "en"
        ? `BTC moved only ${btc.changePercent.toFixed(2)}% in 24h, ranging $${Math.round(btc.low24h).toLocaleString()} – $${Math.round(btc.high24h).toLocaleString()}. In a tight range, the lesson is: wait for a range break before entering.`
        : `BTC זז רק ${btc.changePercent.toFixed(2)}% ביממה ונע בין $${Math.round(btc.low24h).toLocaleString()} ל-$${Math.round(btc.high24h).toLocaleString()}. בשוק צר כדאי ללמוד לזהות פריצה של הטווח לפני שנכנסים.` });
  }
  if (avgChange > 1) scenarios.push({ icon: ArrowUpRight, tone: "up",
    title: lang === "en" ? "Broad market strength" : "רוחב שוק חיובי",
    body: lang === "en"
      ? `Crypto breadth is positive — average ${avgChange.toFixed(2)}% across top coins. In this scenario, strongest coins tend to lead. Learning point: track who leads and who lags.`
      : `הקריפטו רחב — בממוצע ${avgChange.toFixed(2)}% על המטבעות המובילים. בתרחיש כזה מטבעות חזקים נוטים להוביל; נקודת לימוד: לעקוב מי מוביל ומי מפגר.` });
  else if (avgChange < -1) scenarios.push({ icon: ArrowDownRight, tone: "down",
    title: lang === "en" ? "Broad crypto weakness" : "חולשה רחבה בקריפטו",
    body: lang === "en"
      ? `Broad decline, average ${avgChange.toFixed(2)}%. When everything is red, counter-trend setups are riskier — a good exercise in patience and capital preservation.`
      : `ירידה רוחבית, בממוצע ${avgChange.toFixed(2)}%. כשהכול אדום, סטאפים נגד המגמה מסוכנים יותר — תרגיל טוב לסבלנות ולשמירה על הון.` });
  if (fg) scenarios.push({ icon: Gauge, tone: fg.value >= 55 ? "up" : fg.value <= 45 ? "down" : "flat",
    title: lang === "en" ? `Fear/Greed Index: ${fg.value}` : `מדד פחד/חמדנות: ${fg.value}`,
    body: lang === "en"
      ? `Overall sentiment: "${fg.classification}". An extreme reading (fear or greed) usually reflects elevated emotion — a chance to learn why emotional extremes tend to reverse.`
      : `הסנטימנט הכללי הוא "${fg.classification}". מדד קיצוני (פחד או חמדנות) מלמד לרוב על רגש בשוק — הזדמנות ללמוד למה קצוות רגשיים נוטים להתהפך.` });
  if (calNotes[0]) scenarios.push({ icon: Clock, tone: "flat",
    title: lang === "en" ? "Special trading day" : "יום מסחר מיוחד",
    body: lang === "en"
      ? `${calNotes[0].label}. On days like this, volatility is typically higher than usual — key lesson: calendar events affect the market even before anything "happens".`
      : `${calNotes[0].label}. בימים כאלה התנודתיות גבוהה מהרגיל — שיעור חשוב: אירועי לוח שנה משפיעים על השוק עוד לפני שמשהו "קורה".` });

  const numFmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  const dir = lang === "he" ? "rtl" : "ltr";
  return (
    <div className="p-4 md:p-6 space-y-5" dir={dir}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-black tracking-tight">{t("briefing.title", lang)}</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{formatHebrewDate(now, lang)} · {t("briefing.markets", lang)}</p>
        </div>
      </div>

      {/* Educational disclaimer — prominent, per project constraint */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-foreground/85 leading-relaxed">
          <span className="font-bold text-amber-400">{t("briefing.disclaimer", lang)}</span>{" "}
          {t("briefing.disclaimerBody", lang)}
        </p>
      </div>

      {/* Opportunity alert */}
      {hasOpportunity && (
        <div className="rounded-xl border border-primary/50 bg-primary/[0.08] p-4 anim-rise-in" style={{ boxShadow: "0 0 24px hsl(207 30% 70% / 0.15)" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">{t("briefing.opportunityTitle", lang)}</h2>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-foreground/85">
            {strongScalp && <li className="flex gap-1.5"><span className="text-primary">•</span> {lang === "en" ? <>High-confidence scalp: <b>{strongScalp.asset}</b> {strongScalp.direction === "LONG" ? "LONG" : "SHORT"} (entry ${numFmt(strongScalp.entry)}, target ${numFmt(strongScalp.takeProfit)}, stop ${numFmt(strongScalp.stopLoss)}).</> : <>סקאלפ בביטחון גבוה: <b>{strongScalp.asset}</b> לכיוון {strongScalp.direction === "LONG" ? "עלייה" : "ירידה"} (כניסה ${numFmt(strongScalp.entry)}, יעד ${numFmt(strongScalp.takeProfit)}, סטופ ${numFmt(strongScalp.stopLoss)}).</>}</li>}
            {strongMom && <li className="flex gap-1.5"><span className="text-primary">•</span> {lang === "en" ? <>Momentum surge: <b>{strongMom.asset}</b> RVol ×{strongMom.rvol.toFixed(1)}, rate {strongMom.roc15m.toFixed(2)}% in 15 min.</> : <>זינוק מומנטום: <b>{strongMom.asset}</b> עם נפח יחסי פי {strongMom.rvol.toFixed(1)} וקצב עלייה {strongMom.roc15m.toFixed(2)}% ב-15 דק׳.</>}</li>}
            {strongBuy && <li className="flex gap-1.5"><span className="text-primary">•</span> {lang === "en" ? <>High-confidence stock: <b>{strongBuy.symbol}</b> — {strongBuy.rationale}</> : <>מניה בביטחון גבוה: <b>{strongBuy.symbol}</b> — {strongBuy.rationale}</>}</li>}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">{t("briefing.opportunityNote", lang)}</p>
        </div>
      )}

      {/* Market snapshot row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SnapStat icon={Bitcoin} label="BTC" value={btc ? `$${numFmt(btc.price, 0)}` : "—"} sub={btc ? `${btc.changePercent >= 0 ? "+" : ""}${btc.changePercent.toFixed(2)}%` : ""} up={(btc?.changePercent ?? 0) >= 0} />
        <SnapStat icon={LineChart} label="ETH" value={eth ? `$${numFmt(eth.price, 0)}` : "—"} sub={eth ? `${eth.changePercent >= 0 ? "+" : ""}${eth.changePercent.toFixed(2)}%` : ""} up={(eth?.changePercent ?? 0) >= 0} />
        <SnapStat icon={Activity} label={t("briefing.breadth", lang)} value={`${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`} sub={t("briefing.avgLeaders", lang)} up={avgChange >= 0} />
        <SnapStat icon={Gauge} label={t("briefing.fearGreed", lang)} value={fg ? String(fg.value) : "—"} sub={fg?.classification ?? ""} up={(fg?.value ?? 50) >= 50} />
      </div>

      {/* Scenarios */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-bold flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> {t("briefing.scenariosTitle", lang)}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {scenarios.length === 0 && <p className="text-xs text-muted-foreground">{t("briefing.loadingScenarios", lang)}</p>}
          {scenarios.map((s, i) => {
            const c = toneColor(s.tone);
            return (
              <div key={i} className="rounded-lg border p-3" style={{ borderColor: `hsl(${c} / 0.3)`, background: `hsl(${c} / 0.05)` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className="h-4 w-4" style={{ color: `hsl(${c})` }} />
                  <h3 className="text-xs font-bold">{s.title}</h3>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Three-market breakdown */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Crypto */}
        <section className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Bitcoin className="h-4 w-4 text-primary" /> {t("briefing.sectionCrypto", lang)}</h2>
          <p className="text-[10px] text-muted-foreground">{t("briefing.sectionCryptoSub", lang)}</p>
          {topScalp.length === 0 && topMom.length === 0 && <p className="text-[11px] text-muted-foreground">{t("briefing.noStrongSignals", lang)}</p>}
          {topScalp.map((s) => (
            <Row key={`s-${s.asset}`} symbol={s.asset} right={`${s.direction === "LONG" ? "▲" : "▼"} ${s.confidence}`} up={s.direction === "LONG"} note={`${lang === "en" ? "entry" : "כניסה"} $${numFmt(s.entry)} · ${lang === "en" ? "target" : "יעד"} $${numFmt(s.takeProfit)}`} />
          ))}
          {topMom.map((m) => (
            <Row key={`m-${m.asset}`} symbol={m.asset} right={`RVol ×${m.rvol.toFixed(1)}`} up={m.roc15m >= 0} note={`${lang === "en" ? "15m rate" : "קצב 15ד׳"} ${m.roc15m.toFixed(2)}%`} />
          ))}
        </section>

        {/* Stocks */}
        <section className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5"><LineChart className="h-4 w-4 text-primary" /> {t("briefing.sectionStocks", lang)}</h2>
            <Link href="/stock-desk" className="text-[10px] font-mono font-bold text-primary hover:underline flex items-center gap-0.5">
              {t("briefing.stockDesk", lang)} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("briefing.sectionStocksSub", lang)}</p>
          {topStockSignals.length === 0 && <p className="text-[11px] text-muted-foreground">{t("briefing.noStrongSignals", lang)}</p>}
          {topStockSignals.map((r) => (
            <Row
              key={r.symbol}
              symbol={r.symbol}
              right={r.action === "BUY" ? t("briefing.buySignal", lang) : t("briefing.sellSignal", lang)}
              up={r.action === "BUY"}
              note={`${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}% · ${r.name}`}
            />
          ))}
        </section>

        {/* Polymarket */}
        <section className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Globe className="h-4 w-4 text-primary" /> {t("briefing.sectionPoly", lang)}</h2>
          <p className="text-[10px] text-muted-foreground">{t("briefing.sectionPolySub", lang)}</p>
          {strongPoly.length === 0 && <p className="text-[11px] text-muted-foreground">{t("briefing.noActiveMarkets", lang)}</p>}
          {strongPoly.map((m) => (
            <div key={m.conditionId} className="rounded-md border border-border/60 bg-secondary/20 p-2">
              <p className="text-[11px] font-medium leading-snug line-clamp-2">{m.question}</p>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="text-emerald-400">{t("briefing.yes", lang)} {m.yesProbabilityPercent.toFixed(0)}%</span>
                <span className="text-red-400">{t("briefing.no", lang)} {(100 - m.yesProbabilityPercent).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Headlines */}
      {movers?.news && movers.news.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Newspaper className="h-4 w-4 text-primary" /> {t("briefing.headlinesTitle", lang)}</h2>
          <div className="grid md:grid-cols-2 gap-2">
            {movers.news.slice(0, 6).map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border/60 bg-card/40 p-2 hover:border-primary/40 transition-colors">
                <p className="text-[11px] leading-snug line-clamp-2">{n.title}</p>
                {n.source && <span className="text-[9px] text-muted-foreground">{n.source}</span>}
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-[10px] text-muted-foreground/70 pt-2">
        {t("briefing.footer", lang)}
      </p>
    </div>
  );
}

function SnapStat({ icon: Icon, label, value, sub, up }: { icon: typeof TrendingUp; label: string; value: string; sub: string; up: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-lg font-black tabular-nums">{value}</div>
      {sub && <div className={`text-[10px] font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>{sub}</div>}
    </div>
  );
}

function Row({ symbol, right, up, note }: { symbol: string; right: string; up: boolean; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="text-xs font-bold">{symbol}</div>
        <div className="text-[10px] text-muted-foreground truncate">{note}</div>
      </div>
      <span className={`text-[11px] font-mono font-bold shrink-0 ${up ? "text-emerald-400" : "text-red-400"}`}>{right}</span>
    </div>
  );
}
