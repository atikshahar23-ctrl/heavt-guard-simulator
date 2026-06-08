import React from "react";
import "./_group.css";
import "./_dashboard_uhnw.css";
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
  ChevronLeft,
  Crown,
  Lock,
  Globe
} from "lucide-react";

export function Dashboard() {
  return (
    <div dir="rtl" className="uhnw-dashboard min-h-screen text-[#f4f6f8] flex flex-col md:flex-row overflow-hidden font-sans">
      <div className="uhnw-vignette"></div>
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-72 uhnw-panel !border-l-0 !border-t-0 !border-b-0 !border-r !rounded-none flex flex-col shrink-0 relative z-60 bg-[rgba(5,5,5,0.98)] backdrop-blur-2xl">
        <div className="p-8 flex items-center gap-4 relative overflow-hidden">
          <div className="relative w-12 h-12 flex-shrink-0">
            <img src="/__mockup/images/brand-logo.png" alt="Heavy Guard" className="w-full h-full object-contain filter grayscale contrast-125 brightness-200" />
            <div className="absolute inset-0 rounded-full border border-[rgba(205,191,164,0.3)] shadow-[inset_0_0_15px_rgba(205,191,164,0.1)]"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="uhnw-heading text-lg font-semibold tracking-[0.2em] uppercase gleam-text">Heavy Guard</h1>
            <span className="text-[9px] text-[var(--champagne-hairline)] tracking-[0.3em] uppercase mt-1">Private Wealth</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-8 px-4 space-y-10">
          
          <div className="space-y-1">
            <NavItem icon={<LayoutDashboard size={18} strokeWidth={1.5} />} label="לוח בקרה" active />
          </div>

          <div className="space-y-1">
            <NavGroupHeader label="שווקים גלובליים" />
            <NavItem icon={<LineChart size={18} strokeWidth={1.5} />} label="קריפטו נזיל" />
            <NavItem icon={<Globe size={18} strokeWidth={1.5} />} label="מניות ואופציות" />
            <NavItem icon={<MonitorDot size={18} strokeWidth={1.5} />} label="סורק שוק חי" />
          </div>

          <div className="space-y-1">
            <NavGroupHeader label="אלגוריתמיקה" />
            <NavItem icon={<Activity size={18} strokeWidth={1.5} />} label="ארביטראז' פאנדינג" />
            <NavItem icon={<TrendingUp size={18} strokeWidth={1.5} />} label="מומנטום כבד" />
          </div>

          <div className="space-y-1">
            <NavGroupHeader label="פעילות אוטומטית" />
            <NavItem icon={<Cpu size={18} strokeWidth={1.5} />} label="מערך הבוטים" />
            <NavItem icon={<Lock size={18} strokeWidth={1.5} />} label="כספת סיכונים" />
          </div>

        </div>

        <div className="p-6 border-t border-[rgba(255,255,255,0.05)] mt-auto relative">
          <div className="absolute top-0 left-0 right-0 uhnw-divider"></div>
          <div className="flex items-center gap-3 text-xs text-[var(--platinum-muted)] hover:text-white transition-colors cursor-pointer">
            <Settings size={16} strokeWidth={1.5} />
            <span className="tracking-wide">הגדרות קונסיירז'</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-60">
        
        {/* CONCIERGE GREETING BAR */}
        <div className="h-10 bg-[#050505] border-b border-[rgba(205,191,164,0.1)] flex items-center justify-between px-8 shrink-0 text-[10px] tracking-widest text-[#8e959d]">
          <div className="flex items-center gap-3">
            <Crown size={12} className="text-[#CDBFA4]" />
            <span className="text-[#CDBFA4]">ערב טוב · לקוח פרטי</span>
            <span className="opacity-40">|</span>
            <span className="font-mono">ID: HG-8842-X</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border border-[rgba(205,191,164,0.2)] px-2 py-0.5 rounded bg-[rgba(205,191,164,0.05)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CDBFA4] jewel-dot"></span>
              <span className="text-[#CDBFA4] font-semibold">OBSIDIAN TIER</span>
            </div>
          </div>
        </div>

        {/* TOP BAR */}
        <header className="h-20 flex items-center justify-between px-8 shrink-0 border-b border-[rgba(255,255,255,0.03)] bg-gradient-to-b from-[rgba(10,10,11,0.8)] to-transparent">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--platinum-muted)] uppercase tracking-[0.2em] mb-1">הון נזיל</span>
              <div className="flex items-baseline gap-2">
                <span className="uhnw-mono text-2xl text-white tracking-tight">$14,285,000.00</span>
                <span className="text-xs text-emerald-400 uhnw-mono mb-1">+1.4%</span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-[rgba(255,255,255,0.1)] mx-2"></div>

            <div className="flex items-center gap-3 px-4 py-2 rounded-md border border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)]">
              <span className="w-2 h-2 rounded-full text-blue-400 bg-blue-400 jewel-dot"></span>
              <span className="text-xs text-[var(--platinum-text)] tracking-wider">JARVIS ACTIVE</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-[var(--platinum-muted)] flex items-center gap-2">
              <RefreshCw size={12} className="opacity-50" />
              <span className="tracking-widest">חיבור מוצפן בטוח</span>
            </div>
            <div className="border border-[var(--platinum-muted)] text-[var(--platinum-muted)] px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase rounded bg-[rgba(0,0,0,0.5)]">
              דמו לימודי
            </div>
          </div>
        </header>

        {/* CONTENT SCROLL */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          
          {/* KPI ROW */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard label="שווי תיק כולל" value="$42,850,000.00" change="+$850,000.00" positive />
            <KpiCard label="רווח-הפסד 24 שעות" value="+$342,050.00" change="+0.8%" positive />
            <KpiCard label="פוזיציות פתוחות" value="18" />
            <KpiCard label="מסגרת אשראי פנויה" value="$15,000,000.00" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COL (2/3) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* MARKET SCANNER */}
              <section className="uhnw-panel p-8">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="uhnw-heading text-xl text-white mb-2">סורק השוק הפרטי</h2>
                    <p className="text-xs text-[var(--platinum-muted)] tracking-wider">הזדמנויות ארביטראז' וסנטימנט מוסדי</p>
                  </div>
                  <span className="text-[10px] text-[#CDBFA4] font-mono tracking-widest border-b border-[rgba(205,191,164,0.3)] pb-1">BINANCE × POLYMARKET</span>
                </div>
                
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm" dir="ltr">
                    <thead>
                      <tr className="text-[10px] text-[var(--platinum-muted)] uppercase tracking-[0.15em] border-b border-[rgba(255,255,255,0.05)]">
                        <th className="pb-4 font-normal text-right">Asset</th>
                        <th className="pb-4 font-normal">Price</th>
                        <th className="pb-4 font-normal">24h</th>
                        <th className="pb-4 font-normal">Inst. Sentiment</th>
                        <th className="pb-4 font-normal">Arb Gap</th>
                      </tr>
                    </thead>
                    <tbody className="uhnw-mono text-sm">
                      <TableRow asset="BTC/USDT" price="$64,230.50" change="+4.2%" sentiment="Strong Accumulation" gap="High" positive active />
                      <TableRow asset="ETH/USDT" price="$3,450.25" change="+2.1%" sentiment="Neutral/Bullish" gap="Med" positive />
                      <TableRow asset="SOL/USDT" price="$145.80" change="-1.5%" sentiment="Distribution" gap="Low" />
                      <TableRow asset="DOGE/USDT" price="$0.124" change="+8.4%" sentiment="Retail Frenzy" gap="High" positive />
                    </tbody>
                  </table>
                </div>
              </section>

              {/* LIVE SIGNALS */}
              <section className="uhnw-panel p-8">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="uhnw-heading text-xl text-white mb-2">סיגנלים והתראות</h2>
                    <p className="text-xs text-[var(--platinum-muted)] tracking-wider">ניתוח אלגוריתמי בזמן אמת</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full text-emerald-400 bg-emerald-400 jewel-dot"></span>
                    <span className="text-[10px] text-emerald-400 tracking-[0.2em] font-mono">LIVE FEED</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <SignalRow type="Scalp" asset="BTC/USDT" action="LONG" hint="Momentum breakout on 5m chart, RSI crossover." />
                  <SignalRow type="Funding Arb" asset="SOL/USDT" action="SHORT" hint="High funding rate on Bybit vs Binance gap. 15% APY target." />
                  <SignalRow type="Institutional" asset="ETH/USDT" action="LONG" hint="Whale accumulation detected via dark pool analysis." />
                </div>
              </section>

            </div>

            {/* RIGHT COL (1/3) */}
            <div className="space-y-8">
              
              {/* BOTS */}
              <section className="uhnw-panel p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="uhnw-heading text-lg text-white">אוטומציה מתקדמת</h2>
                  <Cpu size={16} className="text-[var(--champagne-hairline)]" strokeWidth={1.5} />
                </div>
                <div className="space-y-4">
                  <BotRow name="Quantum Arb (Low Risk)" status="Active" />
                  <BotRow name="Momentum Scalper" status="Active" />
                  <BotRow name="Delta Neutral Farm" status="Standby" />
                </div>
              </section>

              {/* RESEARCH */}
              <section className="uhnw-panel p-8 relative">
                <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-[#CDBFA4] to-transparent opacity-30"></div>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="uhnw-heading text-lg text-white">מחקר קליינטים</h2>
                  <BookOpen size={16} className="text-[#CDBFA4]" strokeWidth={1.5} />
                </div>
                <div className="space-y-6">
                  <div className="group cursor-pointer">
                    <h3 className="text-sm font-medium text-white group-hover:text-[#CDBFA4] transition-colors leading-relaxed">אסטרטגיות גידור בסביבת ריבית משתנה</h3>
                    <p className="text-xs text-[var(--platinum-muted)] mt-2 leading-relaxed">סקירה מקיפה על שילוב נגזרים להגנה על הון נזיל.</p>
                    <span className="text-[9px] text-[var(--champagne-hairline)] uppercase tracking-widest mt-3 block">Premium Report</span>
                  </div>
                  <div className="uhnw-divider"></div>
                  <div className="group cursor-pointer">
                    <h3 className="text-sm font-medium text-white group-hover:text-[#CDBFA4] transition-colors leading-relaxed">ניצול פערי פאנדינג בנפחים גבוהים</h3>
                    <p className="text-xs text-[var(--platinum-muted)] mt-2 leading-relaxed">ניתוח ביצועים של אלגוריתם ה-Arb בחודש האחרון.</p>
                    <span className="text-[9px] text-[var(--champagne-hairline)] uppercase tracking-widest mt-3 block">Market Update</span>
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
    <div className="px-4 pt-6 pb-3 text-[10px] tracking-[0.2em] uppercase text-[rgba(255,255,255,0.4)] font-medium">
      {label}
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-2.5 rounded cursor-pointer transition-all duration-300 ${
      active 
        ? "bg-[rgba(205,191,164,0.08)] text-white border-r-2 border-[#CDBFA4] shadow-[inset_0_0_20px_rgba(205,191,164,0.02)]" 
        : "text-[#8e959d] hover:text-white hover:bg-[rgba(255,255,255,0.02)] border-r-2 border-transparent"
    }`}>
      <span className={active ? "text-[#CDBFA4]" : "opacity-70"}>{icon}</span>
      <span className={`text-sm ${active ? "font-medium" : "font-normal"}`}>{label}</span>
    </div>
  );
}

function KpiCard({ label, value, change, positive }: { label: string, value: string, change?: string, positive?: boolean }) {
  return (
    <div className="uhnw-panel p-6 flex flex-col gap-4 group hover:border-[rgba(205,191,164,0.2)] transition-colors">
      <span className="text-[10px] tracking-[0.15em] uppercase text-[var(--platinum-muted)] font-medium">{label}</span>
      <div className="flex items-end justify-end overflow-hidden">
        <span dir="ltr" className="uhnw-mono text-base lg:text-lg text-white whitespace-nowrap tracking-tight">{value}</span>
      </div>
      {change && (
        <div className="flex items-center gap-2">
          <span className={`uhnw-mono text-xs ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {change}
          </span>
          <span className="text-[10px] text-[var(--platinum-muted)]">vs אתמול</span>
        </div>
      )}
    </div>
  );
}

function TableRow({ asset, price, change, sentiment, gap, positive, active }: { asset: string, price: string, change: string, sentiment: string, gap: string, positive?: boolean, active?: boolean }) {
  return (
    <tr className={`border-b border-[rgba(255,255,255,0.03)] group hover:bg-[rgba(255,255,255,0.02)] transition-colors ${active ? 'bg-[rgba(205,191,164,0.03)]' : ''}`}>
      <td className="py-5 text-right text-white flex items-center justify-end gap-3 font-medium">
        {asset}
        {active && <span className="w-1.5 h-1.5 bg-[#CDBFA4] rounded-full jewel-dot"></span>}
      </td>
      <td className="py-5 text-white">{price}</td>
      <td className={`py-5 ${positive ? "text-emerald-400" : "text-rose-400"}`}>{change}</td>
      <td className="py-5 text-[var(--platinum-muted)] font-sans text-xs tracking-wide">{sentiment}</td>
      <td className="py-5 text-[var(--champagne-hairline)]">{gap}</td>
    </tr>
  );
}

function SignalRow({ type, asset, action, hint }: { type: string, asset: string, action: "LONG" | "SHORT", hint: string }) {
  return (
    <div className="border border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.4)] rounded p-4 hover:border-[rgba(205,191,164,0.3)] transition-colors cursor-pointer group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(205,191,164,0.05)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-[0.2em] uppercase text-[#CDBFA4]">{type}</span>
          <span className={`text-[10px] px-2 py-0.5 border rounded-sm uhnw-mono ${
            action === 'LONG' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-rose-400 border-rose-400/30 bg-rose-400/10'
          }`}>{action}</span>
        </div>
        <span className="uhnw-mono text-sm text-white font-medium" dir="ltr">{asset}</span>
      </div>
      <p className="text-xs text-[var(--platinum-muted)] leading-relaxed flex items-start gap-1 relative z-10">
        <span className="font-semibold text-white/80">תובנה:</span> {hint}
      </p>
    </div>
  );
}

function BotRow({ name, status }: { name: string, status: "Active" | "Standby" }) {
  const isActive = status === "Active";
  return (
    <div className="flex items-center justify-between p-4 border border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.4)] rounded hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer">
      <span className="text-sm font-medium text-white">{name}</span>
      <div className="flex items-center gap-3">
        <span className="uhnw-mono text-[10px] tracking-widest uppercase text-[var(--platinum-muted)]">{status}</span>
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-400 text-blue-400 jewel-dot' : 'bg-zinc-600'}`}></div>
      </div>
    </div>
  );
}
