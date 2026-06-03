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
import Movers from "@/pages/movers";
import Layout from "@/components/layout";
import { PortfolioProvider } from "@/contexts/portfolio-context";
import { RefreshProvider } from "@/contexts/refresh-context";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/browse" component={Browse} />
        <Route path="/movers" component={Movers} />
        <Route path="/markets" component={Markets} />
        <Route path="/binance" component={Binance} />
        <Route path="/recommendations" component={Recommendations} />
        <Route path="/stocks" component={Stocks} />
        <Route path="/simulator" component={Simulator} />
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
        <PortfolioProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </PortfolioProvider>
      </RefreshProvider>
    </QueryClientProvider>
  );
}

export default App;
