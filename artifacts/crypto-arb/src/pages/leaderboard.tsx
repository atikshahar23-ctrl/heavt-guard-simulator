import { Crown, Trophy, Medal, RefreshCw, ShieldCheck } from "lucide-react";
import {
  useGetLeaderboard,
  getGetLeaderboardQueryKey,
  type LeaderboardEntry,
} from "@workspace/api-client-react";

function usd(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function rankAccent(rank: number): string {
  if (rank === 1) return "#cdbfa4"; // champagne gold
  if (rank === 2) return "#cfd9e3"; // platinum
  if (rank === 3) return "#b08d57"; // bronze
  return "#9fb4c7";
}

function RankBadge({ rank }: { rank: number }) {
  const color = rankAccent(rank);
  if (rank <= 3) {
    const Icon = rank === 1 ? Crown : rank === 2 ? Trophy : Medal;
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: `${color}55`, background: `${color}14`, color }}
      >
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#9fb4c7]/20 bg-white/[0.02] font-mono text-xs font-bold text-[#9fb4c7]/80">
      {rank}
    </span>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const color = rankAccent(entry.rank);
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
        entry.isSelf
          ? "border-[#cdbfa4]/45 bg-[#cdbfa4]/[0.06]"
          : "border-[#9fb4c7]/15 bg-white/[0.015] hover:bg-white/[0.03]"
      }`}
    >
      <RankBadge rank={entry.rank} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[#e6edf4]">
            {entry.displayName}
          </span>
          {entry.isSelf && (
            <span className="shrink-0 rounded-full border border-[#cdbfa4]/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#cdbfa4]">
              את/ה
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9fb4c7]/55">
          דירוג #{entry.rank}
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div
          className="font-mono text-base font-black tabular-nums"
          style={{ color }}
        >
          ${usd(entry.walletValue)}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#9fb4c7]/45">
          שווי תיק
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useGetLeaderboard({
    query: { queryKey: getGetLeaderboardQueryKey(), refetchInterval: 60_000 },
  });

  const entries = data?.entries ?? [];
  const self = data?.self ?? null;
  const selfInTop = entries.some((e) => e.isSelf);

  return (
    <div dir="rtl" className="relative min-h-screen p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="h-5 w-5 text-[#cdbfa4]" strokeWidth={1.6} />
            <h1
              className="text-2xl font-semibold tracking-[0.06em] text-[#e6edf4]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              מיטב הסוחרים
            </h1>
          </div>
          <p className="text-xs text-[#9fb4c7]/70">
            עשרת הסוחרים המובילים לפי שווי התיק הפעיל — דמו לימודי בלבד.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#9fb4c7]/25 bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9fb4c7] transition-colors hover:bg-[#9fb4c7]/10"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          רענון
        </button>
      </div>

      {/* Educational disclaimer */}
      <div className="flex items-center gap-2 rounded-md border border-[#9fb4c7]/15 bg-white/[0.015] px-3 py-2 text-[10px] text-[#9fb4c7]/65">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#9fb4c7]/70" />
        הדירוג מבוסס על מסחר נייר לסימולציה והדגמה בלבד — ללא כסף אמיתי וללא הבטחת תשואה.
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-lg border border-[#9fb4c7]/10 bg-white/[0.02]"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-[#9fb4c7]/15 bg-white/[0.015] p-8 text-center text-sm text-[#9fb4c7]/70">
          לא ניתן לטעון את הדירוג כעת. נסו לרענן בעוד רגע.
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-[#9fb4c7]/15 bg-white/[0.015] p-8 text-center text-sm text-[#9fb4c7]/70">
          עדיין אין סוחרים בדירוג. התחילו לסחור כדי להופיע כאן.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Row key={e.rank} entry={e} />
          ))}

          {/* Caller's own standing when outside the top 10. */}
          {!selfInTop && self && (
            <>
              <div className="flex items-center gap-2 px-1 pt-2">
                <span className="h-px flex-1 bg-[#9fb4c7]/15" />
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#9fb4c7]/45">
                  הדירוג שלך
                </span>
                <span className="h-px flex-1 bg-[#9fb4c7]/15" />
              </div>
              <Row entry={self} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
