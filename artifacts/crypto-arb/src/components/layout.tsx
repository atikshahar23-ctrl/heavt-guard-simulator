import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import {
  LayoutDashboard, LineChart, CandlestickChart, Zap, Globe, Trophy,
  TrendingUp, Menu, X, Activity, Gauge, Timer, Star, History,
} from "lucide-react";
import { Jarvis } from "@/components/jarvis";
import { TopControls } from "@/components/top-controls";
import logoUrl from "@/assets/logo-heavy-guard.png";

function PortfolioMiniBalance() {
  const { cash, polyPositions, binancePositions, stockPositions } = usePortfolio();
  const openCount = polyPositions.length + binancePositions.length + stockPositions.length;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: health, isLoading } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 60000,
    }
  });

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/recommendations", label: "Trade Desk", icon: Zap },
    { href: "/scalp", label: "Scalp Signals", icon: Gauge },
    { href: "/quickbets", label: "Quick Bets", icon: Timer },
    { href: "/stocks", label: "Stocks", icon: TrendingUp },
    { href: "/movers", label: "Market Movers", icon: Activity },
    { href: "/browse", label: "Live Markets", icon: Globe },
    { href: "/simulator", label: "Simulator", icon: Trophy, extra: <PortfolioMiniBalance /> },
    { href: "/history", label: "Trade History", icon: History },
    { href: "/markets", label: "Crypto Markets", icon: LineChart },
    { href: "/binance", label: "Binance", icon: CandlestickChart },
  ];

  const SidebarContent = () => (
    <>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(43 74% 52%), transparent)' }} />
      <div className="px-5 py-5 short:py-2.5 border-b border-border flex flex-col items-center gap-2 short:gap-1">
        <img
          src={logoUrl}
          alt="HEAVY GUARD SYSTEM"
          draggable={false}
          className="w-36 short:w-20 h-auto select-none transition-all"
          style={{ filter: 'drop-shadow(0 0 14px hsl(43 74% 52% / 0.22))' }}
        />
        <p className="text-[9px] short:text-[8px] text-muted-foreground tracking-[0.32em] uppercase font-mono">Sentinel Terminal</p>
      </div>
      <nav className="flex-1 p-3 short:p-2 space-y-0.5 overflow-y-auto">
        {links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col px-3 py-2 rounded transition-all ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
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
      <div className="px-4 py-3 border-t border-border shrink-0">
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
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* ── Desktop sidebar ── */}
      <aside
        className="relative hidden md:flex w-52 border-r border-border flex-col shrink-0"
        style={{ background: 'hsl(0 0% 5%)' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 border-r border-border transform transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'hsl(0 0% 5%)' }}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded text-muted-foreground hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden shrink-0 flex items-center gap-3 px-3 py-2 border-b border-border bg-background/95 backdrop-blur-sm z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-black font-mono text-primary tracking-widest uppercase">HEAVY GUARD</span>
        </div>
        {/* Scrollable page area */}
        <div className="flex-1 overflow-y-auto relative min-h-0">
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: 'radial-gradient(ellipse at top right, hsl(43 74% 52% / 0.04) 0%, transparent 60%)',
            }}
          />
          <div className="relative h-full">
            {children}
          </div>
        </div>
      </main>

      <TopControls />
      <Jarvis />
    </div>
  );
}
