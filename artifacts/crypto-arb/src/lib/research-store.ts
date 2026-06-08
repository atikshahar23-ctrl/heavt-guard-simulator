export type PlanStatus = "watching" | "active" | "closed";
export type AssetKind = "stock" | "crypto";

export interface ResearchPlan {
  id: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  note: string;
  plan: string;
  target: string;
  status: PlanStatus;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  query: string;
  ts: number;
}

const HISTORY_KEY = "arb_research_history";
const JOURNAL_KEY = "arb_research_journal";
const LANG_KEY = "arb_research_lang";
const HISTORY_CAP = 14;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

/* ── Search history ── */

export function loadHistory(): HistoryEntry[] {
  const list = read<HistoryEntry[]>(HISTORY_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(
    (h): h is HistoryEntry =>
      !!h && typeof h.query === "string" && h.query.trim().length > 0 && typeof h.ts === "number" && isFinite(h.ts),
  );
}

export function pushHistory(query: string): HistoryEntry[] {
  const q = query.trim();
  if (!q) return loadHistory();
  const existing = loadHistory().filter((h) => h.query.toLowerCase() !== q.toLowerCase());
  const next = [{ query: q, ts: Date.now() }, ...existing].slice(0, HISTORY_CAP);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  write(HISTORY_KEY, []);
  return [];
}

/* ── Research journal (notes + plan + tracking) ── */

const STATUSES: PlanStatus[] = ["watching", "active", "closed"];
const KINDS: AssetKind[] = ["stock", "crypto"];

function sanitizePlan(p: unknown): ResearchPlan | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.symbol !== "string" || !o.symbol.trim()) return null;
  const now = Date.now();
  const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : now);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    id: o.id,
    symbol: o.symbol,
    name: str(o.name),
    kind: KINDS.includes(o.kind as AssetKind) ? (o.kind as AssetKind) : "stock",
    note: str(o.note),
    plan: str(o.plan),
    target: str(o.target),
    status: STATUSES.includes(o.status as PlanStatus) ? (o.status as PlanStatus) : "watching",
    createdAt: num(o.createdAt),
    updatedAt: num(o.updatedAt),
  };
}

export function loadPlans(): ResearchPlan[] {
  const list = read<unknown[]>(JOURNAL_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .map(sanitizePlan)
    .filter((p): p is ResearchPlan => p !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function savePlans(plans: ResearchPlan[]): void {
  write(JOURNAL_KEY, plans);
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertPlan(
  input: Omit<ResearchPlan, "id" | "createdAt" | "updatedAt"> & { id?: string },
): ResearchPlan[] {
  const plans = loadPlans();
  const now = Date.now();
  if (input.id) {
    const next = plans.map((p) =>
      p.id === input.id ? { ...p, ...input, id: p.id, createdAt: p.createdAt, updatedAt: now } : p,
    );
    savePlans(next);
    return next.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const created: ResearchPlan = {
    id: makeId(),
    symbol: input.symbol,
    name: input.name,
    kind: input.kind,
    note: input.note,
    plan: input.plan,
    target: input.target,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  const next = [created, ...plans];
  savePlans(next);
  return next;
}

export function deletePlan(id: string): ResearchPlan[] {
  const next = loadPlans().filter((p) => p.id !== id);
  savePlans(next);
  return next;
}

/* ── Language preference (he/en) ── */

export type Lang = "he" | "en";

export function loadLang(): Lang {
  const v = read<Lang>(LANG_KEY, "he");
  return v === "en" ? "en" : "he";
}

export function saveLang(lang: Lang): void {
  write(LANG_KEY, lang);
}
