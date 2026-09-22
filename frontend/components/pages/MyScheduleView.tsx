"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, PageHeader } from "@/components/ui";
import Loading from "@/components/Loading";
import { fetchMyShifts, formatShiftRange, mondayOfWeek, SKILL_LABELS } from "@/lib/api";

export default function MyScheduleView() {
  const week = mondayOfWeek();
  const { data: shifts, isLoading } = useQuery({
    queryKey: ["my-shifts", week],
    queryFn: () => fetchMyShifts(week),
  });

  if (isLoading) return <Loading variant="inline" message="Loading your schedule…" />;

  const totalHours = (shifts ?? []).reduce((acc, s) => {
    const h = (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000;
    return acc + h;
  }, 0);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader title="My Schedule" description={`Week of ${week} • ${totalHours.toFixed(1)}h scheduled`} />
      {!shifts?.length ? (
        <Card><p className="text-on-surface-variant">No published shifts this week.</p></Card>
      ) : (
        <div className="grid gap-3">
          {shifts.map((s) => (
            <Card key={s.assignment_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-title-sm font-bold text-primary">{s.location_name}</p>
                <p className="text-sm text-on-surface-variant">
                  {formatShiftRange(s.starts_at, s.ends_at, s.location_timezone)}
                </p>
              </div>
              <Badge variant="default">{SKILL_LABELS[s.required_skill]}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
