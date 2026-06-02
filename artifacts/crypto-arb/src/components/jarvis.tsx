import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useGetRecommendations, getGetRecommendationsQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  useGetStocks, getGetStocksQueryKey,
  Recommendation, StockRecommendation,
} from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { X, Send, Sparkles, ExternalLink } from "lucide-react";
import logoUrl from "@/assets/logo-heavy-guard.png";

interface MsgLink {
  label: string;
  href: string;
}
interface Msg {
  id: string;
  role: "jarvis" | "user";
  text: string;
  links?: MsgLink[];
}

const QUICK_ACTIONS = [
  "Top stock to buy",
  "Stocks to avoid",
  "Crypto signal",
  "Market mood",
  "My portfolio",
] as const;

function uid() {
  return Math.random().toString(36).slice(2);
}

function tvLink(tvSymbol: string): MsgLink {
  return { label: "Chart", href: `https://www.tradingview.com/symbols/${tvSymbol}/` };
}
function newsLink(symbol: string, name: string): MsgLink {
  return { label: "News", href: `https://news.google.com/search?q=${encodeURIComponent(`${symbol} ${name} stock`)}` };
}

export function Jarvis() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: uid(),
      role: "jarvis",
      text: "JARVIS online. I read the live Binance, Polymarket and stock signals plus your simulator portfolio. Ask me what to trade, or tap a shortcut below.",
    },
  ]);
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

  const { cash, totalDeposited, polyPositions, binancePositions, stockPositions, tradeHistory } = usePortfolio();

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const topBuys = useMemo(() => (stockRecs ?? []).filter((r) => r.action === "BUY"), [stockRecs]);
  const topSells = useMemo(() => (stockRecs ?? []).filter((r) => r.action === "SELL"), [stockRecs]);
  const topGainers = useMemo(
    () => [...(stocks ?? [])].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
    [stocks],
  );

  const respond = useCallback(
    (raw: string): Msg => {
      const q = raw.toLowerCase().trim();
      const id = uid();

      const wantsBuy = /\b(buy|long|enter|best stock|top stock|invest|gain)/.test(q);
      const wantsSell = /\b(sell|short|avoid|dump|drop|exit|weak)/.test(q);
      const wantsCrypto = /\b(crypto|btc|bitcoin|eth|ethereum|sol|coin|poly|polymarket|arb|futures)/.test(q);
      const wantsPortfolio = /\b(portfolio|balance|account|my money|how am i|wallet|position)/.test(q);
      const wantsMood = /\b(mood|market|sentiment|overall|outlook|today)/.test(q);
      const wantsHelp = /\b(help|what can you|how do you|commands)/.test(q);

      if (wantsHelp) {
        return {
          id,
          role: "jarvis",
          text: "I can surface: the strongest stock to BUY, stocks to AVOID, the best crypto/Polymarket signal, the overall market mood, and a read on your simulator portfolio. Use the shortcuts or just ask in plain words.",
        };
      }

      if (wantsPortfolio) {
        const openCount = polyPositions.length + binancePositions.length + stockPositions.length;
        const realized = tradeHistory.reduce((s, t) => s + t.pnl, 0);
        const wins = tradeHistory.filter((t) => t.pnl > 0).length;
        const winRate = tradeHistory.length ? Math.round((wins / tradeHistory.length) * 100) : 0;
        const deployedNote = openCount === 0
          ? "You have no open positions — plenty of dry powder to deploy."
          : `You hold ${openCount} open position${openCount > 1 ? "s" : ""}.`;
        return {
          id,
          role: "jarvis",
          text: `Cash available: $${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })} of $${totalDeposited.toLocaleString(undefined, { maximumFractionDigits: 0 })} deposited. ${deployedNote} Closed trades: ${tradeHistory.length} (${winRate}% win rate, realized ${realized >= 0 ? "+" : "-"}$${Math.abs(realized).toFixed(0)}). ${realized < 0 ? "Tighten your entries — only act on HIGH/MEDIUM confidence signals." : "Solid — keep risking small and let the momentum signals lead."}`,
        };
      }

      if (wantsCrypto) {
        const actionable = (cryptoRecs ?? []).filter((r) => r.action !== "WATCH");
        const pick: Recommendation | undefined = actionable[0] ?? (cryptoRecs ?? [])[0];
        if (!pick) {
          return { id, role: "jarvis", text: "No crypto signals are loaded yet — give the scanner a moment and ask again." };
        }
        const dir = pick.action === "BUY_YES" ? "BUY YES" : pick.action === "BUY_NO" ? "BUY NO" : "WATCH";
        return {
          id,
          role: "jarvis",
          text: `Top crypto/Polymarket signal: ${dir} on ${pick.binanceSymbol} (${pick.confidence} confidence). ${pick.rationale} Edge ~${pick.edge.toFixed(1)} pts, potential ${pick.potentialReturn.toFixed(1)}x.`,
          links: [tvLink(pick.binanceSymbol.replace("USDT", "USD"))],
        };
      }

      if (wantsSell) {
        const pick: StockRecommendation | undefined = topSells[0];
        if (!pick) {
          return { id, role: "jarvis", text: "Nothing is flashing a strong SELL right now — momentum is broadly neutral-to-positive." };
        }
        return {
          id,
          role: "jarvis",
          text: `Avoid / consider trimming: ${pick.symbol} (${pick.name}). ${pick.rationale}`,
          links: [tvLink(pick.tradingViewSymbol), newsLink(pick.symbol, pick.name)],
        };
      }

      if (wantsBuy || (!wantsMood && q.length > 0)) {
        const pick: StockRecommendation | undefined = topBuys[0];
        if (!pick) {
          return {
            id,
            role: "jarvis",
            text: "No high-conviction BUY in stocks at the moment. Best near-term performer: " +
              (topGainers[0] ? `${topGainers[0].symbol} (${topGainers[0].changePercent >= 0 ? "+" : ""}${topGainers[0].changePercent.toFixed(1)}% today).` : "data still loading."),
            links: topGainers[0] ? [tvLink(topGainers[0].tradingViewSymbol), newsLink(topGainers[0].symbol, topGainers[0].name)] : undefined,
          };
        }
        return {
          id,
          role: "jarvis",
          text: `Strongest stock to buy: ${pick.symbol} (${pick.name}) — ${pick.confidence} confidence. ${pick.rationale}`,
          links: [tvLink(pick.tradingViewSymbol), newsLink(pick.symbol, pick.name)],
        };
      }

      // Market mood (default / explicit)
      const buys = topBuys.length;
      const sells = topSells.length;
      const mood = buys > sells * 1.5 ? "risk-on — buyers in control" : sells > buys * 1.5 ? "risk-off — sellers in control" : "mixed — no clear bias";
      const gainerLine = topGainers.length
        ? ` Today's leaders: ${topGainers.map((g) => `${g.symbol} ${g.changePercent >= 0 ? "+" : ""}${g.changePercent.toFixed(1)}%`).join(", ")}.`
        : "";
      return {
        id,
        role: "jarvis",
        text: `Market mood is ${mood}. Stock signals: ${buys} BUY vs ${sells} SELL.${gainerLine}`,
      };
    },
    [cryptoRecs, topBuys, topSells, topGainers, cash, totalDeposited, polyPositions, binancePositions, stockPositions, tradeHistory],
  );

  const send = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const userMsg: Msg = { id: uid(), role: "user", text: clean };
      const reply = respond(clean);
      setMessages((prev) => [...prev, userMsg, reply]);
      setInput("");
    },
    [respond],
  );

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full pl-2 pr-4 py-2 border border-primary/40 bg-card/95 backdrop-blur shadow-lg hover:border-primary transition-all group"
          style={{ boxShadow: "0 0 24px hsl(43 74% 52% / 0.18)" }}
        >
          <span className="relative">
            <img src={logoUrl} alt="JARVIS" className="h-8 w-8 object-contain" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
          </span>
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-primary">JARVIS</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col w-[min(380px,calc(100vw-2.5rem))] h-[min(520px,calc(100vh-2.5rem))] rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden"
          style={{ boxShadow: "0 0 40px hsl(43 74% 52% / 0.15)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <img src={logoUrl} alt="JARVIS" className="h-9 w-9 object-contain" />
              <div>
                <div className="text-sm font-black font-mono tracking-widest text-primary uppercase leading-none">JARVIS</div>
                <div className="text-[9px] text-muted-foreground font-mono tracking-wider mt-1 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Advisory engine · live signals
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

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
                  <p>{m.text}</p>
                  {m.links && m.links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.links.map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                        >
                          {l.label} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ))}
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
                key={a}
                onClick={() => send(a)}
                className="text-[10px] font-mono px-2 py-1 rounded-full border border-border bg-secondary/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {a}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask JARVIS..."
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
