import { useState, type ReactNode } from "react";
import { useUser } from "@clerk/react";
import { useServerSync } from "@/contexts/server-sync-context";
import {
  OnboardingWizard,
  type OnboardingFocus,
} from "@/components/onboarding-wizard";

const localKey = (userId: string) => `arb_scan_onboarded::${userId}`;

/**
 * Shows the onboarding wizard exactly once per account, on first sign-in.
 * Completion is persisted to the server `onboarding` slot (so it carries across
 * devices) with a localStorage flag as an offline fallback. If the server read
 * failed we cannot confirm state, so we skip the wizard rather than nag a
 * returning member.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const sync = useServerSync();
  const { user } = useUser();
  const userId = user?.id ?? "anon";

  const [done, setDone] = useState(() => {
    const server = sync.getServerData("onboarding") as {
      completed?: boolean;
    } | null;
    if (server?.completed) return true;
    try {
      if (localStorage.getItem(localKey(userId)) === "1") return true;
    } catch {
      /* localStorage unavailable — fall through */
    }
    if (!sync.hydrationOk) return true; // can't confirm server state → don't nag
    return false;
  });

  if (done) return <>{children}</>;

  return (
    <OnboardingWizard
      onComplete={(focus: OnboardingFocus) => {
        try {
          localStorage.setItem(localKey(userId), "1");
        } catch {
          /* ignore */
        }
        sync.save("onboarding", {
          completed: true,
          focus,
          completedAt: Date.now(),
        });
        setDone(true);
      }}
    />
  );
}
