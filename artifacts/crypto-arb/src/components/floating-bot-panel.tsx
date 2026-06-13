import { useState, useMemo } from "react";
import { useAutoTrader } from "@/contexts/autotrader-context";
import { useLanguage } from "@/contexts/language-context";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  Bot, Power, Gauge, Rocket, Megaphone, Timer, TrendingDown, TrendingUp,
  Layers, Coins, Sparkles, Zap, PauseCircle, PlayCircle, X, Waves,
} from "lucide-react";

export function FloatingBotPanel() {
  const { settings, update, startBoost, stopBoost } = useAutoTrader();
  const { dir } = useLanguage();
  const [open, setOpen] = useState(false);

  const boostActive = useMemo(() => settings.boostUntil > Date.now(), [settings.boostUntil]);
  const scalpOn = settings.enabled && (settings.strategy === "SCALP" || settings.strategy === "BOTH");
  const momOn = settings.enabled && (settings.strategy === "MOMENTUM" || settings.strategy === "BOTH");

  const botCount = [
    scalpOn, momOn, settings.stocksEnabled, settings.polyEnabled,
    settings.dipEnabled, settings.breakoutEnabled, settings.dcaEnabled,
    settings.fundingEnabled, settings.optionsEnabled, settings.flowBotEnabled,
    settings.rangeEnabled,
  ].filter(Boolean).length;

  const armAll = () => {
    update({
      enabled: true,
      strategy: "BOTH",
      stocksEnabled: true,
      polyEnabled: true,
      dipEnabled: true,
      breakoutEnabled: true,
      dcaEnabled: true,
      fundingEnabled: true,
      optionsEnabled: true,
      flowBotEnabled: true,
      rangeEnabled: true,
    });
    toast({ title: "All bots armed", description: "Every bot is now active and ready to trade." });
  };

  const disarmAll = () => {
    update({
      enabled: false,
      strategy: settings.strategy,
      stocksEnabled: false,
      polyEnabled: false,
      dipEnabled: false,
      breakoutEnabled: false,
      dcaEnabled: false,
      fundingEnabled: false,
      optionsEnabled: false,
      flowBotEnabled: false,
      rangeEnabled: false,
    });
    toast({ title: "All bots disarmed", description: "Every bot is now off. Existing positions remain open." });
  };

  const toggleFleetPause = () => {
    const next = !settings.fleetPaused;
    update({ fleetPaused: next });
    toast({
      title: next ? "Fleet paused" : "Fleet resumed",
      description: next ? "Bots will stop opening new trades." : "Bots are free to trade again.",
    });
  };

  const toggleScalp = () => {
    const nextScalp = !scalpOn;
    const nextMom = momOn;
    if (!nextScalp && !nextMom) { update({ enabled: false }); return; }
    update({ enabled: true, strategy: nextScalp && nextMom ? "BOTH" : nextScalp ? "SCALP" : "MOMENTUM" });
  };

  const toggleMomentum = () => {
    const nextScalp = scalpOn;
    const nextMom = !momOn;
    if (!nextScalp && !nextMom) { update({ enabled: false }); return; }
    update({ enabled: true, strategy: nextScalp && nextMom ? "BOTH" : nextScalp ? "SCALP" : "MOMENTUM" });
  };

  const bots = [
    { key: "scalp", title: "Scalp", icon: Gauge, on: scalpOn, toggle: toggleScalp },
    { key: "momentum", title: "Momentum", icon: Rocket, on: momOn, toggle: toggleMomentum },
    { key: "smart", title: "Smart-Money", icon: Megaphone, on: settings.stocksEnabled, toggle: () => update({ stocksEnabled: !settings.stocksEnabled }) },
    { key: "poly", title: "Polymarket", icon: Timer, on: settings.polyEnabled, toggle: () => update({ polyEnabled: !settings.polyEnabled }) },
    { key: "dip", title: "Dip Buyer", icon: TrendingDown, on: settings.dipEnabled, toggle: () => update({ dipEnabled: !settings.dipEnabled }) },
    { key: "breakout", title: "Breakout", icon: TrendingUp, on: settings.breakoutEnabled, toggle: () => update({ breakoutEnabled: !settings.breakoutEnabled }) },
    { key: "dca", title: "Blue-Chip DCA", icon: Layers, on: settings.dcaEnabled, toggle: () => update({ dcaEnabled: !settings.dcaEnabled }) },
    { key: "funding", title: "Funding Arb", icon: Coins, on: settings.fundingEnabled, toggle: () => update({ fundingEnabled: !settings.fundingEnabled }) },
    { key: "options", title: "Options", icon: Sparkles, on: settings.optionsEnabled, toggle: () => update({ optionsEnabled: !settings.optionsEnabled }) },
    { key: "flow", title: "Flow Bot", icon: Zap, on: settings.flowBotEnabled, toggle: () => update({ flowBotEnabled: !settings.flowBotEnabled }) },
    { key: "range", title: "Range Bot", icon: Waves, on: settings.rangeEnabled, toggle: () => update({ rangeEnabled: !settings.rangeEnabled }) },
  ];

  // The sidebar sits on the right in RTL (Hebrew) layouts, so anchor this
  // panel to the opposite side from the sidebar in each direction — otherwise
  // it ends up overlapped/hidden behind the sidebar in RTL.
  const sideCls = dir === "rtl" ? "left-4 items-start" : "right-4 items-end";

  return (
    <div className={`fixed bottom-4 z-40 flex flex-col gap-2 ${sideCls}`}>
      {/* Collapsed button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="h-12 w-12 rounded-full border border-primary/40 bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-primary/10 hover:scale-105 transition-all"
          title="Bot Control Panel"
        >
          <div className="relative">
            <Bot className="h-5 w-5 text-primary" />
            {botCount > 0 && (
              <span className="absolute -top-1 -right-1.5 h-4 w-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center border border-background">
                {botCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="rounded-xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-2xl shadow-primary/10 w-[280px] sm:w-[320px] max-w-[calc(100vw-32px)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Bot Control</span>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${botCount > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                {botCount} active
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Bot list */}
          <div className="max-h-[50vh] overflow-y-auto">
            {bots.map((b) => (
              <div key={b.key} className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <b.icon className={`h-4 w-4 flex-shrink-0 ${b.on ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-medium ${b.on ? "text-foreground" : "text-muted-foreground"}`}>{b.title}</span>
                </div>
                <Switch checked={b.on} onCheckedChange={b.toggle} />
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="px-4 py-3 border-t border-border bg-secondary/20">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={botCount > 0 ? disarmAll : armAll}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-bold font-mono transition-all ${
                  botCount > 0
                    ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                }`}
              >
                <Power className="h-3.5 w-3.5" />
                {botCount > 0 ? "Disarm All" : "Arm All"}
              </button>
              <button
                onClick={toggleFleetPause}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-bold font-mono transition-all border ${
                  settings.fleetPaused
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                }`}
              >
                {settings.fleetPaused ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
                {settings.fleetPaused ? "Resume" : "Pause"}
              </button>
            </div>
            <button
              onClick={boostActive ? stopBoost : () => startBoost(5 * 60 * 1000)}
              className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-bold font-mono transition-all border ${
                boostActive
                  ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                  : "bg-secondary/50 text-muted-foreground border-border hover:text-primary hover:border-primary/40"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              {boostActive ? "Stop Boost" : "Boost (5 min)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
