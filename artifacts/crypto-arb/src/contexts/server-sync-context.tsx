import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getUserState,
  putUserState,
  type UserStateData,
  type UserStateEntry,
} from "@workspace/api-client-react";

/**
 * The per-user state slots persisted server-side. Each maps to one row in the
 * `user_state` table and one independent save loop here, so a wallets write can
 * never clobber a concurrent favorites/autotrader/onboarding write.
 */
export type StateSlot = "wallets" | "autotrader" | "favorites" | "onboarding" | "performance";

const SLOTS: StateSlot[] = ["wallets", "autotrader", "favorites", "onboarding", "performance"];

interface ServerSyncValue {
  /**
   * Server snapshot for a slot, captured once at hydration. `null` when the
   * server has no row for this slot yet (or hydration failed). Contexts read
   * this synchronously in their state initializer.
   */
  getServerData: (slot: StateSlot) => unknown | null;
  /** Debounced, optimistic-concurrency save of a slot's full blob. */
  save: (slot: StateSlot, data: unknown) => void;
  /**
   * True once a GET has succeeded (either the initial burst or a later
   * background retry), so writes via `save` are enabled. Reactive — flips to
   * true if a background retry recovers from an initial failure.
   */
  hydrationOk: boolean;
}

const ServerSyncContext = createContext<ServerSyncValue | null>(null);

// Trailing debounce so a burst of mutations collapses into one write, with a
// hard ceiling so a continuously-changing slot (e.g. a running bot) still
// persists at least every MAX_WAIT_MS.
const DEBOUNCE_MS = 3000;
const MAX_WAIT_MS = 15000;
const MAX_CONFLICT_RETRIES = 3;
// Exponential backoff for transient write failures (network / 5xx / 429),
// capped so a sustained outage settles at one retry per minute.
const BASE_RETRY_MS = 3000;
const MAX_BACKOFF_MS = 60000;
// Hydration GET retries (covers the shared-IP rate limiter's 429 bursts on load).
const HYDRATION_ATTEMPTS = 3;
// Hard per-attempt timeout. A hung (not failed) GET would otherwise leave the
// authed app stuck behind the hydration spinner forever; on timeout we fall
// through to retry and, if every attempt stalls, to localStorage-only mode.
const HYDRATION_TIMEOUT_MS = 10000;
// If every initial attempt fails (offline / sustained outage), keep retrying
// in the background at this interval so the device starts syncing again once
// connectivity returns, instead of staying localStorage-only for the whole tab
// session.
const BACKGROUND_RETRY_MS = 60000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function statusOf(err: unknown): number | undefined {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return undefined;
}

function isConflict(err: unknown): err is { status: number; data: unknown } {
  return statusOf(err) === 409;
}

// Statuses that will never succeed by retrying the same payload as-is. We drop
// the pending write (localStorage still holds the data) instead of looping.
function isTerminal(err: unknown): boolean {
  const s = statusOf(err);
  return s === 400 || s === 401 || s === 403 || s === 413;
}

export function ServerSyncProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [hydrationOk, setHydrationOk] = useState(false);
  const hydratedRef = useRef(false);
  const hydrationOkRef = useRef(false);

  // Authoritative server snapshot captured at hydration (slot -> data).
  const initialRef = useRef<Partial<Record<StateSlot, unknown>>>({});
  // Last version we know the server holds for each slot (0 = never written).
  const versionRef = useRef<Partial<Record<StateSlot, number>>>({});
  // Latest data awaiting a flush, cleared once successfully written.
  const pendingRef = useRef<Partial<Record<StateSlot, unknown>>>({});
  const timerRef = useRef<Partial<Record<StateSlot, ReturnType<typeof setTimeout>>>>({});
  const firstSaveAtRef = useRef<Partial<Record<StateSlot, number>>>({});
  const inFlightRef = useRef<Partial<Record<StateSlot, boolean>>>({});
  // Consecutive transient-failure count per slot, drives the backoff schedule.
  const failCountRef = useRef<Partial<Record<StateSlot, number>>>({});

  // ── Hydration: GET on mount (with retry), gate children until it settles. ──
  useEffect(() => {
    let cancelled = false;

    const attemptHydration = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < HYDRATION_ATTEMPTS; attempt++) {
        try {
          const entries = await Promise.race([
            getUserState(),
            sleep(HYDRATION_TIMEOUT_MS).then<never>(() => {
              throw new Error("hydration timeout");
            }),
          ]);
          if (cancelled) return true;
          for (const e of entries) {
            const slot = e.slot as StateSlot;
            if (!SLOTS.includes(slot)) continue;
            initialRef.current[slot] = e.data;
            versionRef.current[slot] = e.version;
          }
          return true;
        } catch {
          // Transient (offline / 429 burst / auth race). Back off and retry.
          if (attempt < HYDRATION_ATTEMPTS - 1) await sleep(BASE_RETRY_MS * 2 ** attempt);
        }
      }
      return false;
    };

    (async () => {
      const ok = await attemptHydration();
      if (cancelled) return;

      hydrationOkRef.current = ok;
      setHydrationOk(ok);
      hydratedRef.current = true;
      setHydrated(true);

      if (ok) return;

      // If every initial attempt failed, children render from localStorage and
      // save() stays a no-op (so we never blind-overwrite the server with
      // un-read local state). Keep retrying in the background — once an
      // attempt succeeds, enable save() so this device starts syncing future
      // edits without requiring a manual reload.
      while (!cancelled) {
        await sleep(BACKGROUND_RETRY_MS);
        if (cancelled) return;
        const recovered = await attemptHydration();
        if (recovered) {
          hydrationOkRef.current = true;
          setHydrationOk(true);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Indirection so scheduleFlush and flushSlot can reference each other without
  // a declaration-order cycle.
  const scheduleFlushRef = useRef<(slot: StateSlot) => void>(() => {});

  const flushSlot = useCallback(async (slot: StateSlot) => {
    if (inFlightRef.current[slot]) return; // an active run will pick up pending
    const snapshot = pendingRef.current[slot];
    if (snapshot === undefined) return;

    inFlightRef.current[slot] = true;
    const timer = timerRef.current[slot];
    if (timer) clearTimeout(timer);
    timerRef.current[slot] = undefined;
    firstSaveAtRef.current[slot] = undefined;
    pendingRef.current[slot] = undefined;

    let payload = snapshot;
    try {
      let baseVersion = versionRef.current[slot] ?? 0;
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await putUserState(slot, {
            data: payload as UserStateData,
            baseVersion,
          });
          versionRef.current[slot] = res.version;
          failCountRef.current[slot] = 0; // success clears the backoff
          break;
        } catch (err) {
          if (isConflict(err) && attempt < MAX_CONFLICT_RETRIES) {
            // Last-write-wins: adopt the server's version and re-save our data
            // on top (the active tab keeps ownership). If a newer edit landed
            // mid-flight, prefer it.
            const server = err.data as UserStateEntry | null;
            const serverVersion =
              server && typeof server.version === "number" ? server.version : 0;
            versionRef.current[slot] = serverVersion;
            baseVersion = serverVersion;
            const newer = pendingRef.current[slot];
            if (newer !== undefined) {
              payload = newer;
              pendingRef.current[slot] = undefined;
            }
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      if (isTerminal(err)) {
        // 400/401/403/413 — won't succeed as-is. Drop the write (localStorage
        // keeps the data) and don't reschedule; a later user edit may retry.
        failCountRef.current[slot] = 0;
      } else {
        // Transient (network / 5xx / 429): restore the data and back off.
        if (pendingRef.current[slot] === undefined) pendingRef.current[slot] = payload;
        failCountRef.current[slot] = (failCountRef.current[slot] ?? 0) + 1;
      }
    } finally {
      inFlightRef.current[slot] = false;
      if (pendingRef.current[slot] !== undefined) {
        scheduleFlushRef.current(slot);
      }
    }
  }, []);

  const scheduleFlush = useCallback(
    (slot: StateSlot) => {
      const fails = failCountRef.current[slot] ?? 0;
      if (fails > 0) {
        // In backoff after a failure — keep the existing retry timer rather than
        // letting a fresh edit shorten it (bounds the retry rate during outages).
        if (timerRef.current[slot]) return;
        const wait = Math.min(MAX_BACKOFF_MS, BASE_RETRY_MS * 2 ** (fails - 1));
        timerRef.current[slot] = setTimeout(() => void flushSlot(slot), wait);
        return;
      }
      const now = Date.now();
      if (firstSaveAtRef.current[slot] === undefined) {
        firstSaveAtRef.current[slot] = now;
      }
      const elapsed = now - (firstSaveAtRef.current[slot] ?? now);
      const existing = timerRef.current[slot];
      if (existing) clearTimeout(existing);

      if (elapsed >= MAX_WAIT_MS) {
        void flushSlot(slot);
        return;
      }
      const wait = Math.min(DEBOUNCE_MS, MAX_WAIT_MS - elapsed);
      timerRef.current[slot] = setTimeout(() => void flushSlot(slot), wait);
    },
    [flushSlot],
  );
  scheduleFlushRef.current = scheduleFlush;

  const save = useCallback(
    (slot: StateSlot, data: unknown) => {
      // Never write before hydration settles, and never write at all if the
      // initial read failed — otherwise un-read local state could blind-overwrite
      // the account's existing server data via the last-write-wins retry path.
      if (!hydratedRef.current || !hydrationOkRef.current) return;
      pendingRef.current[slot] = data;
      scheduleFlush(slot);
    },
    [scheduleFlush],
  );

  const getServerData = useCallback(
    (slot: StateSlot) => initialRef.current[slot] ?? null,
    [],
  );

  // ── Best-effort flush on tab hide/close so very recent edits aren't lost. ──
  useEffect(() => {
    const flushAll = () => {
      if (!hydrationOkRef.current) return;
      for (const slot of SLOTS) {
        const data = pendingRef.current[slot];
        if (data === undefined) continue;
        const baseVersion = versionRef.current[slot] ?? 0;
        try {
          // keepalive lets the request outlive the page; same-origin sends the
          // Clerk session cookie. Body cap is ~64KB — oversize blobs simply fall
          // through to the next session's debounced save.
          fetch(`/api/user-state/${slot}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ data, baseVersion }),
            keepalive: true,
            credentials: "same-origin",
          });
          pendingRef.current[slot] = undefined;
        } catch {
          /* ignore — localStorage still holds the data */
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <ServerSyncContext.Provider value={{ getServerData, save, hydrationOk }}>
      {children}
    </ServerSyncContext.Provider>
  );
}

export function useServerSync(): ServerSyncValue {
  const ctx = useContext(ServerSyncContext);
  if (!ctx)
    throw new Error("useServerSync must be used within ServerSyncProvider");
  return ctx;
}
