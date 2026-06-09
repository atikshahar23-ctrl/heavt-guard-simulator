import { useEffect, useRef, Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { AuthShell } from "@/components/auth-shell";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
const Markets = lazy(() => import("@/pages/markets"));
const Browse = lazy(() => import("@/pages/browse"));
const Binance = lazy(() => import("@/pages/binance"));
const Recommendations = lazy(() => import("@/pages/recommendations"));
const Simulator = lazy(() => import("@/pages/simulator"));
const Stocks = lazy(() => import("@/pages/stocks"));
const StockDesk = lazy(() => import("@/pages/stock-desk"));
const SmartMoney = lazy(() => import("@/pages/smart-money"));
const Movers = lazy(() => import("@/pages/movers"));
const Scalp = lazy(() => import("@/pages/scalp"));
const FundingArb = lazy(() => import("@/pages/funding-arb"));
const Momentum = lazy(() => import("@/pages/momentum"));
const QuickBets = lazy(() => import("@/pages/quickbets"));
const History = lazy(() => import("@/pages/history"));
const Insights = lazy(() => import("@/pages/insights"));
const TradeDesk = lazy(() => import("@/pages/trade-desk"));
const Bots = lazy(() => import("@/pages/bots"));
const MasterAdvisor = lazy(() => import("@/pages/master-advisor"));
const Research = lazy(() => import("@/pages/research"));
const Briefing = lazy(() => import("@/pages/briefing"));
const Tools = lazy(() => import("@/pages/tools"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const Landing = lazy(() => import("@/pages/landing"));
const Leaderboard = lazy(() => import("@/pages/leaderboard"));
const SettingsPage = lazy(() => import("@/pages/settings"));
import Layout from "@/components/layout";
import { OnboardingGate } from "@/components/onboarding-gate";
import { CalendarAlerter } from "@/components/calendar-alerter";
import { PortfolioProvider } from "@/contexts/portfolio-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { AutoTraderProvider } from "@/contexts/autotrader-context";
import { RefreshProvider } from "@/contexts/refresh-context";
import { LivePriceProvider } from "@/contexts/live-price-context";
import { ServerSyncProvider } from "@/contexts/server-sync-context";
import { SocialProvider } from "@/contexts/social-context";
import { AutoTraderEngine } from "@/components/autotrader-engine";
import { ExtraBotsEngine } from "@/components/extra-bots-engine";
import { FundingBotEngine } from "@/components/funding-bot-engine";
import { OptionsBotEngine } from "@/components/options-bot-engine";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Capture a referral code (?ref=CODE) at first load — before Clerk's routing
// rewrites the URL — and stash it so we can redeem it once the new user has
// signed in. The actual redemption (and "is this genuinely a new sign-up"
// gating) happens in SocialProvider.
(function captureReferralCode() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{1,64}$/.test(ref)) {
      localStorage.setItem("arb_ref_code", ref.toUpperCase());
    }
  } catch {
    /* ignore — referral capture is best-effort */
  }
})();

// REQUIRED — Clerk reads window.location.pathname directly, so the path
// prop must include the base path prefix. In wouter, setLocation prepends
// the base, so we strip it back for Clerk's routerPush/routerReplace.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

// Carbon Noir / Obsidian appearance — obsidian glass card, platinum hairline
// borders, serif headings and a brushed-platinum primary action.
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "none" as const,
  },
  variables: {
    colorPrimary: "hsl(207 30% 70%)",
    colorForeground: "hsl(213 25% 92%)",
    colorMutedForeground: "hsl(213 8% 62%)",
    colorDanger: "hsl(0 62% 52%)",
    colorBackground: "transparent",
    colorInput: "hsl(0 0% 100% / 0.04)",
    colorInputForeground: "hsl(213 25% 92%)",
    colorNeutral: "hsl(210 18% 80%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-white/[0.025] backdrop-blur-xl border border-[#9fb4c7]/22 rounded-[3px] w-full max-w-full overflow-hidden shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none px-7 py-8",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    header: "gap-1",
    headerTitle:
      "text-[#e6edf4] text-2xl tracking-[0.06em] [font-family:'Playfair_Display',serif]",
    headerSubtitle: "text-[#9fb4c7]/70 text-xs tracking-[0.18em] uppercase font-mono",
    socialButtonsBlockButtonText: "text-[#e6edf4] tracking-wide",
    formFieldLabel: "text-[#b9c6d4] text-[0.7rem] font-medium tracking-[0.12em] uppercase",
    footerActionLink: "text-[#9fb4c7] hover:text-[#cfe0ee] font-medium",
    footerActionText: "text-[#9fb4c7]/60",
    dividerText: "text-[#9fb4c7]/50 text-[0.65rem] tracking-[0.3em] uppercase",
    identityPreviewEditButton: "text-[#9fb4c7]",
    formFieldSuccessText: "text-[hsl(152,58%,52%)]",
    alertText: "text-[#e6edf4]",
    socialButtonsBlockButton:
      "border-[#9fb4c7]/22 bg-white/[0.02] hover:bg-[#9fb4c7]/10 hover:border-[#9fb4c7]/45 transition-colors h-11",
    formButtonPrimary:
      "h-11 bg-gradient-to-r from-[#c9d6e2] via-[#9fb4c7] to-[#6f8294] text-[#0b0f14] font-semibold tracking-[0.12em] uppercase text-xs hover:brightness-110 transition-[filter] shadow-[0_8px_24px_-8px_rgba(159,180,199,0.5)]",
    formFieldInput:
      "bg-white/[0.03] text-[#e6edf4] border-[#9fb4c7]/20 focus:border-[#9fb4c7]/60 h-11",
    footerAction: "border-t border-[#9fb4c7]/15",
    dividerLine: "bg-[#9fb4c7]/20",
    alert: "bg-[hsl(0,62%,42%)]/10 border-[hsl(0,62%,42%)]/25",
    otpCodeFieldInput: "bg-white/[0.03] text-[#e6edf4] border-[#9fb4c7]/25",
    formFieldRow: "gap-3",
    main: "gap-5",
  },
};

// Hebrew strings for the most prominent form copy (no extra dependency needed —
// Clerk merges this partial localization over its English defaults).
const clerkLocalization = {
  socialButtonsBlockButton: "המשך עם {{provider|titleize}}",
  dividerText: "או",
  formFieldLabel__emailAddress: "כתובת דוא״ל",
  formFieldLabel__password: "סיסמה",
  formFieldInputPlaceholder__emailAddress: "הזינו את כתובת הדוא״ל",
  formFieldInputPlaceholder__password: "בחרו סיסמה",
  formButtonPrimary: "כניסה",
  signIn: {
    start: {
      title: "כניסת חברים",
      subtitle: "מועדון פרטי · בהזמנה בלבד",
      actionText: "אין לכם עדיין חשבון?",
      actionLink: "בקשת חברות",
    },
  },
  signUp: {
    start: {
      title: "בקשת חברות",
      subtitle: "הצטרפו למעגל הנבחרים",
      actionText: "כבר חברים?",
      actionLink: "כניסה",
    },
  },
};

function SignInPage() {
  return (
    <AuthShell
      kicker="Private Members Club"
      title="הכניסה שמורה למעטים נבחרים."
      subtitle="מי שמקבל גישה אינו ככל האדם — חוויית מסחר ברמה אחרת, מעוצבת לפרטיות וליוקרה."
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </AuthShell>
  );
}

function SignUpPage() {
  return (
    <AuthShell
      kicker="By Invitation Only"
      title="הצטרפו אל מעגל הנבחרים."
      subtitle="חברות פרטית בעולם המסחר. מקום אחד שמור עבורכם — נותר רק לפתוח את הדלת."
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </AuthShell>
  );
}

function PageFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/browse" component={Browse} />
        <Route path="/movers" component={Movers} />
        <Route path="/scalp" component={Scalp} />
        <Route path="/funding-arb" component={FundingArb} />
        <Route path="/momentum" component={Momentum} />
        <Route path="/quickbets" component={QuickBets} />
        <Route path="/history" component={History} />
        <Route path="/insights" component={Insights} />
        <Route path="/trade-desk" component={TradeDesk} />
        <Route path="/markets" component={Markets} />
        <Route path="/binance" component={Binance} />
        <Route path="/recommendations" component={Recommendations} />
        <Route path="/stocks" component={Stocks} />
        <Route path="/stock-desk" component={StockDesk} />
        <Route path="/smart-money" component={SmartMoney} />
        <Route path="/simulator" component={Simulator} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/bots" component={Bots} />
        <Route path="/advisor" component={MasterAdvisor} />
        <Route path="/briefing" component={Briefing} />
        <Route path="/tools" component={Tools} />
        <Route path="/research" component={Research} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/settings" component={SettingsPage} />
        {/* REQUIRED — "/*?" is the only wouter syntax that matches both bare
            and OAuth sub-paths like /sign-in/sso-callback */}
        <Route path="/sign-in/*?">
          <Redirect to="/" replace />
        </Route>
        <Route path="/sign-up/*?">
          <Redirect to="/" replace />
        </Route>
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Layout>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

// Signed-out users land on the marketing page by default and may reach the auth
// screens; any unknown path falls back to the landing page. The full app stays
// gated behind registration/login.
function SignedOutRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/" component={Landing} />
        <Route>
          <Redirect to="/" replace />
        </Route>
      </Switch>
    </Suspense>
  );
}

// The full application — providers, headless trading engines, and routed pages.
// Mounted ONLY when a user is signed in, so wallets/bots never run for guests
// and the PortfolioProvider can scope storage to the signed-in account.
function AuthedApp() {
  return (
    <RefreshProvider>
      <LivePriceProvider>
      <ServerSyncProvider>
      <PortfolioProvider>
      <SocialProvider>
      <FavoritesProvider>
      <AutoTraderProvider>
      <TooltipProvider>
        <AutoTraderEngine />
        <ExtraBotsEngine />
        <FundingBotEngine />
        <OptionsBotEngine />
        <CalendarAlerter />
        <OnboardingGate>
          <Router />
        </OnboardingGate>
        <Toaster />
      </TooltipProvider>
      </AutoTraderProvider>
      </FavoritesProvider>
      </SocialProvider>
      </PortfolioProvider>
      </ServerSyncProvider>
      </LivePriceProvider>
    </RefreshProvider>
  );
}

function AppGate() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }
  // `key={user.id}` forces a fresh mount when the account changes in-session, so
  // the PortfolioProvider re-initializes from the new account's scoped wallet and
  // never persists one account's data under another's key.
  return isSignedIn ? <AuthedApp key={user.id} /> : <SignedOutRoutes />;
}

function App() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
    try {
      if (localStorage.getItem("hg.reduceMotion") === "1") {
        document.documentElement.classList.add("reduce-motion");
      }
    } catch {
      /* localStorage unavailable */
    }
  }

  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <WouterRouter base={basePath}>
          <AppGate />
        </WouterRouter>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
