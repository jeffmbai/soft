"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Avatar, Badge, Button, Card, PageHeader } from "@/components/ui";
import Loading from "@/components/Loading";
import {
  fetchLocationsOverview,
  fetchManagers,
  setLocationManagers,
  type LocationOverview,
} from "@/lib/api";
import { initials } from "@/lib/staff-utils";
import { cn } from "@/lib/cn";

function tzLabel(timezone: string) {
  return timezone.split("/").pop()?.replace("_", " ") ?? timezone;
}

function LocationCard({
  location,
  allManagers,
  onSaved,
}: {
  location: LocationOverview;
  allManagers: { id: string; name: string; email: string }[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(location.managers.map((m) => m.id));

  const save = useMutation({
    mutationFn: () => setLocationManagers(location.id, selected),
    onSuccess: () => {
      onSaved();
      setEditing(false);
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-headline-md text-headline-md font-bold text-primary">{location.name}</h2>
        <p className="text-sm text-on-surface-variant mt-1">{location.address}</p>
        <Badge variant="secondary" className="mt-2">{tzLabel(location.timezone)}</Badge>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-data-mono text-[10px] uppercase tracking-wider text-outline">
            Assigned managers
          </p>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => { setSelected(location.managers.map((m) => m.id)); setEditing(true); }}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <ul className="space-y-2">
            {allManagers.map((mgr) => {
              const on = selected.includes(mgr.id);
              return (
                <li key={mgr.id}>
                  <button
                    type="button"
                    onClick={() => toggle(mgr.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-xl border text-left transition-colors",
                      on
                        ? "border-secondary bg-secondary/8"
                        : "border-outline-variant hover:border-secondary/40",
                    )}
                  >
                    <Avatar initials={initials(mgr.name)} size="sm" variant="secondary" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-primary truncate">{mgr.name}</div>
                      <div className="text-xs text-on-surface-variant truncate">{mgr.email}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : location.managers.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No manager assigned</p>
        ) : (
          <ul className="space-y-2">
            {location.managers.map((mgr) => (
              <li
                key={mgr.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-outline-variant bg-surface-container-low"
              >
                <Avatar initials={initials(mgr.name)} size="sm" variant="secondary" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-primary truncate">{mgr.name}</div>
                  <div className="text-xs text-on-surface-variant truncate">{mgr.email}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default function LocationsView() {
  const qc = useQueryClient();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations-overview"],
    queryFn: fetchLocationsOverview,
  });
  const { data: managers = [] } = useQuery({
    queryKey: ["managers"],
    queryFn: fetchManagers,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["locations-overview"] });
  };

  if (isLoading) return <Loading variant="inline" message="Loading locations…" />;

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <PageHeader
        title="Locations"
        description="Assign managers to locations. Managers only see schedules for their assigned sites."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {locations.map((loc) => (
          <LocationCard
            key={loc.id}
            location={loc}
            allManagers={managers}
            onSaved={invalidate}
          />
        ))}
      </div>
    </div>
  );
}
