import React from "react";
import "./_group.css";
import { 
  LayoutDashboard, 
  LineChart, 
  Activity, 
  Cpu, 
  MonitorDot, 
  BookOpen,
  Settings,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Bitcoin,
  ChevronLeft
} from "lucide-react";

export function Dashboard() {
  return (
    <div dir="rtl" className="carbon-theme min-h-screen bg-carbon text-[#E8ECF1] flex flex-col md:flex-row overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 razor-panel border-l border-b-0 border-t-0 border-r-0 flex flex-col shrink-0 relative z-20">
        <div className="p-6 flex items-center gap-3 border-b border-[var(--hairline)] relative overflow-hidden">
          <div className="relative w-10 h-10 flex-shrink-0">
            <img src="/__mockup/images/brand-logo.png" alt="Heavy Guard" className="w-full h-full object-contain filter grayscale contrast-125 brightness-150" />
            <div className="gleam-highlight"></div>
            <div className="absolute inset-0 platinum-glow rounded-full"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold tracking-[0.2em] uppercase text-[#E8ECF1]">Heavy Guard</h1>
            <span className="text-[10px] text-[var(--steel-accent)] tracking-widest uppercase">Carbon Noir</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8">
          
          <div className="space-y-1">
            <NavItem icon={<LayoutDashboard size={16} />} label="לוח בקרה" active />
          </div>

          <div className="space-y-1">
            <NavGroupHeader label="שווקים" />
            <NavItem icon={<LineChart size={16} />} label="קריפטו" />
            <NavItem icon={<Activity size={16} />} label="מניות" />
            <NavItem icon={<TrendingUp size={16} />} label="מוברים" />
            <NavItem icon={<MonitorDot size={16} />} label="שווקים חיים" />
          </div>

          <div className="space-y-1">
            <NavGroupHeader label="סיגנלים ו-AI" />
            <NavItem icon={<Activity size={16} />} label="סקאלפ" />
            <NavItem icon={<TrendingUp size={16} />} label="מומנטום" />
            <NavItem icon={<TrendingDown size={16} />} label="Funding Arb" />
          </div>

          <div className="space-y-1">
            <NavGroupHeader label="אוטומציה" />
            <NavItem icon={<Cpu size={16} />} label="מרכז הבוטים" />
            <NavItem icon={<Cpu size={16} />} label="Scalp Squad" />
          </div>

          <div className="space-y-1">
            <NavGroupHeader label="לימוד ומחקר" />
            <NavItem icon={<BookOpen size={16} />} label="אקדמיה" />
            <NavItem icon={<BookOpen size={16} />} label="מחקר" />
          </div>

        </div>

        <div className="p-4 border-t border-[var(--hairline)] mt-auto">
          <div className="flex items-center gap-2 text-xs text-[var(--platinum-muted)]">
            <Settings size={14} />
            <span>הגדרות מערכת</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* TOP BAR */}
        <header className="h-16 razor-panel border-b border-t-0 border-l-0 border-r-0 flex items-center justify-between px-6 shrink-0 relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-[var(--carbon-surface)] border border-[var(--hairline)] px-3 py-1.5 rounded-sm flex items-center gap-2">
              <span className="text-[10px] text-[var(--platinum-muted)] uppercase tracking-wider">שווי תיק</span>
              <span className="font-mono text-sm text-[var(--platinum-text)]">$142,850.00</span>
            </div>
            
            <div className="bg-[var(--carbon-surface)] border border-[var(--hairline)] px-3 py-1.5 rounded-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--steel-accent)] animate-pulse"></span>
              <span className="text-[10px] text-[var(--platinum-text)] tracking-wider">JARVIS</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-[var(--platinum-muted)] flex items-center gap-1 border border-[var(--hairline)] px-2 py-1 rounded-sm bg-[var(--carbon-surface)]">
              <RefreshCw size={10} />
              <span>מתעדכן...</span>
            </div>
            <div className="border border-[var(--steel-accent)] text-[var(--steel-accent)] px-2 py-1 text-[10px] tracking-widest uppercase rounded-sm bg-[rgba(159,180,199,0.1)]">
              דמו לימודי
            </div>
          </div>
        </header>

        {/* CONTENT SCROLL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* KPI ROW */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard label="שווי תיק" value="$142,850.00" change="+2.4%" positive />
            <KpiCard label="רווח-הפסד היום" value="+$3,420.50" change="+1.2%" positive />
            <KpiCard label="פוזיציות פתוחות" value="12" />
            <KpiCard label="מזומן פנוי" value="$45,000.00" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COL (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* MARKET SCANNER */}
              <section className="razor-panel p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-widest text-[var(--platinum-text)]">סורק השוק</h2>
                  <span className="text-[10px] text-[var(--platinum-muted)] font-mono">BINANCE × POLYMARKET</span>
                </div>
                
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm" dir="ltr">
                    <thead>
                      <tr className="text-[10px] text-[var(--platinum-muted)] uppercase tracking-wider border-b border-[var(--hairline)]">
                        <th className="pb-2 font-normal text-right">Asset</th>
                        <th className="pb-2 font-normal">Price</th>
                        <th className="pb-2 font-normal">24h</th>
                        <th className="pb-2 font-normal">Sentiment</th>
                        <th className="pb-2 font-normal">Gap</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      <TableRow asset="BTC/USDT" price="$64,230" change="+4.2%" sentiment="78% Bullish" gap="High" positive active />
                      <TableRow asset="ETH/USDT" price="$3,450" change="+2.1%" sentiment="65% Bullish" gap="Med" positive />
                      <TableRow asset="SOL/USDT" price="$145" change="-1.5%" sentiment="40% Bearish" gap="Low" />
                      <TableRow asset="DOGE/USDT" price="$0.12" change="+8.4%" sentiment="85% Bullish" gap="High" positive />
                    </tbody>
                  </table>
                </div>
              </section>

              {/* LIVE SIGNALS */}
              <section className="razor-panel p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-widest text-[var(--platinum-text)]">סיגנלים חיים</h2>
                  <span className="text-[10px] text-[var(--steel-accent)] tracking-widest">REAL-TIME</span>
                </div>
                <div className="space-y-3">
                  <SignalRow type="Scalp" asset="BTC/USDT" action="LONG" hint="Momentum breakout on 5m chart, RSI crossover." />
                  <SignalRow type="Funding" asset="SOL/USDT" action="SHORT" hint="High funding rate on Bybit vs Binance gap." />
                  <SignalRow type="Momentum" asset="ETH/USDT" action="LONG" hint="Whale accumulation detected, volume spike." />
                </div>
              </section>

            </div>

            {/* RIGHT COL (1/3) */}
            <div className="space-y-6">
              
              {/* BOTS */}
              <section className="razor-panel p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-widest text-[var(--platinum-text)]">הבוטים שלי</h2>
                  <Cpu size={14} className="text-[var(--platinum-muted)]" />
                </div>
                <div className="space-y-3">
                  <BotRow name="Dip Buyer" status="Armed" />
                  <BotRow name="Breakout Hunter" status="Armed" />
                  <BotRow name="Scalp Squad" status="Paused" />
                </div>
              </section>

              {/* ACADEMY */}
              <section className="razor-panel p-5 border-l border-[var(--steel-accent)] bg-[linear-gradient(90deg,rgba(159,180,199,0.05),transparent)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-widest text-[var(--platinum-text)]">אקדמיה / למד</h2>
                  <BookOpen size={14} className="text-[var(--steel-accent)]" />
                </div>
                <div className="space-y-4">
                  <div className="group cursor-pointer">
                    <h3 className="text-xs text-[var(--platinum-text)] group-hover:text-[var(--steel-accent)] transition-colors">איך לקרוא Funding Rates?</h3>
                    <p className="text-[10px] text-[var(--platinum-muted)] mt-1">הבן את הדינמיקה בין שווקים שונים כדי לנצל פערי ארביטראז'.</p>
                  </div>
                  <div className="w-full h-px bg-[var(--hairline)]"></div>
                  <div className="group cursor-pointer">
                    <h3 className="text-xs text-[var(--platinum-text)] group-hover:text-[var(--steel-accent)] transition-colors">ניהול סיכונים מתקדם</h3>
                    <p className="text-[10px] text-[var(--platinum-muted)] mt-1">הגדרת Stop Loss ו-Position Sizing נכונים לשוק תנודתי.</p>
                  </div>
                </div>
              </section>

            </div>

          </div>
        </div>

      </main>

    </div>
  );
}

function NavGroupHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-2 text-[10px] tracking-widest uppercase text-[var(--platinum-muted)]">
      {label}
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-sm cursor-pointer transition-all ${
      active 
        ? "razor-edge-active text-[var(--platinum-text)]" 
        : "text-[var(--platinum-muted)] hover:text-[var(--platinum-text)] hover:bg-[var(--carbon-surface)]"
    }`}>
      <span className={active ? "text-[var(--steel-accent)]" : ""}>{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function KpiCard({ label, value, change, positive }: { label: string, value: string, change?: string, positive?: boolean }) {
  return (
    <div className="razor-panel p-4 flex flex-col gap-2">
      <span className="text-[10px] tracking-widest uppercase text-[var(--platinum-muted)]">{label}</span>
      <div className="flex items-end justify-between">
        <span className="font-mono text-lg text-[var(--platinum-text)]">{value}</span>
        {change && (
          <span className={`font-mono text-xs ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

function TableRow({ asset, price, change, sentiment, gap, positive, active }: { asset: string, price: string, change: string, sentiment: string, gap: string, positive?: boolean, active?: boolean }) {
  return (
    <tr className={`border-b border-[var(--hairline)] group hover:bg-[var(--carbon-surface)] transition-colors ${active ? 'bg-[rgba(159,180,199,0.05)]' : ''}`}>
      <td className="py-3 text-right text-[var(--platinum-text)] flex items-center justify-end gap-2">
        {asset}
        {active && <span className="w-1 h-3 bg-[var(--steel-accent)] rounded-sm"></span>}
      </td>
      <td className="py-3 text-[var(--platinum-text)]">{price}</td>
      <td className={`py-3 ${positive ? "text-emerald-400" : "text-rose-400"}`}>{change}</td>
      <td className="py-3 text-[var(--platinum-muted)]">{sentiment}</td>
      <td className="py-3 text-[var(--steel-accent)]">{gap}</td>
    </tr>
  );
}

function SignalRow({ type, asset, action, hint }: { type: string, asset: string, action: "LONG" | "SHORT", hint: string }) {
  return (
    <div className="border border-[var(--hairline)] bg-[var(--carbon-surface)] rounded-sm p-3 hover:border-[var(--steel-accent)] transition-colors cursor-pointer group relative overflow-hidden">
      <div className="absolute inset-0 gleam-highlight opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase text-[var(--platinum-muted)]">{type}</span>
          <span className="text-[10px] text-[var(--steel-accent)] px-1.5 py-0.5 border border-[var(--steel-accent)] rounded-sm font-mono">{action}</span>
        </div>
        <span className="font-mono text-xs text-[var(--platinum-text)]" dir="ltr">{asset}</span>
      </div>
      <p className="text-[10px] text-[var(--platinum-muted)] leading-relaxed flex items-start gap-1">
        <span className="font-bold text-[var(--platinum-text)]">למה?</span> {hint}
      </p>
    </div>
  );
}

function BotRow({ name, status }: { name: string, status: "Armed" | "Paused" }) {
  const isArmed = status === "Armed";
  return (
    <div className="flex items-center justify-between p-2 border border-[var(--hairline)] bg-[var(--carbon-surface)] rounded-sm">
      <span className="text-xs text-[var(--platinum-text)]">{name}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--platinum-muted)]">{status}</span>
        <div className={`w-2 h-2 rounded-full ${isArmed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-rose-400'}`}></div>
      </div>
    </div>
  );
}
