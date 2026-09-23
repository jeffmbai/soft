"use client";

import { Badge, Card, CardHeader } from "@/components/ui";
import type { FairnessReport } from "@/lib/fairness-metrics";
import { cn } from "@/lib/cn";

type Props = {
  report: FairnessReport;
  locationLabel?: string;
};

export default function FairnessPanel({ report, locationLabel }: Props) {
  const scoreTone =
    report.score >= 80 ? "text-secondary" : report.score >= 60 ? "text-warning" : "text-error";

  return (
    <Card className="space-y-4">
      <CardHeader
        title="Schedule fairness"
        subtitle={
          locationLabel
            ? `${locationLabel} · Fri/Sat evening premium shifts`
            : "Fri/Sat evening premium shift distribution"
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-container-low px-4 py-3 text-center">
          <p className="text-[10px] uppercase text-outline font-data-mono">Fairness score</p>
          <p className={cn("font-headline-md text-headline-md font-bold mt-1", scoreTone)}>
            {report.score}%
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low px-4 py-3 text-center">
          <p className="text-[10px] uppercase text-outline font-data-mono">Premium slots filled</p>
          <p className="font-headline-md text-headline-md font-bold text-primary mt-1">
            {report.totalPremiumSlots}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low px-4 py-3 text-center">
          <p className="text-[10px] uppercase text-outline font-data-mono">Staff on premium</p>
          <p className="font-headline-md text-headline-md font-bold text-primary mt-1">
            {report.staffRows.filter((r) => r.premiumShifts > 0).length}
          </p>
        </div>
      </div>

      {report.staffRows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No staff data for this location.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-outline border-b border-outline-variant">
                <th className="pb-2 pr-3 font-medium">Staff</th>
                <th className="pb-2 pr-3 font-medium">Hours</th>
                <th className="pb-2 pr-3 font-medium">Premium</th>
                <th className="pb-2 pr-3 font-medium">vs desired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {report.staffRows.slice(0, 8).map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3 font-data-mono">{row.totalHours.toFixed(1)}h</td>
                  <td className="py-2 pr-3">
                    <Badge variant={row.premiumShifts === 0 ? "warning" : "live"}>
                      {row.premiumShifts} shift{row.premiumShifts === 1 ? "" : "s"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 font-data-mono">
                    {row.desiredHours > 0 ? (
                      <span className={row.hoursDelta > 2 ? "text-warning" : row.hoursDelta < -2 ? "text-secondary" : ""}>
                        {row.hoursDelta >= 0 ? "+" : ""}
                        {row.hoursDelta.toFixed(0)}h
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(report.underScheduled.length > 0 || report.overScheduled.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          {report.underScheduled.length > 0 && (
            <p className="text-on-surface-variant">
              Under-scheduled: {report.underScheduled.map((r) => r.name).join(", ")}
            </p>
          )}
          {report.overScheduled.length > 0 && (
            <p className="text-on-surface-variant">
              Over-scheduled: {report.overScheduled.map((r) => r.name).join(", ")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
