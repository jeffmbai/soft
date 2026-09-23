"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Loading from "@/components/Loading";
import {
  Badge,
  Button,
  Card,
  FilterBar,
  Icon,
  PageHeader,
  SegmentedControl,
  Timeline,
} from "@/components/ui";
import { exportAuditCsv, fetchAuditLogs, fetchLocations } from "@/lib/api";
import { formatAuditEntry, formatAuditTime } from "@/lib/audit-format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/providers/AuthProvider";
import { toastApiError, toastSuccess } from "@/lib/toast";

const ENTITY_TYPES = [
  { id: "all", label: "All events" },
  { id: "shift", label: "Shifts" },
  { id: "assignment", label: "Assignments" },
  { id: "swap_request", label: "Swaps" },
  { id: "schedule_week", label: "Publish" },
] as const;

type EntityFilter = (typeof ENTITY_TYPES)[number]["id"];

const ENTITY_BADGE: Record<string, "live" | "warning" | "default" | "secondary"> = {
  shift: "default",
  assignment: "live",
  swap_request: "warning",
  schedule_week: "secondary",
};

export default function AuditLogView() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState("");
  const [entityType, setEntityType] = useState<EntityFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const queryParams = useMemo(
    () => ({
      location_id: locationId || undefined,
      entity_type: entityType === "all" ? undefined : entityType,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit: 150,
    }),
    [locationId, entityType, dateFrom, dateTo],
  );

  const { data: entries = [], isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: () => fetchAuditLogs(queryParams),
    refetchInterval: 60_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const entry of entries) {
      const day = new Date(entry.created_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const list = map.get(day) ?? [];
      list.push(entry);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [entries]);

  async function handleExport() {
    if (user?.role !== "admin") return;
    setExporting(true);
    try {
      const blob = await exportAuditCsv(queryParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-log.csv";
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess("Export complete", "Audit log CSV downloaded.");
    } catch (err) {
      toastApiError(err, "Could not export audit log");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <PageHeader
          title="Audit log"
          description="Cross-location activity — shifts, assignments, swaps, and publish events"
        />
        {user?.role === "admin" && (
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void handleExport()}>
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        )}
      </div>

      <FilterBar
        filters={[
          {
            id: "location",
            label: "Location",
            value: locationId,
            onChange: setLocationId,
            options: [
              { value: "", label: "All locations" },
              ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
            ],
          },
        ]}
      />

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="audit-from" className="block text-xs text-on-surface-variant mb-1">
            From date
          </label>
          <input
            id="audit-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-xs text-on-surface-variant mb-1">
            To date
          </label>
          <input
            id="audit-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>

      <SegmentedControl
        size="sm"
        value={entityType}
        onChange={(v) => setEntityType(v as EntityFilter)}
        options={[...ENTITY_TYPES]}
      />

      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        {isFetching && !isLoading && <Icon name="sync" size={14} className="animate-spin" />}
        <span>
          {entries.length} event{entries.length === 1 ? "" : "s"}
          {locationId ? ` · ${locations.find((l) => l.id === locationId)?.name}` : " · all sites"}
        </span>
      </div>

      {isLoading ? (
        <Loading variant="inline" message="Loading audit log…" />
      ) : entries.length === 0 ? (
        <Card className="text-center py-12">
          <Icon name="history" size={32} className="text-outline mx-auto mb-3" />
          <p className="text-on-surface-variant text-sm">No audit events match your filters.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEntries]) => (
            <Card key={day} className="space-y-4">
              <h2 className="font-label-md text-label-md font-semibold text-on-surface-variant">{day}</h2>
              <ul className="divide-y divide-outline-variant">
                {dayEntries.map((entry) => {
                  const { label, detail, tone } = formatAuditEntry(entry);
                  return (
                    <li key={entry.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                      <span className="font-data-mono text-data-mono text-outline text-xs shrink-0 sm:w-36">
                        {formatAuditTime(entry.created_at)}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                        <Badge variant={ENTITY_BADGE[entry.entity_type] ?? "default"}>
                          {entry.entity_type.replace(/_/g, " ")}
                        </Badge>
                        {entry.location_name && (
                          <span className="text-xs text-on-surface-variant">{entry.location_name}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-primary">{label}</p>
                        {detail && (
                          <p className="text-xs text-on-surface-variant truncate">{detail}</p>
                        )}
                        {entry.actor_name && (
                          <p className="text-xs text-outline">by {entry.actor_name}</p>
                        )}
                      </div>
                      {entry.shift_id && (
                        <Link
                          href="/schedule"
                          className={cn(
                            "shrink-0 inline-flex items-center gap-1 text-xs text-secondary font-medium hover:underline",
                          )}
                        >
                          <Icon name="open_in_new" size={14} />
                          Shift
                        </Link>
                      )}
                      <span
                        className={cn(
                          "hidden sm:block w-2 h-2 rounded-full shrink-0 mt-2",
                          tone === "ok" && "bg-secondary",
                          tone === "warn" && "bg-amber-500",
                          tone === "error" && "bg-error",
                          tone === "neutral" && "bg-outline",
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="p-4 border-b border-outline-variant">
            <h2 className="font-headline-md font-bold text-primary">Timeline view</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Most recent 20 events</p>
          </div>
          <div className="p-4">
            <Timeline
              items={entries.slice(0, 20).map((entry) => {
                const { label, detail, tone } = formatAuditEntry(entry);
                const text = [
                  entry.location_name,
                  label,
                  detail,
                  entry.actor_name ? `— ${entry.actor_name}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return {
                  id: entry.id,
                  time: new Date(entry.created_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                  label: text,
                  tone,
                };
              })}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
