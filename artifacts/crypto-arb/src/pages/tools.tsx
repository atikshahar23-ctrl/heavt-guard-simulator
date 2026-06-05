import { useState } from "react";
import {
  Calculator, ArrowRightLeft, Target, TrendingUp,
  Scale, Percent, DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";


// Position Size Calculator
function PositionSizeCalc() {
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
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir="rtl">
      <div className="flex items-center gap-1.5">
        <Scale className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">מחשבון גודל פוזיציה</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">חשב כמה להזין כדי להגן על סכום הסיכון שהגדרת.</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">הון הסוחר ($)</label>
          <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">סיכון באחוז (%)</label>
          <Input type="number" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר כניסה ($)</label>
          <Input type="number" value={entry} onChange={(e) => setEntry(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר סטופ ($)</label>
          <Input type="number" value={sl} onChange={(e) => setSl(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מינוף (×)</label>
          <Input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => setAssetType("crypto")} className={`text-[10px] px-2 py-1 rounded border ${assetType === "crypto" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>קריפטו</button>
          <button onClick={() => setAssetType("stock")} className={`text-[10px] px-2 py-1 rounded border ${assetType === "stock" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>מניות</button>
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">סיכון מוגדר (הפסד מוריד)</span>
          <span className="font-bold font-mono">${riskAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">גודל {assetType === "crypto" ? "פוזיציה" : "מניות"}</span>
          <span className="font-bold font-mono">{positionSize.toLocaleString("en-US", { maximumFractionDigits: assetType === "crypto" ? 4 : 2 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">שווי פוזיציה</span>
          <span className="font-bold font-mono">${notional.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">מארג'ין דרוש</span>
          <span className="font-bold font-mono">${margin.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">R בודד</span>
          <span className="font-bold font-mono">{rMultiple.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}


// Risk / Reward Calculator
function RiskRewardCalc() {
  const [entry, setEntry] = useState(100);
  const [sl, setSl] = useState(95);
  const [tp, setTp] = useState(110);
  const [leverage, setLeverage] = useState(1);
  const [dir, setDir] = useState<"LONG" | "SHORT">("LONG");

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  const rr = risk > 0 ? reward / risk : 0;
  const winPct = rr > 0 ? 1 / (1 + rr) : 0;
  const slPct = entry > 0 ? (risk / entry) * 100 : 0;
  const tpPct = entry > 0 ? (reward / entry) * 100 : 0;
  const slPctLev = slPct * leverage;
  const tpPctLev = tpPct * leverage;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir="rtl">
      <div className="flex items-center gap-1.5">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">מחשבון סיכון / סיכוי</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">בדוק לפני שאתה נכנס: האם התוכנית שווה את הסיכון?</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">כיוון</label>
          <div className="flex gap-1">
            <button onClick={() => setDir("LONG")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dir === "LONG" ? "border-emerald-500 text-emerald-400" : "border-border text-muted-foreground"}`}>לונג</button>
            <button onClick={() => setDir("SHORT")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dir === "SHORT" ? "border-red-500 text-red-400" : "border-border text-muted-foreground"}`}>שורט</button>
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר כניסה</label>
          <Input type="number" value={entry} onChange={(e) => setEntry(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר סטופ</label>
          <Input type="number" value={sl} onChange={(e) => setSl(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר יעד</label>
          <Input type="number" value={tp} onChange={(e) => setTp(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מינוף (×)</label>
          <Input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">סיכון (מחיר היחסי)</span>
          <span className="font-bold font-mono">${risk.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">סיכוי (מחיר היחסי)</span>
          <span className="font-bold font-mono">${reward.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">R:R</span>
          <span className="font-bold font-mono text-primary">1:{rr.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">% סטופ בלא מינוף</span>
          <span className="font-bold font-mono text-red-400">-{slPct.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">% תוואה בלא מינוף</span>
          <span className="font-bold font-mono text-emerald-400">+{tpPct.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">% סטופ עם מינוף</span>
          <span className="font-bold font-mono text-red-400">-{slPctLev.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">% תוואה עם מינוף</span>
          <span className="font-bold font-mono text-emerald-400">+{tpPctLev.toFixed(2)}%</span>
        </div>
        <div className="border-t border-border/40 pt-1 mt-1 flex justify-between text-[10px]">
          <span className="text-muted-foreground">אחוז הצלחה המינימאלי הדרוש</span>
          <span className="font-bold font-mono">{winPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}


// P&L Calculator
function PnlCalc() {
  const [entry, setEntry] = useState(100);
  const [exit, setExit] = useState(110);
  const [qty, setQty] = useState(100);
  const [leverage, setLeverage] = useState(1);
  const [dir, setDir] = useState<"LONG" | "SHORT">("LONG");

  const priceDiff = exit - entry;
  const pnl = dir === "LONG" ? priceDiff * qty * leverage : -priceDiff * qty * leverage;
  const margin = entry * qty;
  const roi = margin > 0 ? (pnl / margin) * 100 : 0;
  const breakEven = roi >= 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir="rtl">
      <div className="flex items-center gap-1.5">
        <DollarSign className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">מחשבון רווח / הפסד</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">הזן עם איזה הייתה עם התוצאות המקויימים.</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">כיוון</label>
          <div className="flex gap-1">
            <button onClick={() => setDir("LONG")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dir === "LONG" ? "border-emerald-500 text-emerald-400" : "border-border text-muted-foreground"}`}>לונג</button>
            <button onClick={() => setDir("SHORT")} className={`text-[10px] px-2 py-1 rounded border flex-1 ${dir === "SHORT" ? "border-red-500 text-red-400" : "border-border text-muted-foreground"}`}>שורט</button>
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר כניסה</label>
          <Input type="number" value={entry} onChange={(e) => setEntry(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר יציאה</label>
          <Input type="number" value={exit} onChange={(e) => setExit(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">כמות</label>
          <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מינוף (×)</label>
          <Input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">R/P גולי</span>
          <span className={`font-bold font-mono ${breakEven ? "text-emerald-400" : "text-red-400"}`}>{pnl >= 0 ? "+" : ""}${pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">ROI על ההון</span>
          <span className={`font-bold font-mono ${breakEven ? "text-emerald-400" : "text-red-400"}`}>{roi >= 0 ? "+" : ""}{roi.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">הון נדרש</span>
          <span className="font-bold font-mono">${margin.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  );
}


// Pip / Tick Value Calculator
function PipValueCalc() {
  const [lotSize, setLotSize] = useState(1);
  const [price, setPrice] = useState(100);
  const [tickSize, setTickSize] = useState(0.01);

  const tickValue = lotSize * tickSize;
  const onePercentValue = lotSize * price * 0.01;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir="rtl">
      <div className="flex items-center gap-1.5">
        <Percent className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">מחשבון שווי טיק</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">בדוק כמה שווה כל תזוזה מחיר באוניה שלך.</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">גודל פוזיציה</label>
          <Input type="number" value={lotSize} onChange={(e) => setLotSize(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מחיר נוכחי</label>
          <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">גודל טיק (מחיר מינימום)</label>
          <Input type="number" step="0.01" value={tickSize} onChange={(e) => setTickSize(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">שווי טיק אחד</span>
          <span className="font-bold font-mono">${tickValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">שווי 1% תזוזה</span>
          <span className="font-bold font-mono">${onePercentValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}


// Compound / Daily Target Calculator
function CompoundCalc() {
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
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3" dir="rtl">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">תחזית תשואה ויום ימי</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">חינוכי בלבד — החישוב הוא סביב בלבד. בוא הגידול האמיתי הוא בהבדל בין היגונה והיזוז.</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">הון התחלה</label>
          <Input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">% יעד יומי</label>
          <Input type="number" value={targetPct} onChange={(e) => setTargetPct(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">מספר ימים</label>
          <Input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">% סיכון לעסקה</label>
          <Input type="number" value={riskPerTrade} onChange={(e) => setRiskPerTrade(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">אחוז הצלחה (%)</label>
          <Input type="number" value={winRate} onChange={(e) => setWinRate(Number(e.target.value))} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">R:R</label>
          <Input type="number" step="0.1" value={rr} onChange={(e) => setRr(Number(e.target.value))} className="h-7 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">יעד יומי (הון × %)</span>
          <span className="font-bold font-mono">${dailyTarget.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">EV לאוטו (באד האיטה ב-R)</span>
          <span className={`font-bold font-mono ${ev >= 0 ? "text-emerald-400" : "text-red-400"}`}>{ev.toFixed(2)}R</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">תוצאה חזויה (לא גארוטייה)</span>
          <span className={`font-bold font-mono ${expectedReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>{expectedReturn >= 0 ? "+" : ""}${expectedReturn.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">הון סופי (חזוי)</span>
          <span className={`font-bold font-mono ${final >= start ? "text-emerald-400" : "text-red-400"}`}>${final.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">אחוז הצלחה המינימאלי דרוש</span>
          <span className="font-bold font-mono text-primary">{breakevenRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}


// Main page
export default function ToolsPage() {
  return (
    <div className="p-4 md:p-6 space-y-5" dir="rtl">
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-black tracking-tight">כלי סחור</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        כל המחשבונים האלה מיועדים לשוק האמיתי — הובה אותם לחינוכיה והדמיה בלבד.
        אין כאן ייעוץ השקעות או הבטחת תשואות.
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
            כלים נוספים בדרך …
          </p>
          <p className="text-[10px] text-muted-foreground">
            מחשבונים נוספים יובאו בהמשך הדרך.
          </p>
        </div>
      </div>
    </div>
  );
}
