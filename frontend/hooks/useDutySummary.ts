"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDutySummary } from "@/lib/api";
import { liveQueryOptions } from "@/lib/live-query";

export function useDutySummary(enabled: boolean) {
  return useQuery({
    queryKey: ["duty-summary"],
    queryFn: fetchDutySummary,
    enabled,
    ...liveQueryOptions(),
  });
}
