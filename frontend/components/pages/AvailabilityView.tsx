"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import Loading from "@/components/Loading";
import {
  fetchMyAvailability,
  updateMyAvailability,
  type AvailabilityWindowInput,
} from "@/lib/api";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AvailabilityView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-availability"], queryFn: fetchMyAvailability });
  const [windows, setWindows] = useState<AvailabilityWindowInput[] | null>(null);
  const [timezone, setTimezone] = useState("America/Los_Angeles");

  const activeWindows = windows ?? data?.windows ?? [];

  const save = useMutation({
    mutationFn: () =>
      updateMyAvailability({
        timezone: data?.timezone ?? timezone,
        windows: activeWindows,
        exceptions: data?.exceptions ?? [],
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-availability"] }),
  });

  if (isLoading) return <Loading variant="inline" message="Loading availability…" />;

  const toggleDay = (day: number) => {
    const exists = activeWindows.find((w) => w.day_of_week === day);
    if (exists) {
      setWindows(activeWindows.filter((w) => w.day_of_week !== day));
    } else {
      setWindows([
        ...activeWindows,
        { day_of_week: day, start_time: "09:00", end_time: "17:00" },
      ]);
    }
  };

  return (
    <div className="flex flex-col gap-space-lg max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Availability" description={`Timezone: ${data?.timezone ?? timezone}`} />
        <Button variant="primary" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      <Card className="space-y-3">
        <p className="text-sm text-on-surface-variant">Toggle days you are available (default 9:00–17:00).</p>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, i) => {
            const on = activeWindows.some((w) => w.day_of_week === i);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(i)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  on ? "bg-secondary text-on-secondary border-secondary" : "border-outline-variant text-on-surface-variant"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
