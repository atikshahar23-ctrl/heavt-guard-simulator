import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * Zero-cost real-time price layer.
 *
 * Subscribes to Binance's public, market-data-only WebSocket
 * (`data-stream.binance.vision`) combined `!miniTicker@arr` stream, which pushes
 * a 24h mini-ticker for every spot symbol roughly once per second — no API key,
 * no polling, sub-second latency. The browser connects directly so the server's
 * geo restrictions (fapi 451) don't apply.
 *
 * Resilient by design: auto-reconnect with backoff, and if the socket can never
 * open the rest of the app keeps working off its existing REST polling.
 */

export interface LivePrice {
  price: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  /** epoch ms of last update */
  ts: number;
}

const WS_URL = "wss://data-stream.binance.vision/ws/!miniTicker@arr";
const NOTIFY_THROTTLE_MS = 250;
const MAX_RECONNECT_MS = 30_000;

class LivePriceStore {
  readonly prices = new Map<string, LivePrice>();
  connected = false;
  version = 0;

  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private reconnectDelay = 1_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  start() {
    if (this.started || typeof WebSocket === "undefined") return;
    this.started = true;
    this.connect();
  }

  private connect() {
    try {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 1_000;
        this.scheduleNotify();
      };
      ws.onmessage = (ev) => this.onMessage(ev);
      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
      this.connect();
    }, delay);
    this.scheduleNotify();
  }

  private onMessage(ev: MessageEvent) {
    let arr: unknown;
    try {
      arr = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    if (!Array.isArray(arr)) return;
    const now = Date.now();
    for (const t of arr as Array<Record<string, string>>) {
      const sym = t.s;
      if (!sym || !sym.endsWith("USDT")) continue;
      const asset = sym.slice(0, -4);
      const close = parseFloat(t.c);
      const open = parseFloat(t.o);
      if (!Number.isFinite(close) || close <= 0) continue;
      this.prices.set(asset, {
        price: close,
        changePercent: open > 0 ? ((close - open) / open) * 100 : 0,
        high: parseFloat(t.h),
        low: parseFloat(t.l),
        volume: parseFloat(t.q),
        ts: now,
      });
    }
    this.scheduleNotify();
  }

  /** Coalesce notifications so a 1000-symbol burst triggers one render. */
  private scheduleNotify() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.version++;
      this.listeners.forEach((l) => l());
    }, NOTIFY_THROTTLE_MS);
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    this.start();
    return () => {
      this.listeners.delete(cb);
    };
  };

  getVersion = () => this.version;
}

const store = new LivePriceStore();

export interface LivePricesApi {
  /** Latest live price for an asset symbol (e.g. "BTC"), or undefined. */
  get: (asset: string) => LivePrice | undefined;
  /** Whether the WebSocket is currently connected. */
  connected: boolean;
  /** Monotonic counter that increments on each (throttled) update batch. */
  version: number;
}

const LivePriceContext = createContext<LivePriceStore>(store);

export function LivePriceProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    store.start();
  }, []);
  return <LivePriceContext.Provider value={store}>{children}</LivePriceContext.Provider>;
}

export function useLivePrices(): LivePricesApi {
  const s = useContext(LivePriceContext);
  const version = useSyncExternalStore(s.subscribe, s.getVersion, s.getVersion);
  return {
    get: (asset: string) => s.prices.get(asset),
    connected: s.connected,
    version,
  };
}

export function useLivePrice(asset: string): LivePrice | undefined {
  const { get } = useLivePrices();
  return get(asset);
}
