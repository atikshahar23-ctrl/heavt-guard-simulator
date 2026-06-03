import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type ScalpConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface AutoTraderSettings {
  enabled: boolean;
  /** Cash committed as margin per auto trade (USD). */
  marginPerTrade: number;
  leverage: number;
  minConfidence: ScalpConfidence;
  allowLong: boolean;
  allowShort: boolean;
  /** Hard cap on simultaneously open auto positions. */
  maxOpenPositions: number;
  /** Only auto-trade assets the user has starred. */
  favoritesOnly: boolean;
}

export const DEFAULT_SETTINGS: AutoTraderSettings = {
  enabled: false,
  marginPerTrade: 100,
  leverage: 5,
  minConfidence: "HIGH",
  allowLong: true,
  allowShort: true,
  maxOpenPositions: 5,
  favoritesOnly: false,
};

const STORAGE_KEY = "arb_scan_autotrader";

interface AutoTraderContextValue {
  settings: AutoTraderSettings;
  update: (patch: Partial<AutoTraderSettings>) => void;
  toggleEnabled: () => void;
}

function loadSettings(): AutoTraderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AutoTraderSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

const AutoTraderContext = createContext<AutoTraderContextValue | null>(null);

export function AutoTraderProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AutoTraderSettings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const update = useCallback((patch: Partial<AutoTraderSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleEnabled = useCallback(() => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  return (
    <AutoTraderContext.Provider value={{ settings, update, toggleEnabled }}>
      {children}
    </AutoTraderContext.Provider>
  );
}

export function useAutoTrader() {
  const ctx = useContext(AutoTraderContext);
  if (!ctx) throw new Error("useAutoTrader must be used inside AutoTraderProvider");
  return ctx;
}
