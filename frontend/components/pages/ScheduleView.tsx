"use client";

import { useState } from "react";
import {
  AlertBanner,
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  SegmentedControl,
} from "@/components/ui";
import { cn } from "@/lib/cn";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dates = ["Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 25", "Oct 26"];
const todayIndex = 3;

type ShiftCard = {
  initials: string;
  name: string;
  time: string;
  station: string;
  conflict?: boolean;
  empty?: boolean;
};

const bartenderRow: ShiftCard[] = [
  { initials: "SA", name: "Staff A", time: "16:00 - 00:00", station: "Main Bar" },
  { initials: "SB", name: "Staff B", time: "16:30 - 00:30", station: "Lounge" },
  { initials: "SC", name: "Staff C", time: "18:00 - 23:00", station: "Unit Alpha", conflict: true },
  { initials: "SA", name: "Staff A", time: "16:00 - 00:00", station: "Main Bar" },
  { initials: "SB", name: "Staff B", time: "17:00 - 01:00", station: "Lounge" },
  { initials: "SB", name: "Staff B", time: "17:00 - 01:00", station: "Lead" },
  { empty: true, initials: "", name: "", time: "", station: "" },
];

function ShiftCell({ shift }: { shift: ShiftCard }) {
  if (shift.empty) {
    return (
      <div className="p-2 rounded border border-dashed border-outline-variant bg-surface-container-low flex flex-col items-center justify-center text-center py-4 hover:border-secondary transition-colors cursor-pointer">
        <Icon name="add" size={18} className="text-outline" />
        <span className="font-label-md text-[11px] text-on-surface-variant">Slot Available</span>
      </div>
    );
  }

  if (shift.conflict) {
    return (
      <div className="p-2 rounded bg-error-container border-2 border-error border-l-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Avatar initials={shift.initials} size="xs" variant="error" />
            <span className="font-label-md text-label-md font-bold text-error">{shift.name}</span>
          </div>
          <Icon name="crisis_alert" size={16} className="text-error animate-pulse" />
        </div>
        <div className="font-data-mono text-data-mono text-error font-bold text-[11px] mt-1">{shift.time}</div>
        <Badge variant="error" mono className="mt-1 text-[9px] uppercase font-extrabold rounded">
          DUAL BOOK: Unit Alpha + Unit Beta
        </Badge>
      </div>
    );
  }

  return (
    <div className="p-2 rounded bg-surface border border-outline-variant border-l-[3px] border-l-secondary shadow-sm hover:border-secondary transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar initials={shift.initials} size="xs" variant="secondary" className="rounded-full bg-secondary-fixed text-on-secondary-fixed" />
          <span className="font-label-md text-label-md font-semibold text-primary">{shift.name}</span>
        </div>
        <Icon name="check_circle" size={15} className="text-secondary" />
      </div>
      <div className="font-data-mono text-data-mono text-on-surface-variant text-[11px] mt-1">{shift.time}</div>
      <div className="text-[10px] text-outline">{shift.station}</div>
    </div>
  );
}

export default function ScheduleView() {
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <Card className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center bg-surface-container rounded border border-outline-variant p-0.5">
            <button type="button" className="p-1.5 hover:bg-surface-container-lowest rounded text-primary">
              <Icon name="chevron_left" size={20} />
            </button>
            <button type="button" className="p-1.5 hover:bg-surface-container-lowest rounded text-primary">
              <Icon name="chevron_right" size={20} />
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
              Week of Oct 20 – 26, 2024
            </h1>
            <Badge variant="default" mono>Q4 • Dinner Rotation</Badge>
          </div>
          <Button variant="outline" size="sm">Today</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Role:"
            options={[
              { id: "all", label: "All" },
              { id: "a", label: "Role A" },
              { id: "b", label: "Role B" },
              { id: "c", label: "Role C" },
            ]}
            value={roleFilter}
            onChange={setRoleFilter}
          />
          <SegmentedControl
            label="Status:"
            options={[
              { id: "all", label: "All" },
              { id: "conflict", label: "Conflict (1)", dot: true },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </Card>

      <AlertBanner
        variant="error"
        icon="warning"
        title="DOUBLE-BOOKING: Staff C scheduled at Unit Alpha and Unit Beta (18:00 - 23:00)"
        description="Staff cannot be assigned to two locations at the same time. Auto-replacement recommended."
        actions={[
          { label: "Resolve Conflict", variant: "outline" },
          { label: "Auto-Rebalance", variant: "danger" },
        ]}
      />

      <Card padding={false} className="overflow-x-auto">
        <div className="grid grid-cols-[200px_repeat(7,1fr)] min-w-[900px] border-b border-outline-variant bg-surface-container-low">
          <div className="p-space-md border-r border-outline-variant flex flex-col justify-end">
            <span className="font-badge-mono text-badge-mono text-outline uppercase tracking-wider">Station & Quota</span>
            <span className="font-title-sm text-title-sm text-primary font-bold">Role Headcount</span>
          </div>
          {days.map((day, i) => (
            <div
              key={day}
              className={cn(
                "p-space-sm text-center border-r border-outline-variant last:border-r-0",
                i === todayIndex && "bg-secondary-fixed/20",
              )}
            >
              <span className={cn("font-label-md text-label-md uppercase block", i === todayIndex ? "text-secondary font-bold" : "text-outline")}>
                {i === todayIndex ? `${day} (Today)` : day}
              </span>
              <span className={cn("font-headline-md text-headline-md font-bold", i === todayIndex ? "text-secondary font-extrabold" : "text-primary")}>
                {dates[i]}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[200px_repeat(7,1fr)] min-w-[900px] border-b border-outline-variant divide-x divide-outline-variant min-h-[140px]">
          <div className="p-space-md bg-surface-container-lowest flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <span className="font-title-sm text-title-sm font-bold text-primary">Role A</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] mt-1">
                Headcount: <span className="font-semibold text-primary">2 per shift</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 font-badge-mono text-badge-mono text-outline">
              <Icon name="local_bar" size={14} />
              <span>Front Station</span>
            </div>
          </div>
          {bartenderRow.map((shift, i) => (
            <div key={i} className={cn("p-2 flex flex-col gap-2", i === todayIndex && "bg-secondary-fixed/10")}>
              <ShiftCell shift={shift} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[200px_repeat(7,1fr)] min-w-[900px] border-b border-outline-variant divide-x divide-outline-variant min-h-[120px]">
          <div className="p-space-md bg-surface-container-lowest flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-on-tertiary-container" />
                <span className="font-title-sm text-title-sm font-bold text-primary">Role B</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] mt-1">
                Headcount: <span className="font-semibold text-primary">4 needed</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 font-badge-mono text-badge-mono text-outline">
              <Icon name="skillet" size={14} />
              <span>Back Station</span>
            </div>
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-2 flex flex-col gap-1.5">
              {i < 5 ? (
                <div className="p-2 rounded bg-surface border border-outline-variant border-l-[3px] border-l-tertiary-fixed-dim shadow-sm">
                  <div className="flex items-center gap-1">
                    <Avatar initials="SD" size="xs" className="bg-primary-fixed text-primary rounded-full" />
                    <span className="font-label-md text-label-md font-semibold text-primary text-[12px]">Staff D</span>
                  </div>
                  <div className="font-data-mono text-data-mono text-on-surface-variant text-[11px] mt-1">14:00 - 22:00</div>
                </div>
              ) : (
                <ShiftCell shift={{ empty: true, initials: "", name: "", time: "", station: "" }} />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
