import { useEffect, useRef, Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
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
const TradeDesk = lazy(() => import("@/pages/trade-desk"));
const Bots = lazy(() => import("@/pages/bots"));
const MasterAdvisor = lazy(() => import("@/pages/master-advisor"));
const Research = lazy(() => import("@/pages/research"));
const Briefing = lazy(() => import("@/pages/briefing"));
const Tools = lazy(() => import("@/pages/tools"));
import Layout from "@/components/layout";
import { PortfolioProvider } from "@/contexts/portfolio-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { AutoTraderProvider } from "@/contexts/autotrader-context";
import { RefreshProvider } from "@/contexts/refresh-context";
import { LivePriceProvider } from "@/contexts/live-price-context";
import { AutoTraderEngine } from "@/components/autotrader-engine";
import { ExtraBotsEngine } from "@/components/extra-bots-engine";
import { FundingBotEngine } from "@/components/funding-bot-engine";
import { OptionsBotEngine } from "@/components/options-bot-engine";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(32 84% 55%)",
    colorForeground: "hsl(210 22% 92%)",
    colorMutedForeground: "hsl(213 14% 62%)",
    colorDanger: "hsl(0 62% 42%)",
    colorBackground: "hsl(220 16% 8%)",
    colorInput: "hsl(215 15% 15%)",
    colorInputForeground: "hsl(210 22% 92%)",
    colorNeutral: "hsl(215 15% 19%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(220,15%,11%)] rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(210,22%,92%)] font-semibold text-lg",
    headerSubtitle: "text-[hsl(213,14%,62%)] text-sm",
    socialButtonsBlockButtonText: "text-[hsl(210,22%,92%)]",
    formFieldLabel: "text-[hsl(210,22%,92%)] text-xs font-medium",
    footerActionLink: "text-[hsl(32,84%,55%)] hover:text-[hsl(32,84%,65%)]",
    footerActionText: "text-[hsl(213,14%,62%)]",
    dividerText: "text-[hsl(213,14%,62%)]",
    identityPreviewEditButton: "text-[hsl(32,84%,55%)]",
    formFieldSuccessText: "text-[hsl(152,58%,46%)]",
    alertText: "text-[hsl(210,22%,92%)]",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border-[hsl(215,15%,19%)] hover:bg-[hsl(215,15%,19%)]",
    formButtonPrimary: "bg-[hsl(32,84%,55%)] text-[hsl(220,25%,8%)] hover:bg-[hsl(32,84%,65%)]",
    formFieldInput: "bg-[hsl(215,15%,15%)] text-[hsl(210,22%,92%)] border-[hsl(215,15%,19%)]",
    footerAction: "border-t border-[hsl(215,15%,19%)]",
    dividerLine: "bg-[hsl(215,15%,19%)]",
    alert: "bg-[hsl(0,62%,42%)]/10 border-[hsl(0,62%,42%)]/20",
    otpCodeFieldInput: "bg-[hsl(215,15%,15%)] text-[hsl(210,22%,92%)]",
    formFieldRow: "gap-3",
    main: "gap-5",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
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
        <Route path="/trade-desk" component={TradeDesk} />
        <Route path="/markets" component={Markets} />
        <Route path="/binance" component={Binance} />
        <Route path="/recommendations" component={Recommendations} />
        <Route path="/stocks" component={Stocks} />
        <Route path="/stock-desk" component={StockDesk} />
        <Route path="/smart-money" component={SmartMoney} />
        <Route path="/simulator" component={Simulator} />
        <Route path="/bots" component={Bots} />
        <Route path="/advisor" component={MasterAdvisor} />
        <Route path="/briefing" component={Briefing} />
        <Route path="/tools" component={Tools} />
        <Route path="/research" component={Research} />
        {/* REQUIRED — "/*?" is the only wouter syntax that matches both bare
            and OAuth sub-paths like /sign-in/sso-callback */}
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
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

function App() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Sign In",
            subtitle: "Welcome back to Heavy Guard",
          },
        },
        signUp: {
          start: {
            title: "Create Account",
            subtitle: "Join Heavy Guard",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <RefreshProvider>
          <LivePriceProvider>
          <PortfolioProvider>
          <FavoritesProvider>
          <AutoTraderProvider>
          <TooltipProvider>
            <AutoTraderEngine />
            <ExtraBotsEngine />
            <FundingBotEngine />
            <OptionsBotEngine />
            <WouterRouter base={basePath}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
          </AutoTraderProvider>
          </FavoritesProvider>
          </PortfolioProvider>
          </LivePriceProvider>
        </RefreshProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
