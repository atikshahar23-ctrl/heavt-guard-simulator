import { useMemo } from "react";
import { useGetMarketMovers, getGetMarketMoversQueryKey } from "@workspace/api-client-react";
import {
  buildCalendarEvents,
  eventsWithinDays,
  type CalendarEvent,
} from "@/lib/news-calendar-bot";
import type { Lang } from "@/lib/i18n";

export interface UseCalendarEventsResult {
  events: CalendarEvent[];
  /** Events from today through two days ahead. */
  upcoming: CalendarEvent[];
  isLoading: boolean;
  fetchedAt?: string;
  refetch: () => void;
}

/**
 * Builds the bot's calendar from the shared market-movers news feed. Reuses the
 * existing React Query cache key, so it never adds extra upstream fan-out.
 */
export function useCalendarEvents(lang: Lang = "he"): UseCalendarEventsResult {
  const { data, isLoading, refetch } = useGetMarketMovers({
    query: { queryKey: getGetMarketMoversQueryKey(), refetchInterval: 180000, staleTime: 120000 },
  });

  const news = data?.news;

  const events = useMemo(() => buildCalendarEvents(news, new Date(), lang), [news, lang]);
  const upcoming = useMemo(() => eventsWithinDays(events, new Date(), 2), [events]);

  return { events, upcoming, isLoading, fetchedAt: data?.fetchedAt, refetch: () => void refetch() };
}
