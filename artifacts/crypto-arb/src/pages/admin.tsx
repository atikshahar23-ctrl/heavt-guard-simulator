import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  Pencil,
  Check,
  X,
  Wallet as WalletIcon,
  Bot,
  Crown,
} from "lucide-react";
import {
  useAdminMe,
  useAdminUsers,
  getAdminUsersQueryKey,
  useAdminUserState,
  getAdminUserStateQueryKey,
  useAdminRename,
  getGetLeaderboardQueryKey,
  type AdminUser,
} from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";

function usd(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function usdSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pnlColor(n: number): string {
  if (n > 0) return "#7fd1a6";
  if (n < 0) return "#e08a8a";
  return "#9fb4c7";
}

function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A pair like "3 / 10" reorders visually in RTL — pin it to LTR. */
function Pair({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" className="inline-block tabular-nums">
      {children}
    </span>
  );
}

// ── Defensive parsers for the opaque client-owned state blobs ──────────────

interface ParsedClosedTrade {
  pnl?: number;
}
interface ParsedWallet {
  id?: string;
  name?: string;
  cash?: number;
  totalDeposited?: number;
  polyPositions?: unknown[];
  binancePositions?: unknown[];
  stockPositions?: unknown[];
  fundingPositions?: unknown[];
  optionPositions?: unknown[];
  tradeHistory?: ParsedClosedTrade[];
}
interface ParsedWalletsBlob {
  wallets?: ParsedWallet[];
  activeWalletId?: string;
}
interface ParsedBotStat {
  trades?: number;
  wins?: number;
  losses?: number;
  netPnl?: number;
  edge?: number;
}
interface ParsedTraderBlob {
  enabled?: boolean;
  intensity?: number;
  tradeMode?: string;
  masterArmed?: boolean;
  autoPilotEnabled?: boolean;
  botStats?: Record<string, ParsedBotStat>;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function openPositions(w: ParsedWallet): number {
  return (
    (w.polyPositions?.length ?? 0) +
    (w.binancePositions?.length ?? 0) +
    (w.stockPositions?.length ?? 0) +
    (w.fundingPositions?.length ?? 0) +
    (w.optionPositions?.length ?? 0)
  );
}

function walletRealized(w: ParsedWallet): { net: number; wins: number; total: number } {
  const trades = w.tradeHistory ?? [];
  let net = 0;
  let wins = 0;
  for (const tr of trades) {
    const pnl = typeof tr.pnl === "number" ? tr.pnl : 0;
    net += pnl;
    if (pnl > 0) wins += 1;
  }
  return { net, wins, total: trades.length };
}

// ── Inline name editor ─────────────────────────────────────────────────────

function NameEditor({ user, lang }: { user: AdminUser; lang: Lang }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const rename = useAdminRename();

  const startEdit = () => {
    setValue(user.displayNameOverride ?? user.displayName ?? "");
    setEditing(true);
  };

  const submit = (next: string) => {
    rename.mutate(
      { data: { userId: user.userId, displayName: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminUsersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          setEditing(false);
        },
      },
    );
  };

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold text-[#e6edf4]">
          {user.effectiveName}
        </span>
        {user.displayNameOverride && (
          <span className="shrink-0 rounded-full border border-[#cdbfa4]/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#cdbfa4]">
            {t("admin.overrideBadge", lang)}
          </span>
        )}
        <button
          onClick={startEdit}
          title={t("admin.edit", lang)}
          className="shrink-0 rounded-md border border-[#9fb4c7]/25 p-1 text-[#9fb4c7] transition-colors hover:bg-[#9fb4c7]/10"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <input
        autoFocus
        value={value}
        maxLength={40}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(value);
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={t("admin.namePlaceholder", lang)}
        className="min-w-0 flex-1 rounded-md border border-[#9fb4c7]/30 bg-white/[0.03] px-2 py-1 text-sm text-[#e6edf4] outline-none focus:border-[#cdbfa4]/60"
      />
      <button
        onClick={() => submit(value)}
        disabled={rename.isPending}
        title={t("admin.save", lang)}
        className="shrink-0 rounded-md border border-[#7fd1a6]/40 p-1 text-[#7fd1a6] transition-colors hover:bg-[#7fd1a6]/10 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => submit("")}
        disabled={rename.isPending}
        title={t("admin.clear", lang)}
        className="shrink-0 rounded-md border border-[#9fb4c7]/30 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#9fb4c7] transition-colors hover:bg-[#9fb4c7]/10 disabled:opacity-50"
      >
        {t("admin.clear", lang)}
      </button>
      <button
        onClick={() => setEditing(false)}
        disabled={rename.isPending}
        title={t("admin.cancel", lang)}
        className="shrink-0 rounded-md border border-[#e08a8a]/40 p-1 text-[#e08a8a] transition-colors hover:bg-[#e08a8a]/10 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {rename.isError && (
        <span className="w-full font-mono text-[10px] text-[#e08a8a]">
          {t("admin.renameError", lang)}
        </span>
      )}
    </div>
  );
}

// ── Per-user expandable detail (lazily fetches state blobs) ─────────────────

function StatBox({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-lg border border-[#9fb4c7]/12 bg-white/[0.015] px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#9fb4c7]/50">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function UserDetail({ userId, lang }: { userId: string; lang: Lang }) {
  const { data, isLoading, isError } = useAdminUserState(userId, {
    query: { queryKey: getAdminUserStateQueryKey(userId) },
  });

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center text-sm text-[#9fb4c7]/70">
        {t("admin.loadingState", lang)}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="px-4 py-6 text-center text-sm text-[#e08a8a]">
        {t("admin.stateError", lang)}
      </div>
    );
  }

  const walletsBlob = (data?.wallets ?? null) as ParsedWalletsBlob | null;
  const traderBlob = (data?.autotrader ?? null) as ParsedTraderBlob | null;
  const wallets = Array.isArray(walletsBlob?.wallets) ? walletsBlob!.wallets! : [];
  const activeId = walletsBlob?.activeWalletId;
  const botStats = asRecord(traderBlob?.botStats) as Record<string, ParsedBotStat> | null;
  const botEntries = botStats ? Object.entries(botStats) : [];

  if (wallets.length === 0 && !traderBlob) {
    return (
      <div className="px-4 py-6 text-center text-sm text-[#9fb4c7]/60">
        {t("admin.noState", lang)}
      </div>
    );
  }

  return (
    <div className="space-y-5 border-t border-[#9fb4c7]/12 bg-black/20 px-4 py-4">
      {/* Wallets */}
      {wallets.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <WalletIcon className="h-3.5 w-3.5 text-[#9fb4c7]" />
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9fb4c7]/80">
              {t("admin.walletsTitle", lang)}
            </h3>
          </div>
          <div className="space-y-3">
            {wallets.map((w, i) => {
              const realized = walletRealized(w);
              return (
                <div
                  key={w.id ?? i}
                  className="rounded-lg border border-[#9fb4c7]/15 bg-white/[0.015] p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#e6edf4]">
                      {w.name ?? `#${i + 1}`}
                    </span>
                    {activeId && w.id === activeId && (
                      <span className="rounded-full border border-[#cdbfa4]/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[#cdbfa4]">
                        {t("admin.activeWallet", lang)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <StatBox label={t("admin.walletCash", lang)} value={`$${usd(w.cash ?? 0)}`} />
                    <StatBox
                      label={t("admin.walletDeposited", lang)}
                      value={`$${usd(w.totalDeposited ?? 0)}`}
                    />
                    <StatBox
                      label={t("admin.walletRealized", lang)}
                      value={usdSigned(realized.net)}
                      color={pnlColor(realized.net)}
                    />
                    <StatBox label={t("admin.walletOpenPos", lang)} value={openPositions(w)} />
                    <StatBox label={t("admin.walletTrades", lang)} value={realized.total} />
                    <StatBox
                      label={t("admin.walletWinRate", lang)}
                      value={<Pair>{realized.wins} / {realized.total}</Pair>}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Auto-trader */}
      {traderBlob && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-[#9fb4c7]" />
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9fb4c7]/80">
              {t("admin.traderTitle", lang)}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <StatBox
              label={t("admin.traderStatus", lang)}
              value={traderBlob.enabled ? t("admin.traderOn", lang) : t("admin.traderOff", lang)}
              color={traderBlob.enabled ? "#7fd1a6" : "#9fb4c7"}
            />
            <StatBox
              label={t("admin.traderIntensity", lang)}
              value={typeof traderBlob.intensity === "number" ? traderBlob.intensity : "—"}
            />
            <StatBox label={t("admin.traderMode", lang)} value={traderBlob.tradeMode ?? "—"} />
            <StatBox
              label={t("admin.traderMaster", lang)}
              value={traderBlob.masterArmed ? t("admin.yes", lang) : t("admin.no", lang)}
            />
            <StatBox
              label={t("admin.traderAutopilot", lang)}
              value={traderBlob.autoPilotEnabled ? t("admin.yes", lang) : t("admin.no", lang)}
            />
          </div>

          {/* Bot performance table */}
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#9fb4c7]/12">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#9fb4c7]/12 font-mono text-[9px] uppercase tracking-[0.14em] text-[#9fb4c7]/55">
                  <th className="px-3 py-2 font-medium">{t("admin.botName", lang)}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("admin.botTrades", lang)}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("admin.botWins", lang)}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("admin.botLosses", lang)}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("admin.botNet", lang)}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("admin.botEdge", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {botEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-[#9fb4c7]/55">
                      {t("admin.noBots", lang)}
                    </td>
                  </tr>
                ) : (
                  botEntries.map(([botId, s]) => {
                    const net = typeof s.netPnl === "number" ? s.netPnl : 0;
                    return (
                      <tr key={botId} className="border-b border-[#9fb4c7]/8 last:border-0">
                        <td className="px-3 py-2 font-medium text-[#e6edf4]">{botId}</td>
                        <td className="px-3 py-2 text-end font-mono tabular-nums text-[#cdd6e0]">
                          {s.trades ?? 0}
                        </td>
                        <td className="px-3 py-2 text-end font-mono tabular-nums text-[#7fd1a6]">
                          {s.wins ?? 0}
                        </td>
                        <td className="px-3 py-2 text-end font-mono tabular-nums text-[#e08a8a]">
                          {s.losses ?? 0}
                        </td>
                        <td
                          className="px-3 py-2 text-end font-mono font-bold tabular-nums"
                          style={{ color: pnlColor(net) }}
                        >
                          {usdSigned(net)}
                        </td>
                        <td className="px-3 py-2 text-end font-mono tabular-nums text-[#cdd6e0]">
                          {typeof s.edge === "number" ? s.edge.toFixed(2) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ── User row ────────────────────────────────────────────────────────────────

function UserRow({ user, lang }: { user: AdminUser; lang: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-[#9fb4c7]/15 bg-white/[0.015]">
      <div className="flex items-center gap-3 px-3 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#9fb4c7]/20 bg-white/[0.02] font-mono text-xs font-bold text-[#9fb4c7]/80">
          {user.rank}
        </span>
        <div className="min-w-0 flex-1">
          <NameEditor user={user} lang={lang} />
          <div className="mt-0.5 truncate font-mono text-[10px] text-[#9fb4c7]/45">
            {user.userId}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <div className="font-mono text-base font-black tabular-nums text-[#cdd6e0]">
            ${usd(user.walletValue)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#9fb4c7]/45">
            {t("admin.colWallet", lang)}
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? t("admin.collapse", lang) : t("admin.expand", lang)}
          className="shrink-0 rounded-md border border-[#9fb4c7]/25 p-1.5 text-[#9fb4c7] transition-colors hover:bg-[#9fb4c7]/10"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && <UserDetail userId={user.userId} lang={lang} />}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { lang } = useLanguage();
  const me = useAdminMe();
  const usersQuery = useAdminUsers({
    query: {
      queryKey: getAdminUsersQueryKey(),
      enabled: me.data?.isAdmin === true,
    },
  });

  const dir = lang === "he" ? "rtl" : "ltr";

  if (me.isLoading) {
    return (
      <div dir={dir} className="flex min-h-dvh items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-[#9fb4c7]/70">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {t("admin.checking", lang)}
        </div>
      </div>
    );
  }

  if (me.isError || me.data?.isAdmin !== true) {
    return (
      <div dir={dir} className="flex min-h-dvh items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-[#9fb4c7]/15 bg-white/[0.015] px-8 py-10 text-center">
          <Shield className="h-8 w-8 text-[#e08a8a]/70" strokeWidth={1.5} />
          <p className="text-sm text-[#9fb4c7]/80">{t("admin.denied", lang)}</p>
        </div>
      </div>
    );
  }

  const users = usersQuery.data?.users ?? [];

  return (
    <div dir={dir} className="relative min-h-dvh max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Crown className="h-5 w-5 text-[#cdbfa4]" strokeWidth={1.6} />
            <h1
              className="text-2xl font-semibold tracking-[0.06em] text-[#e6edf4]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("admin.title", lang)}
            </h1>
          </div>
          <p className="max-w-xl text-xs text-[#9fb4c7]/70">{t("admin.subtitle", lang)}</p>
        </div>
        <button
          onClick={() => usersQuery.refetch()}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#9fb4c7]/25 bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9fb4c7] transition-colors hover:bg-[#9fb4c7]/10"
        >
          <RefreshCw className={`h-3 w-3 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
          {t("admin.refresh", lang)}
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-[#9fb4c7]/15 bg-white/[0.015] px-3 py-2 text-[10px] text-[#9fb4c7]/65">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#9fb4c7]/70" />
        {t("admin.usersCount", lang)}: <span className="font-mono font-bold text-[#cdd6e0]">{users.length}</span>
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[64px] animate-pulse rounded-lg border border-[#9fb4c7]/10 bg-white/[0.02]"
            />
          ))}
        </div>
      ) : usersQuery.isError ? (
        <div className="rounded-lg border border-[#9fb4c7]/15 bg-white/[0.015] p-8 text-center text-sm text-[#9fb4c7]/70">
          {t("admin.loadError", lang)}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-[#9fb4c7]/15 bg-white/[0.015] p-8 text-center text-sm text-[#9fb4c7]/70">
          {t("admin.empty", lang)}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow key={u.userId} user={u} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}
