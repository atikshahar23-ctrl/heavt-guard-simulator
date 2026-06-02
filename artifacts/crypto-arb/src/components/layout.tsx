import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { Activity, LayoutDashboard, LineChart, CandlestickChart, Zap, Globe, Trophy } from "lucide-react";

function PortfolioMiniBalance() {
  const { cash, polyPositions, binancePositions } = usePortfolio();
  const openCount = polyPositions.length + binancePositions.length;
  return (
    <div className="flex items-center justify-between mt-0.5">
      <span className="text-[9px] font-mono text-primary/70 tracking-wider">${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      {openCount > 0 && (
        <span className="text-[9px] font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{openCount} pos</span>
      )}
    </div>
  );
}

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
    { href: "/simulator", label: "Simulator", icon: Trophy, extra: <PortfolioMiniBalance /> },
    { href: "/markets", label: "Crypto Markets", icon: LineChart },
    { href: "/binance", label: "Binance", icon: CandlestickChart },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="relative w-60 border-r border-border flex flex-col" style={{ background: 'hsl(0 0% 5%)' }}>
        {/* Gold top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(43 74% 52%), transparent)' }} />

        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'hsl(43 74% 52% / 0.15)', border: '1px solid hsl(43 74% 52% / 0.4)' }}>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-widest text-primary font-mono uppercase">ARB_SCAN</h1>
              <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase font-mono">Sentinel Terminal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {links.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col px-3 py-2 rounded transition-all ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={isActive ? {
                  background: 'hsl(43 74% 52% / 0.08)',
                  borderLeft: '2px solid hsl(43 74% 52%)',
                  paddingLeft: '10px',
                } : {}}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                  <span className={`text-xs font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>{link.label}</span>
                </div>
                {link.extra}
              </Link>
            );
          })}
        </nav>

        {/* Status bar */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-muted-foreground tracking-[0.15em] uppercase">API Status</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : health?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className={`text-[9px] font-mono font-bold tracking-wider ${health?.status === 'ok' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                {isLoading ? 'CHK' : health?.status === 'ok' ? 'LIVE' : 'ERR'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: 'radial-gradient(ellipse at top right, hsl(43 74% 52% / 0.04) 0%, transparent 60%)',
          }}
        />
        <div className="relative h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
