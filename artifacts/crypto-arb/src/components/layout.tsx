import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { Show, useClerk, useUser } from "@clerk/react";
import {
  LayoutDashboard, LineChart, CandlestickChart, Zap, Globe, Trophy,
  TrendingUp, Menu, X, Activity, Gauge, Timer, History, Rocket, Megaphone, Bot, Search, Newspaper, Calculator, Compass, Coins,
  LogIn, LogOut, User, BarChart3, Crown, CalendarDays,
} from "lucide-react";
import { Jarvis } from "@/components/jarvis";
import { MarketClock } from "@/components/market-clock";
import { TopControls } from "@/components/top-controls";
import { WalletSwitcher } from "@/components/wallet-switcher";
import { EarthBackground } from "@/components/earth-background";
import { TickerTape } from "@/components/ticker-tape";
import { SidebarNews } from "@/components/sidebar-news";
import logoUrl from "@/assets/logo-heavy-guard.png";

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard; extra?: React.ReactNode };
type NavGroup = { title: string; links: NavLink[] };

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

function AuthSection() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [showMenu, setShowMenu] = useState(false);

  if (!isLoaded) {
    return (
      <div className="relative px-4 py-3 border-t border-border/70 shrink-0">
        <div className="h-4 w-full bg-secondary/30 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative px-4 py-3 border-t border-border/70 shrink-0">
      <Show when="signed-out">
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-2 text-[11px] font-bold font-mono bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            התחבר
          </Link>
          <Link
            href="/sign-up"
            className="flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-2 text-[11px] font-bold font-mono bg-secondary/60 text-foreground hover:bg-secondary/80 transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            הרשמה
          </Link>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-full flex items-center gap-2 rounded px-3 py-2 text-[11px] font-medium hover:bg-secondary/40 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
              {(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="truncate text-foreground text-[11px] font-medium">
                {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "User"}
              </p>
              <p className="text-[9px] text-muted-foreground">מחובר</p>
            </div>
            <LogOut className="h-3 w-3 text-muted-foreground" />
          </button>
          {showMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-card p-2 shadow-lg z-50">
              <button
                onClick={() => {
                  signOut({ redirectUrl: "/" });
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 rounded px-3 py-2 text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                התנתק
              </button>
            </div>
          )}
        </div>
      </Show>
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

  const groups: NavGroup[] = [
    {
      title: "לשכה פרטית",
      links: [
        { href: "/", label: "לוח בקרה", icon: LayoutDashboard },
        { href: "/advisor", label: "היועץ הראשי", icon: Compass },
        { href: "/simulator", label: "תיק ההשקעות", icon: Trophy, extra: <PortfolioMiniBalance /> },
        { href: "/leaderboard", label: "מיטב הסוחרים", icon: Crown },
      ],
    },
    {
      title: "שווקים גלובליים",
      links: [
        { href: "/markets", label: "קריפטו נזיל", icon: LineChart },
        { href: "/stocks", label: "מניות ואופציות", icon: TrendingUp },
        { href: "/stock-desk", label: "חדר מניות", icon: BarChart3 },
        { href: "/browse", label: "סורק שוק חי", icon: Globe },
        { href: "/binance", label: "בורסת ביננס", icon: CandlestickChart },
        { href: "/movers", label: "תנודות שוק", icon: Activity },
      ],
    },
    {
      title: "אלגוריתמיקה",
      links: [
        { href: "/scalp", label: "סקאלפ מהיר", icon: Gauge },
        { href: "/funding-arb", label: "ארביטראז' פאנדינג", icon: Coins },
        { href: "/momentum", label: "מומנטום כבד", icon: Rocket },
        { href: "/quickbets", label: "הימורים מהירים", icon: Timer },
        { href: "/smart-money", label: "כסף חכם", icon: Megaphone },
      ],
    },
    {
      title: "פעילות אוטומטית",
      links: [
        { href: "/bots", label: "מערך הבוטים", icon: Bot },
        { href: "/trade-desk", label: "שולחן המסחר", icon: Zap },
      ],
    },
    {
      title: "מחקר וכלים",
      links: [
        { href: "/briefing", label: "תדריך שוק", icon: Newspaper },
        { href: "/calendar", label: "יומן אירועים", icon: CalendarDays },
        { href: "/research", label: "חדר מחקר", icon: Search },
        { href: "/insights", label: "ניתוח ותובנות", icon: BarChart3 },
        { href: "/tools", label: "כלי סחר", icon: Calculator },
        { href: "/history", label: "היסטוריית עסקאות", icon: History },
      ],
    },
  ];

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "לילה טוב" : hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב";

  const SidebarContent = () => (
    <>
      {/* Alien grid sheen + scanning top edge */}
      <div className="alien-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 60% at 50% 0%, hsl(39 28% 72% / 0.07), transparent 60%)' }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(39 28% 72%), hsl(207 30% 70%), transparent)' }} />

      <div className="relative px-5 py-5 short:py-2.5 border-b border-border/70 flex flex-col items-center gap-2 short:gap-1">
        <img
          src={logoUrl}
          alt="HEAVY GUARD SYSTEM"
          draggable={false}
          className="w-28 short:w-16 h-auto select-none transition-all"
          style={{ filter: 'drop-shadow(0 0 14px hsl(43 64% 54% / 0.28))' }}
        />
        <h1 className="gold-gleam uhnw-heading text-base short:text-sm font-semibold tracking-[0.22em] uppercase">Heavy Guard</h1>
        <span className="text-[8.5px] short:text-[8px] tracking-[0.34em] uppercase font-mono text-[#d4af60]/80">Private Wealth</span>
        <MarketClock />
      </div>

      <nav className="relative flex-1 px-2.5 py-3 short:py-2 space-y-5 short:space-y-3 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="px-3 pb-2 short:pb-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.26em] text-[#cdbfa4]/55" dir="rtl">{group.title}</span>
            </div>
            <div className="space-y-0.5">
              {group.links.map((link) => {
                const isActive = location === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`group relative flex flex-col pr-3 pl-3 py-2 short:py-1.5 rounded-md transition-all duration-300 border-r-2 ${
                      isActive
                        ? 'text-foreground border-[#cdbfa4]'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-white/[0.02]'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(90deg, hsl(39 28% 72% / 0.10), transparent)',
                      boxShadow: 'inset 0 0 20px hsl(39 28% 72% / 0.04)',
                    } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${isActive ? 'text-[#cdbfa4]' : 'opacity-70 group-hover:translate-x-0.5'}`} strokeWidth={1.5} />
                      <span className={`text-[13px] tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>{link.label}</span>
                    </div>
                    {link.extra}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Market News — desktop: always expanded, scrolls with nav */}
        <div className="hidden md:block pt-1 border-t border-border/40">
          <SidebarNews />
        </div>
        {/* Market News — mobile: collapsible accordion so it never crowds nav links */}
        <div className="md:hidden pt-1 border-t border-border/40">
          <SidebarNews collapsible />
        </div>
      </nav>

      <div className="relative px-4 py-3 border-t border-border/70 shrink-0">
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

      {/* ── Auth Section ── */}
      <AuthSection />
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* ── Desktop sidebar ── */}
      <aside
        className="relative z-10 hidden md:flex w-52 border-r border-border flex-col shrink-0"
        style={{ background: 'hsl(216 14% 5%)' }}
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
        style={{ background: 'hsl(216 14% 5%)' }}
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
          <div className="ml-auto">
            <WalletSwitcher compact />
          </div>
        </div>
        {/* Concierge greeting bar (desktop) */}
        <div className="hidden md:flex shrink-0 items-center justify-between px-6 py-1.5 border-b border-[#cdbfa4]/10 bg-background/95 backdrop-blur-sm text-[10px] tracking-widest">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Crown className="h-3 w-3 text-[#cdbfa4]" strokeWidth={1.5} />
            <span className="text-[#cdbfa4]">{greeting} · לקוח פרטי</span>
            <span className="opacity-30">|</span>
            <span className="font-mono opacity-60">חיבור מוצפן בטוח</span>
          </div>
          <div className="flex items-center gap-2 border border-[#cdbfa4]/25 px-2.5 py-0.5 rounded bg-[#cdbfa4]/5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#cdbfa4] jewel-dot" />
            <span className="text-[#cdbfa4] font-semibold">OBSIDIAN TIER</span>
          </div>
        </div>
        {/* Live global price tape */}
        <TickerTape />
        {/* Scrollable page area */}
        <div className="flex-1 overflow-y-auto relative min-h-0">
          {/* Animated Earth + global money-flow backdrop */}
          <EarthBackground />
          <div key={location} className="relative z-10 h-full page-enter">
            {children}
          </div>
        </div>
      </main>

      <TopControls />
      <Jarvis />
    </div>
  );
}
