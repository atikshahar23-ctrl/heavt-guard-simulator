import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, NotebookPen, Target, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  loadPlans, upsertPlan, deletePlan,
  type ResearchPlan, type PlanStatus, type AssetKind,
} from "@/lib/research-store";
import type { ResearchStrings } from "@/lib/research-i18n";

export interface JournalPrefill {
  symbol: string;
  name: string;
  kind: AssetKind;
  nonce: number;
}

const STATUS_STYLE: Record<PlanStatus, string> = {
  watching: "bg-secondary/50 text-muted-foreground border-border",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

interface Draft {
  id?: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  note: string;
  plan: string;
  target: string;
  status: PlanStatus;
}

const EMPTY: Draft = { symbol: "", name: "", kind: "stock", note: "", plan: "", target: "", status: "watching" };

export function ResearchJournal({ t, prefill }: { t: ResearchStrings; prefill?: JournalPrefill | null }) {
  const [plans, setPlans] = useState<ResearchPlan[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);

  useEffect(() => { setPlans(loadPlans()); }, []);

  useEffect(() => {
    if (prefill && prefill.symbol) {
      setEditing({ ...EMPTY, symbol: prefill.symbol, name: prefill.name, kind: prefill.kind });
    }
  }, [prefill]);

  const statusLabel: Record<PlanStatus, string> = {
    watching: t.statusWatching,
    active: t.statusActive,
    closed: t.statusClosed,
  };

  function startNew() { setEditing({ ...EMPTY }); }

  function startEdit(p: ResearchPlan) {
    setEditing({ id: p.id, symbol: p.symbol, name: p.name, kind: p.kind, note: p.note, plan: p.plan, target: p.target, status: p.status });
  }

  function save() {
    if (!editing || !editing.symbol.trim()) return;
    const next = upsertPlan({
      id: editing.id,
      symbol: editing.symbol.trim().toUpperCase(),
      name: editing.name.trim(),
      kind: editing.kind,
      note: editing.note.trim(),
      plan: editing.plan.trim(),
      target: editing.target.trim(),
      status: editing.status,
    });
    setPlans(next);
    setEditing(null);
  }

  function remove(id: string) { setPlans(deletePlan(id)); }

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString(t.dir === "rtl" ? "he-IL" : "en-US", { day: "numeric", month: "short" });
  }

  return (
    <section className="space-y-3" dir={t.dir}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-primary" /> {t.journalTitle}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t.journalSubtitle}</p>
        </div>
        {!editing && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> {t.newPlan}
          </button>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <div className="uhnw-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {editing.id ? t.editPlan : t.newPlan}
            </span>
            <button onClick={() => setEditing(null)} aria-label={t.cancel} className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t.symbol}</label>
              <Input value={editing.symbol} onChange={(e) => setEditing({ ...editing, symbol: e.target.value })} className="mt-1 h-9 bg-background/60 font-mono text-sm" dir="ltr" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t.assetName}</label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1 h-9 bg-background/60 text-sm" dir={t.dir} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t.notes}</label>
            <textarea
              value={editing.note}
              onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              placeholder={t.notesPlaceholder}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-y"
              dir={t.dir}
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t.plan}</label>
            <textarea
              value={editing.plan}
              onChange={(e) => setEditing({ ...editing, plan: e.target.value })}
              placeholder={t.planPlaceholder}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-y"
              dir={t.dir}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t.target}</label>
              <Input value={editing.target} onChange={(e) => setEditing({ ...editing, target: e.target.value })} placeholder={t.targetPlaceholder} className="mt-1 h-9 bg-background/60 font-mono text-sm" dir={t.dir} />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t.status}</label>
              <div className="mt-1 flex gap-1">
                {(["watching", "active", "closed"] as PlanStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setEditing({ ...editing, status: st })}
                    className={`flex-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors ${
                      editing.status === st ? STATUS_STYLE[st] : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {statusLabel[st]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={!editing.symbol.trim()}
              className="flex-1 rounded-md bg-primary text-primary-foreground font-bold text-sm py-2 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.save}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-md border border-border px-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {plans.length === 0 && !editing ? (
        <div className="rounded-lg border border-border bg-secondary/20 p-6 text-center">
          <NotebookPen className="h-7 w-7 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mt-2">{t.emptyJournal}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-foreground" dir="ltr">{p.symbol}</span>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </div>
                  {p.name && <div className="text-xs text-muted-foreground truncate">{p.name}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(p)} className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-primary transition-colors" aria-label={t.edit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-red-400 transition-colors" aria-label={t.delete}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {p.target && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-foreground/90">{p.target}</span>
                </div>
              )}
              {p.note && (
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">{t.notes}</div>
                  <p className="text-xs text-foreground/85 whitespace-pre-wrap leading-snug">{p.note}</p>
                </div>
              )}
              {p.plan && (
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">{t.plan}</div>
                  <p className="text-xs text-foreground/85 whitespace-pre-wrap leading-snug">{p.plan}</p>
                </div>
              )}
              <div className="text-[9px] font-mono text-muted-foreground/60 pt-1 border-t border-border/40">
                {t.updated} {fmtDate(p.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
