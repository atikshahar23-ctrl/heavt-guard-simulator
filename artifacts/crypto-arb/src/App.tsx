import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const queryClient = new QueryClient();

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
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RefreshProvider>
        <LivePriceProvider>
        <PortfolioProvider>
        <FavoritesProvider>
        <AutoTraderProvider>
        <TooltipProvider>
          <AutoTraderEngine />
          <ExtraBotsEngine />
          <FundingBotEngine />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
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
  );
}

export default App;
