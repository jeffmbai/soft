"use client";

import { useQuery } from "@tanstack/react-query";
import Loading from "@/components/Loading";
import { Timeline } from "@/components/ui";
import { fetchShiftHistory } from "@/lib/api";
import { formatAuditEntry, formatAuditTime } from "@/lib/audit-format";

type Props = {
  shiftId: string;
  timezone?: string;
};

export default function ShiftHistoryPanel({ shiftId, timezone }: Props) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["shift-history", shiftId],
    queryFn: () => fetchShiftHistory(shiftId),
    enabled: !!shiftId,
  });

  if (isLoading) {
    return <Loading variant="inline" message="Loading history…" />;
  }

  if (!entries.length) {
    return (
      <p className="text-sm text-on-surface-variant py-4 text-center">
        No audit history for this shift yet.
      </p>
    );
  }

  const items = entries.map((entry) => {
    const { label, detail, tone } = formatAuditEntry(entry);
    const text = detail ? `${label} — ${detail}` : label;
    return {
      id: entry.id,
      time: formatAuditTime(entry.created_at, timezone),
      label: text,
      tone,
    };
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant">
        {entries.length} event{entries.length === 1 ? "" : "s"} · newest first
      </p>
      <Timeline items={items} />
    </div>
  );
}
