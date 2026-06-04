import { useEffect, useRef } from "react";

interface Props {
  /** Full TradingView symbol, e.g. "BINANCE:BTCUSDT" or "NASDAQ:AAPL" or "AAPL". */
  tvSymbol: string;
  /** Default interval in TradingView form ("15", "60", "240", "D"...). */
  interval?: string;
}

/**
 * Free TradingView "Advanced Real-Time Chart" widget — no API key required.
 *
 * Gives the trader full professional charting: native drawing/markup tools
 * (trendlines, fib, shapes), dozens of built-in indicators, and the auto
 * technical-analysis gauge — exactly like real trading software. Users can also
 * switch the symbol from inside the widget (allow_symbol_change), so any of the
 * thousands of TradingView symbols can be charted, not just our tradeable list.
 */
export function TradingViewAdvancedChart({ tvSymbol, interval = "60" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    el.appendChild(widget);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: "Asia/Jerusalem",
      theme: "dark",
      style: "1",
      locale: "he",
      hide_side_toolbar: false,
      allow_symbol_change: true,
      withdateranges: true,
      details: false,
      hide_volume: false,
      backgroundColor: "rgba(10, 10, 10, 1)",
      gridColor: "rgba(255, 255, 255, 0.06)",
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [tvSymbol, interval]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: "100%", width: "100%" }}
    />
  );
}
