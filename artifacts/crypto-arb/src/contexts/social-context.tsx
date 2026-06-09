import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/react";
import {
  reportWallet,
  getCredits,
  ackCredits,
  redeemReferral,
} from "@workspace/api-client-react";
import { usePortfolio } from "./portfolio-context";
import { toast } from "@/hooks/use-toast";

const REF_STORAGE_KEY = "arb_ref_code";
/** Only treat a stashed referral code as a genuine new sign-up within this window. */
const NEW_USER_WINDOW_MS = 15 * 60 * 1000;
/** How often we re-report the active-wallet value (kept well under the 120/min global cap). */
const REPORT_INTERVAL_MS = 60_000;

interface SocialValue {
  /**
   * Pull any server-side bonus credits (daily reward + referral) into the active
   * wallet exactly once, then acknowledge them. Safe to call repeatedly — the
   * server returns 0 once the ledger is drained. Returns the amount applied.
   */
  drainCredits: () => Promise<number>;
}

const SocialContext = createContext<SocialValue | null>(null);

/** Build a privacy-safe display name — never an email. */
function displayNameFor(user: ReturnType<typeof useUser>["user"]): string {
  const first = user?.firstName?.trim();
  const last = user?.lastName?.trim();
  if (first) return last ? `${first} ${last[0]}.` : first;
  const uname = user?.username?.trim();
  if (uname) return uname;
  const id = user?.id ?? "";
  return id ? `Trader ${id.slice(-4).toUpperCase()}` : "Trader";
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const portfolio = usePortfolio();
  const { addFunds } = portfolio;

  // Latest snapshot read by the interval reporter without re-subscribing.
  const reportRef = useRef<{ name: string; value: number }>({
    name: "Trader",
    value: 0,
  });

  // Active-wallet value = cash + committed capital across all open positions.
  // We use each position's committed capital (cost / margin / premium) as a
  // stable proxy for its current value; live mark-to-market lives client-side
  // only and isn't needed for a competitive ranking.
  const committed =
    portfolio.polyPositions.reduce((s, p) => s + p.cost, 0) +
    portfolio.binancePositions.reduce(
      (s, p) => s + p.notional / Math.max(1, p.leverage),
      0,
    ) +
    portfolio.stockPositions.reduce((s, p) => s + p.cost, 0) +
    portfolio.fundingPositions.reduce((s, p) => s + p.notionalPerLeg, 0) +
    portfolio.optionPositions.reduce((s, p) => s + p.premiumPaid, 0);
  const walletValue = portfolio.cash + committed;

  reportRef.current = { name: displayNameFor(user), value: walletValue };

  const drainInFlightRef = useRef(false);
  const drainCredits = useCallback(async (): Promise<number> => {
    if (drainInFlightRef.current) return 0;
    drainInFlightRef.current = true;
    try {
      const { unclaimedCredits } = await getCredits();
      if (!Number.isFinite(unclaimedCredits) || unclaimedCredits <= 0) return 0;
      // Apply as a deposit (cash + totalDeposited) so the bonus never distorts
      // realized P&L or the equity curve, then ack the exact amount applied.
      const err = addFunds(unclaimedCredits);
      if (err) return 0;
      await ackCredits({ amount: unclaimedCredits });
      return unclaimedCredits;
    } catch {
      return 0;
    } finally {
      drainInFlightRef.current = false;
    }
  }, [addFunds]);

  // ── Report wallet value + display name: on mount, then on a gentle cadence. ─
  useEffect(() => {
    let cancelled = false;
    const send = () => {
      const { name, value } = reportRef.current;
      reportWallet({ displayName: name, walletValue: value }).catch(() => {});
    };
    send();
    const id = setInterval(() => {
      if (!cancelled) send();
    }, REPORT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ── Drain any pending bonus credits once on mount. ─────────────────────────
  useEffect(() => {
    void drainCredits();
  }, [drainCredits]);

  // ── Redeem a stashed referral code for genuinely-new sign-ups. ─────────────
  useEffect(() => {
    if (!user) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(REF_STORAGE_KEY);
    } catch {
      code = null;
    }
    if (!code) return;

    const createdAt = user.createdAt ? user.createdAt.getTime() : 0;
    const isNew = createdAt > 0 && Date.now() - createdAt < NEW_USER_WINDOW_MS;
    if (!isNew) {
      // Existing account opened a referral link — not eligible; drop the stash.
      try {
        localStorage.removeItem(REF_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await redeemReferral({ code });
        if (cancelled) return;
        // Any definitive server answer (success or a non-transient rejection)
        // clears the stash so we never retry a spent/invalid code.
        try {
          localStorage.removeItem(REF_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        if (res.redeemed && res.bonus > 0) {
          await drainCredits();
          toast({
            title: "בונוס הזמנה התקבל",
            description: `נוספו $${res.bonus.toLocaleString()} לארנק הפעיל שלך (דמו לימודי).`,
          });
        } else if (res.reason) {
          toast({ title: "קוד הזמנה", description: res.reason });
        }
      } catch {
        // Network/transient error — keep the stash for a later attempt.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, drainCredits]);

  return (
    <SocialContext.Provider value={{ drainCredits }}>
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial(): SocialValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within SocialProvider");
  return ctx;
}
