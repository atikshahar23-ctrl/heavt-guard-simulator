import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useServerSync } from "./server-sync-context";

export type FavoriteKind = "stock" | "coin" | "market";

export interface FavoriteItem {
  id: string;          // unique key, e.g. "stock:AAPL" / "coin:BTC" / "market:<conditionId>"
  kind: FavoriteKind;
  symbol: string;      // ticker / asset / short label
  label: string;       // human-readable name
  addedAt: string;
}

interface FavoritesContextValue {
  favorites: FavoriteItem[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, "addedAt">) => void;
  removeFavorite: (id: string) => void;
  favoritesByKind: (kind: FavoriteKind) => FavoriteItem[];
}

const STORAGE_KEY = "arb_scan_favorites";

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function load(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

function coerceFavorites(data: unknown): FavoriteItem[] {
  return Array.isArray(data) ? (data as FavoriteItem[]) : [];
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  // Prefer the server snapshot (captured at hydration); fall back to the local
  // cache when the server has no favorites for this account yet.
  const sync = useServerSync();
  const serverInit = sync.getServerData("favorites");
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() =>
    serverInit !== null ? coerceFavorites(serverInit) : load(),
  );

  // Offline cache: keep mirroring every change to localStorage.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      /* ignore quota errors */
    }
  }, [favorites]);

  // Server sync: seed once if the server had nothing, then push every change.
  const didServerSeed = useRef(false);
  useEffect(() => {
    if (!didServerSeed.current) {
      didServerSeed.current = true;
      if (sync.hydrationOk && serverInit === null) {
        sync.save("favorites", favorites);
      }
      return;
    }
    sync.save("favorites", favorites);
  }, [favorites]);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  const toggleFavorite = useCallback((item: Omit<FavoriteItem, "addedAt">) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === item.id)) {
        return prev.filter((f) => f.id !== item.id);
      }
      return [...prev, { ...item, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const favoritesByKind = useCallback(
    (kind: FavoriteKind) => favorites.filter((f) => f.kind === kind),
    [favorites],
  );

  return (
    <FavoritesContext.Provider
      value={{ favorites, isFavorite, toggleFavorite, removeFavorite, favoritesByKind }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
