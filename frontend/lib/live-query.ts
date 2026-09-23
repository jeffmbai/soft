/** Default polling interval for high-churn views (open pool, notifications). */
export const LIVE_QUERY_MS = 30_000;

/** Polling interval for schedule views (lower churn). */
export const SCHEDULE_QUERY_MS = 60_000;

/** TanStack Query options for near-real-time data without WebSockets. */
export function liveQueryOptions(intervalMs: number = LIVE_QUERY_MS) {
  return {
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  } as const;
}
