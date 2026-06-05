import { useState, useRef, useEffect } from "react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, intensityProfile } from "@/contexts/autotrader-context";
import {
  Wallet as WalletIcon, ChevronDown, Plus, Check, Pencil, Trash2, X,
} from "lucide-react";

const GEAR_COLORS = [
  "text-sky-400 border-sky-400/40 bg-sky-400/10",
  "text-teal-400 border-teal-400/40 bg-teal-400/10",
  "text-primary border-primary/40 bg-primary/10",
  "text-orange-400 border-orange-400/40 bg-orange-400/10",
  "text-red-400 border-red-400/40 bg-red-400/10",
];

function fmtUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Wallet selector with inline create / rename / delete. Each wallet is a fully
 * isolated paper-trading account; switching swaps the entire portfolio view.
 * `compact` renders a smaller trigger for the mobile header.
 */
export function WalletSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    wallets, activeWalletId, activeWalletName,
    createWallet, renameWallet, deleteWallet, switchWallet,
  } = usePortfolio();
  const { settings, baseIntensity } = useAutoTrader();

  function walletGear(walletId: string) {
    const level = settings.intensityByWallet[walletId] ?? baseIntensity;
    return intensityProfile(level);
  }

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
        setErr(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function doCreate() {
    const e = createWallet(newName);
    if (e) { setErr(e); return; }
    setNewName("");
    setCreating(false);
    setErr(null);
  }

  function doRename(id: string) {
    const e = renameWallet(id, editName);
    if (e) { setErr(e); return; }
    setEditingId(null);
    setErr(null);
  }

  function doDelete(id: string, name: string) {
    if (!confirm(`למחוק את הארנק "${name}"? כל הפוזיציות וההיסטוריה שלו יימחקו.`)) return;
    const e = deleteWallet(id);
    if (e) setErr(e);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 transition-colors ${
          compact ? "px-2 py-1" : "px-3 py-1.5"
        }`}
        title="החלפת ארנק"
      >
        <WalletIcon className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className={`font-mono font-bold text-primary truncate ${compact ? "text-[11px] max-w-[90px]" : "text-xs max-w-[140px]"}`}>
          {activeWalletName}
        </span>
        <ChevronDown className={`h-3 w-3 text-primary/70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 w-72 right-0 rounded-xl border border-primary/25 bg-card p-2 space-y-1"
          style={{ boxShadow: "0 0 40px hsl(32 84% 55% / 0.15)" }}
        >
          <div className="px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            הארנקים שלי ({wallets.length})
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {wallets.map((w) => {
              const isActive = w.id === activeWalletId;
              if (editingId === w.id) {
                return (
                  <div key={w.id} className="flex items-center gap-1 px-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") doRename(w.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 h-8 rounded-md bg-secondary/40 border border-border px-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50"
                    />
                    <button onClick={() => doRename(w.id)} className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/10" title="שמירה">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded text-muted-foreground hover:bg-secondary/40" title="ביטול">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }
              const gear = walletGear(w.id);
              const gearColor = GEAR_COLORS[gear.level - 1];
              return (
                <div
                  key={w.id}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                    isActive ? "bg-primary/15 border border-primary/30" : "hover:bg-secondary/30 border border-transparent"
                  }`}
                >
                  <button
                    onClick={() => { switchWallet(w.id); setOpen(false); }}
                    className="flex-1 flex items-center gap-2 min-w-0 text-right"
                  >
                    <span className={`shrink-0 ${isActive ? "text-primary" : "text-transparent"}`}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-xs font-mono font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                        {w.name}
                      </span>
                      <span className="block text-[10px] font-mono text-muted-foreground">
                        {fmtUsd(w.cash)} · {w.openPositions} פוזיציות
                      </span>
                    </span>
                    <span
                      className={`shrink-0 inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-mono font-bold leading-none ${gearColor}`}
                      title={`עוצמה: ${gear.label}`}
                    >
                      {gear.level} {gear.label}
                    </span>
                  </button>
                  <button
                    onClick={() => { setEditingId(w.id); setEditName(w.name); setErr(null); }}
                    className="p-1 rounded text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    title="שינוי שם"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {wallets.length > 1 && (
                    <button
                      onClick={() => doDelete(w.id, w.name)}
                      className="p-1 rounded text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="מחיקה"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="h-px bg-border my-1" />

          {creating ? (
            <div className="flex items-center gap-1 px-1">
              <input
                autoFocus
                placeholder="שם הארנק החדש"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doCreate(); if (e.key === "Escape") { setCreating(false); setErr(null); } }}
                className="flex-1 h-8 rounded-md bg-secondary/40 border border-border px-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
              <button onClick={doCreate} className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/10" title="יצירה">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setCreating(false); setErr(null); }} className="p-1.5 rounded text-muted-foreground hover:bg-secondary/40" title="ביטול">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setCreating(true); setNewName(""); setErr(null); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-primary/30 text-primary hover:bg-primary/10 transition-colors text-xs font-mono font-bold"
            >
              <Plus className="h-3.5 w-3.5" /> ארנק חדש
            </button>
          )}

          {err && <p className="px-2 pt-1 text-[10px] text-red-400 font-mono">{err}</p>}
        </div>
      )}
    </div>
  );
}
