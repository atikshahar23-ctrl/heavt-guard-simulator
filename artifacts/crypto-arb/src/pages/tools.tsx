import { useState } from "react";
import {
  Calculator, ArrowRightLeft, Target, TrendingUp,
  Scale, Percent, DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";


// Position Size Calculator
function PositionSizeCalc() {
  const { lang, dir } = useLanguage();
  const [capital, setCapital] = useState(10000);
  const [riskPct, setRiskPct] = useState(2);
  const [entry, setEntry] = useState(100);
  const [sl, setSl] = useState(95);
  const [leverage, setLeverage] = useState(1);
  const [assetType, setAssetType] = useState<"crypto" | "stock">("crypto");

  const riskAmount = (capital * riskPct) / 100;
  const priceDiff = Math.abs(entry - sl);
  const positionSize = priceDiff > 0 ? riskAmount / priceDiff : 0;
  const notional = positionSize * entry;
  const margin = notional / leverage;
  const rMultiple = priceDiff > 0 ? riskAmount / priceDiff : 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir={dir}>
      <div className="flex items-center gap-1.5">
        <Scale className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">{t("tools.posSize.title", lang)}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("tools.posSize.desc", lang)}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.posSize.capital", lang)}</label>
          <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.posSize.riskPct", lang)}</label>
          <Input type="number" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.posSize.entry", lang)}</label>
          <Input type="number" value={entry} onChange={(e) => setEntry(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.posSize.stop", lang)}</label>
          <Input type="number" value={sl} onChange={(e) => setSl(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.leverage", lang)}</label>
          <Input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => setAssetType("crypto")} className={`text-[10px] px-2 py-1 rounded border ${assetType === "crypto" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{t("tools.crypto", lang)}</button>
          <button onClick={() => setAssetType("stock")} className={`text-[10px] px-2 py-1 rounded border ${assetType === "stock" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{t("tools.stocks", lang)}</button>
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.posSize.riskAmount", lang)}</span>
          <span className="font-bold font-mono">${riskAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{assetType === "crypto" ? t("tools.posSize.sizePosition", lang) : t("tools.posSize.sizeShares", lang)}</span>
          <span className="font-bold font-mono">{positionSize.toLocaleString("en-US", { maximumFractionDigits: assetType === "crypto" ? 4 : 2 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.posSize.notional", lang)}</span>
          <span className="font-bold font-mono">${notional.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.posSize.margin", lang)}</span>
          <span className="font-bold font-mono">${margin.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.posSize.rSingle", lang)}</span>
          <span className="font-bold font-mono">{rMultiple.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}


// Risk / Reward Calculator
function RiskRewardCalc() {
  const { lang, dir } = useLanguage();
  const [entry, setEntry] = useState(100);
  const [sl, setSl] = useState(95);
  const [tp, setTp] = useState(110);
  const [leverage, setLeverage] = useState(1);
  const [dirState, setDirState] = useState<"LONG" | "SHORT">("LONG");

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  const rr = risk > 0 ? reward / risk : 0;
  const winPct = rr > 0 ? 1 / (1 + rr) : 0;
  const slPct = entry > 0 ? (risk / entry) * 100 : 0;
  const tpPct = entry > 0 ? (reward / entry) * 100 : 0;
  const slPctLev = slPct * leverage;
  const tpPctLev = tpPct * leverage;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir={dir}>
      <div className="flex items-center gap-1.5">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">{t("tools.rr.title", lang)}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("tools.rr.desc", lang)}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.direction", lang)}</label>
          <div className="flex gap-1">
            <button onClick={() => setDirState("LONG")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dirState === "LONG" ? "border-emerald-500 text-emerald-400" : "border-border text-muted-foreground"}`}>{t("tools.long", lang)}</button>
            <button onClick={() => setDirState("SHORT")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dirState === "SHORT" ? "border-red-500 text-red-400" : "border-border text-muted-foreground"}`}>{t("tools.short", lang)}</button>
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.entryPrice", lang)}</label>
          <Input type="number" value={entry} onChange={(e) => setEntry(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.stopPrice", lang)}</label>
          <Input type="number" value={sl} onChange={(e) => setSl(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.targetPrice", lang)}</label>
          <Input type="number" value={tp} onChange={(e) => setTp(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.leverage", lang)}</label>
          <Input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.rr.risk", lang)}</span>
          <span className="font-bold font-mono">${risk.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.rr.reward", lang)}</span>
          <span className="font-bold font-mono">${reward.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">R:R</span>
          <span className="font-bold font-mono text-primary">1:{rr.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.rr.slPctNoLev", lang)}</span>
          <span className="font-bold font-mono text-red-400">-{slPct.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.rr.tpPctNoLev", lang)}</span>
          <span className="font-bold font-mono text-emerald-400">+{tpPct.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.rr.slPctLev", lang)}</span>
          <span className="font-bold font-mono text-red-400">-{slPctLev.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.rr.tpPctLev", lang)}</span>
          <span className="font-bold font-mono text-emerald-400">+{tpPctLev.toFixed(2)}%</span>
        </div>
        <div className="border-t border-border/40 pt-1 mt-1 flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.rr.minWin", lang)}</span>
          <span className="font-bold font-mono">{winPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}


// P&L Calculator
function PnlCalc() {
  const { lang, dir } = useLanguage();
  const [entry, setEntry] = useState(100);
  const [exitPrice, setExitPrice] = useState(110);
  const [qty, setQty] = useState(100);
  const [leverage, setLeverage] = useState(1);
  const [dirState, setDirState] = useState<"LONG" | "SHORT">("LONG");

  const priceDiff = exitPrice - entry;
  const pnl = dirState === "LONG" ? priceDiff * qty * leverage : -priceDiff * qty * leverage;
  const margin = entry * qty;
  const roi = margin > 0 ? (pnl / margin) * 100 : 0;
  const breakEven = roi >= 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir={dir}>
      <div className="flex items-center gap-1.5">
        <DollarSign className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">{t("tools.pnl.title", lang)}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("tools.pnl.desc", lang)}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.direction", lang)}</label>
          <div className="flex gap-1">
            <button onClick={() => setDirState("LONG")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dirState === "LONG" ? "border-emerald-500 text-emerald-400" : "border-border text-muted-foreground"}`}>{t("tools.long", lang)}</button>
            <button onClick={() => setDirState("SHORT")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dirState === "SHORT" ? "border-red-500 text-red-400" : "border-border text-muted-foreground"}`}>{t("tools.short", lang)}</button>
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.entryPrice", lang)}</label>
          <Input type="number" value={entry} onChange={(e) => setEntry(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.exitPrice", lang)}</label>
          <Input type="number" value={exitPrice} onChange={(e) => setExitPrice(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.qty", lang)}</label>
          <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.leverage", lang)}</label>
          <Input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.pnl.gross", lang)}</span>
          <span className={`font-bold font-mono ${breakEven ? "text-emerald-400" : "text-red-400"}`}>{pnl >= 0 ? "+" : ""}${pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.pnl.roi", lang)}</span>
          <span className={`font-bold font-mono ${breakEven ? "text-emerald-400" : "text-red-400"}`}>{roi >= 0 ? "+" : ""}{roi.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.pnl.requiredCapital", lang)}</span>
          <span className="font-bold font-mono">${margin.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  );
}


// Pip / Tick Value Calculator
function PipValueCalc() {
  const { lang, dir } = useLanguage();
  const [lotSize, setLotSize] = useState(1);
  const [price, setPrice] = useState(100);
  const [tickSize, setTickSize] = useState(0.01);

  const tickValue = lotSize * tickSize;
  const onePercentValue = lotSize * price * 0.01;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir={dir}>
      <div className="flex items-center gap-1.5">
        <Percent className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">{t("tools.pip.title", lang)}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("tools.pip.desc", lang)}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.pip.posSize", lang)}</label>
          <Input type="number" value={lotSize} onChange={(e) => setLotSize(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.pip.currentPrice", lang)}</label>
          <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.pip.tickSize", lang)}</label>
          <Input type="number" step="0.01" value={tickSize} onChange={(e) => setTickSize(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.pip.oneTickValue", lang)}</span>
          <span className="font-bold font-mono">${tickValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.pip.onePctValue", lang)}</span>
          <span className="font-bold font-mono">${onePercentValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}


// Compound / Daily Target Calculator
function CompoundCalc() {
  const { lang, dir } = useLanguage();
  const [start, setStart] = useState(10000);
  const [targetPct, setTargetPct] = useState(1);
  const [days, setDays] = useState(30);
  const [riskPerTrade, setRiskPerTrade] = useState(2);
  const [winRate, setWinRate] = useState(50);
  const [rr, setRr] = useState(2);

  // Expected value per trade (R)
  const ev = (winRate / 100) * rr - (1 - winRate / 100) * 1;
  const expectedReturn = (start * riskPerTrade / 100) * ev * days;
  const final = start + expectedReturn;
  const dailyTarget = start * (targetPct / 100);
  const breakevenRate = (1 / (1 + rr)) * 100;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir={dir}>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">{t("tools.compound.title", lang)}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("tools.compound.desc", lang)}</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.compound.startCapital", lang)}</label>
          <Input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.compound.dailyTargetPct", lang)}</label>
          <Input type="number" value={targetPct} onChange={(e) => setTargetPct(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.compound.days", lang)}</label>
          <Input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.compound.riskPerTrade", lang)}</label>
          <Input type="number" value={riskPerTrade} onChange={(e) => setRiskPerTrade(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">{t("tools.compound.winRate", lang)}</label>
          <Input type="number" value={winRate} onChange={(e) => setWinRate(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">R:R</label>
          <Input type="number" step="0.1" value={rr} onChange={(e) => setRr(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.compound.dailyTarget", lang)}</span>
          <span className="font-bold font-mono">${dailyTarget.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.compound.evPerTrade", lang)}</span>
          <span className={`font-bold font-mono ${ev >= 0 ? "text-emerald-400" : "text-red-400"}`}>{ev.toFixed(2)}R</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.compound.expectedResult", lang)}</span>
          <span className={`font-bold font-mono ${expectedReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>{expectedReturn >= 0 ? "+" : ""}${expectedReturn.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.compound.finalCapital", lang)}</span>
          <span className={`font-bold font-mono ${final >= start ? "text-emerald-400" : "text-red-400"}`}>${final.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{t("tools.compound.minWin", lang)}</span>
          <span className="font-bold font-mono text-primary">{breakevenRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}


// Main page
export default function ToolsPage() {
  const { lang, dir } = useLanguage();
  return (
    <div className="p-4 md:p-6 space-y-5" dir={dir}>
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-black tracking-tight">{t("tools.title", lang)}</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("tools.subtitle", lang)}
      </p>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <PositionSizeCalc />
        <RiskRewardCalc />
        <PnlCalc />
        <PipValueCalc />
        <CompoundCalc />
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 flex flex-col justify-center items-center gap-2 text-center opacity-70">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {t("tools.comingSoon", lang)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("tools.comingSoonSub", lang)}
          </p>
        </div>
      </div>
    </div>
  );
}
