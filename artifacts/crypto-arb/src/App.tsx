import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Markets from "@/pages/markets";
import Browse from "@/pages/browse";
import Binance from "@/pages/binance";
import Recommendations from "@/pages/recommendations";
import Simulator from "@/pages/simulator";
import Stocks from "@/pages/stocks";
import StockDesk from "@/pages/stock-desk";
import SmartMoney from "@/pages/smart-money";
import Movers from "@/pages/movers";
import Scalp from "@/pages/scalp";
import Momentum from "@/pages/momentum";
import QuickBets from "@/pages/quickbets";
import History from "@/pages/history";
import TradeDesk from "@/pages/trade-desk";
import Bots from "@/pages/bots";
import Research from "@/pages/research";
import Briefing from "@/pages/briefing";
import Tools from "@/pages/tools";
import Layout from "@/components/layout";
import { PortfolioProvider } from "@/contexts/portfolio-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { AutoTraderProvider } from "@/contexts/autotrader-context";
import { RefreshProvider } from "@/contexts/refresh-context";
import { LivePriceProvider } from "@/contexts/live-price-context";
import { AutoTraderEngine } from "@/components/autotrader-engine";
import { ExtraBotsEngine } from "@/components/extra-bots-engine";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/browse" component={Browse} />
        <Route path="/movers" component={Movers} />
        <Route path="/scalp" component={Scalp} />
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
        <Route path="/briefing" component={Briefing} />
        <Route path="/tools" component={Tools} />
        <Route path="/research" component={Research} />
        <Route component={NotFound} />
      </Switch>
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
