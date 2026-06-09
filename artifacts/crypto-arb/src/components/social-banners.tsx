import { useState } from "react";
import {
  Gift,
  Users,
  Copy,
  Check,
  Sparkles,
  Share2,
  MessageCircle,
  Send,
} from "lucide-react";
import {
  useGetDailyReward,
  getGetDailyRewardQueryKey,
  useClaimDailyReward,
  useGetReferral,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocial } from "@/contexts/social-context";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

/** Daily login reward — claim once per Israel day; bonus lands as a deposit. */
function DailyRewardCard() {
  const queryClient = useQueryClient();
  const { drainCredits } = useSocial();
  const { data, isLoading } = useGetDailyReward({
    query: { queryKey: getGetDailyRewardQueryKey(), refetchInterval: 5 * 60_000 },
  });
  const claim = useClaimDailyReward();
  const { lang, dir } = useLanguage();

  if (isLoading || !data) return null;

  const amount = data.amount;
  const claimable = data.claimable && !claim.isPending;

  const onClaim = async () => {
    try {
      const res = await claim.mutateAsync();
      await queryClient.invalidateQueries({
        queryKey: getGetDailyRewardQueryKey(),
      });
      if (res.claimed) {
        await drainCredits();
        toast({
          title: t("sb.rewardAdded", lang),
          description: t("sb.rewardAddedDesc", lang).replace("{amount}", `$${amount.toLocaleString()}`),
        });
      } else {
        toast({
          title: t("sb.alreadyClaimedTitle", lang),
          description: t("sb.alreadyClaimedDesc", lang),
        });
      }
    } catch {
      toast({ title: t("sb.error", lang), description: t("sb.claimFailDesc", lang) });
    }
  };

  return (
    <div
      dir={dir}
      className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-[#cdbfa4]/30 bg-[#cdbfa4]/[0.05] p-4"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#cdbfa4]/40 bg-[#cdbfa4]/10 text-[#cdbfa4]">
        <Gift className="h-5 w-5" strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#e6edf4]">
          {t("sb.dailyRewardTitle", lang).replace("{amount}", `$${amount.toLocaleString()}`)}
        </div>
        <div className="text-[11px] text-[#9fb4c7]/70">
          {data.claimable
            ? t("sb.rewardWaiting", lang)
            : t("sb.claimedToday", lang)}
        </div>
      </div>
      <button
        disabled={!claimable}
        onClick={onClaim}
        className={`shrink-0 rounded-md px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] transition-all ${
          claimable
            ? "bg-gradient-to-r from-[#e7d9bd] via-[#cdbfa4] to-[#a98f63] text-[#0b0f14] hover:brightness-110"
            : "cursor-not-allowed border border-[#9fb4c7]/20 bg-white/[0.02] text-[#9fb4c7]/40"
        }`}
      >
        {claim.isPending ? t("sb.claiming", lang) : data.claimable ? t("sb.claim", lang) : t("sb.claimed", lang)}
      </button>
    </div>
  );
}

/** Referral card — share link, both sides get a one-time bonus. */
function ReferralCard() {
  const { data } = useGetReferral();
  const [copied, setCopied] = useState(false);
  const { lang, dir } = useLanguage();

  if (!data) return null;

  const shareMessage = t("sb.shareMessage", lang).replace("{link}", data.link);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      toast({
        title: t("sb.linkCopied", lang),
        description: t("sb.linkCopiedDesc", lang),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t("sb.error", lang), description: t("sb.copyFailDesc", lang) });
    }
  };

  const onNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await onCopy();
      return;
    }
    try {
      await navigator.share({
        title: t("sb.shareTitle", lang),
        text: shareMessage,
        url: data.link,
      });
    } catch {
      // user dismissed the share sheet — no-op
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(
    data.link,
  )}&text=${encodeURIComponent(shareMessage)}`;

  return (
    <div
      dir={dir}
      className="relative flex flex-col gap-3 overflow-hidden rounded-lg border border-[#9fb4c7]/25 bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#9fb4c7]/30 bg-[#9fb4c7]/10 text-[#9fb4c7]">
          <Users className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#e6edf4]">{t("sb.inviteFriends", lang)}</div>
          <div className="text-[11px] text-[#9fb4c7]/70">
            {t("sb.inviteDesc", lang)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate rounded-md border border-[#9fb4c7]/20 bg-black/30 px-3 py-2 font-mono text-[11px] text-[#9fb4c7]/85">
          {data.link}
        </div>
        <button
          onClick={onCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#9fb4c7]/25 bg-[#9fb4c7]/[0.06] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#9fb4c7] transition-colors hover:bg-[#9fb4c7]/15"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t("sb.copied", lang) : t("sb.copy", lang)}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#25d366]/30 bg-[#25d366]/[0.08] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#25d366] transition-colors hover:bg-[#25d366]/15"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {t("sb.whatsapp", lang)}
        </a>
        <a
          href={telegramHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#2aabee]/30 bg-[#2aabee]/[0.08] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#2aabee] transition-colors hover:bg-[#2aabee]/15"
        >
          <Send className="h-3.5 w-3.5" />
          {t("sb.telegram", lang)}
        </a>
        {canNativeShare && (
          <button
            onClick={onNativeShare}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#9fb4c7]/25 bg-[#9fb4c7]/[0.06] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#9fb4c7] transition-colors hover:bg-[#9fb4c7]/15"
          >
            <Share2 className="h-3.5 w-3.5" />
            {t("sb.share", lang)}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#cdbfa4]/80">
        <Sparkles className="h-3 w-3" />
        {t("sb.code", lang)}: {data.code} · {t("sb.successfulInvites", lang)}: {data.referralCount}
      </div>
    </div>
  );
}

/** Daily reward + referral, shown together near the top of the dashboard. */
export function SocialBanners() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <DailyRewardCard />
      <ReferralCard />
    </div>
  );
}
