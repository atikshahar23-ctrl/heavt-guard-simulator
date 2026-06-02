import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Activity, LayoutDashboard, LineChart, CandlestickChart, Zap, Globe } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health, isLoading } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 60000,
    }
  });

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/recommendations", label: "Trade Desk", icon: Zap },
    { href: "/browse", label: "Live Markets", icon: Globe },
    { href: "/markets", label: "Crypto Markets", icon: LineChart },
    { href: "/binance", label: "Binance", icon: CandlestickChart },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold font-mono tracking-tighter text-primary flex items-center gap-2">
            <Activity className="h-5 w-5" />
            ARB_SCAN
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono uppercase">Sentinel Terminal</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">API STATUS</span>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : (health?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500')}`} />
              <span className={health?.status === 'ok' ? 'text-emerald-500' : 'text-muted-foreground'}>
                {isLoading ? 'CHK' : (health?.status === 'ok' ? 'OK' : 'ERR')}
              </span>
            </div>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />
        <div className="relative h-full">
          {children}
        </div>
      </main>
    </div>
  );
}