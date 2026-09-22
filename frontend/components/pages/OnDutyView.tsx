"use client";

import { useState } from "react";
import {
  AlertBanner,
  Avatar,
  Badge,
  Card,
  CardHeader,
  Chip,
  Icon,
  PageHeader,
  SegmentedControl,
  Timeline,
  type TimelineItem,
} from "@/components/ui";

const locationCards = [
  {
    name: "Unit Alpha",
    region: "West Region • Floor A",
    tz: "PT",
    clockedIn: 8,
    status: "1 Tardy (+15m)",
    statusType: "error" as const,
    badge: "Rush Prep: 42m",
    note: "Target capacity: 140",
  },
  {
    name: "Unit Beta",
    region: "West Region • Station B",
    tz: "PT",
    clockedIn: 4,
    status: "All On-Duty & Cleared",
    statusType: "ok" as const,
    badge: "Service Steady",
    note: "Labor Cost: 22.4%",
  },
  {
    name: "Unit Gamma",
    region: "East Region • Main Hall",
    tz: "ET",
    clockedIn: 6,
    status: "Shift Changeover: 18m",
    statusType: "neutral" as const,
    badge: "Night Line Coming In",
    note: "Peak: In Progress",
  },
];

const stations = [
  {
    name: "Front Station",
    status: "OPTIMAL COVERAGE",
    capacity: "82%",
    seats: "18 / 22 Occupied",
    staff: [
      { initials: "SA", name: "Staff A", role: "Lead", detail: "Clocked in 15:58 • Rail A" },
      { initials: "SB", name: "Staff B", role: "Associate", detail: "Clocked in 16:02 • Rail B" },
    ],
  },
  {
    name: "Back Station (BOH)",
    status: "PRE-RUSH LINEUP",
    capacity: "2/3 Stationed",
    seats: "Grill / Prep / Sauté",
    staff: [
      { initials: "SC", name: "Staff C", role: "Head", detail: "Clocked in 15:45 • Hot Line" },
      { initials: "SD", name: "Staff D", role: "Prep", detail: "Clocked in 16:10 • Cold Prep" },
    ],
    gap: true,
  },
];

const timelineItems: TimelineItem[] = [
  { time: "16:00", label: "Evening shift start", tone: "ok" },
  { time: "16:15", label: "Staff E tardy (+15m)", tone: "warn" },
  { time: "16:42", label: "Call-out: Host role", tone: "error" },
  { time: "17:30", label: "Dinner service begins", tone: "neutral" },
];

const statusIcon = { error: "warning", ok: "check_circle", neutral: "sync" } as const;
const statusColor = { error: "text-error", ok: "text-secondary", neutral: "text-on-surface-variant" } as const;

export default function OnDutyView() {
  const [stationFilter, setStationFilter] = useState("all");

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <PageHeader
          title="Live Floor & Duty Monitor"
          description="Real-time station assignments, clock-in status, and coverage across all units."
        />
        <Badge variant="live" className="mt-2 flex items-center gap-2 w-fit">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
          </span>
          Live: 18 On-Duty
        </Badge>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {locationCards.map((loc) => (
          <Card key={loc.name} accent="secondary" hover>
            <div className="flex items-center justify-between mb-space-xs">
              <div className="flex items-center gap-1.5">
                <Icon name="storefront" size={18} className="text-secondary" />
                <h3 className="font-title-sm text-title-sm text-primary">{loc.name}</h3>
              </div>
              <Badge variant="default" mono>{loc.tz} UNIT</Badge>
            </div>
            <p className="font-data-mono text-data-mono text-on-surface-variant text-[11px] mb-space-sm">{loc.region}</p>
            <div className="flex items-center justify-between border-t border-outline-variant pt-space-xs">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline-lg text-headline-lg font-bold text-primary">{loc.clockedIn}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">Clocked In</span>
                </div>
                <div className={`flex items-center gap-1 mt-0.5 font-label-md text-label-md ${statusColor[loc.statusType]}`}>
                  <Icon name={statusIcon[loc.statusType]} size={14} />
                  <span>{loc.status}</span>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={loc.statusType === "error" ? "error" : "default"} mono>
                  {loc.badge}
                </Badge>
                <p className="font-data-mono text-data-mono text-on-surface-variant text-[11px] mt-1">{loc.note}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <AlertBanner
        variant="warning"
        icon="notification_important"
        badge="Critical Call-Out"
        meta="Incident #4082 • 8 mins ago"
        title="Urgent call-out: Host role at Unit Alpha — 1 hour before rush"
        description="Scheduled staff reported illness. 118 reservations starting at 17:30."
        actions={[
          { label: "Quick-Call Standby (2)", variant: "outline" },
          { label: "Broadcast Shift", variant: "danger" },
        ]}
      />

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
        <div className="xl:col-span-2 flex flex-col gap-space-md">
          <Card>
            <CardHeader
              title="Unit Alpha: Station Assignment Matrix"
              subtitle="Live assignments and duty roster status"
              icon={<Icon name="table_restaurant" size={20} />}
              action={
                <SegmentedControl
                  options={[
                    { id: "all", label: "All" },
                    { id: "foh", label: "FOH" },
                    { id: "boh", label: "BOH" },
                    { id: "bar", label: "Bar" },
                  ]}
                  value={stationFilter}
                  onChange={setStationFilter}
                  size="sm"
                  className="hidden sm:inline-flex"
                />
              }
            />
          </Card>

          {stations.map((station) => (
            <Card key={station.name}>
              <div className="flex items-center justify-between mb-space-sm pb-space-xs border-b border-surface-container">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                  <h3 className="font-title-sm text-title-sm text-primary">{station.name}</h3>
                  <Badge variant="live" mono className="font-bold">{station.status}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-data-mono text-data-mono text-on-surface-variant text-[11px]">{station.seats}</span>
                  <span className="font-data-mono text-data-mono text-secondary font-bold">{station.capacity}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                {station.staff.map((person) => (
                  <div
                    key={person.initials}
                    className="p-space-sm rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-space-sm">
                      <Avatar initials={person.initials} size="md" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-label-md text-label-md font-bold text-primary">{person.name}</h4>
                          <Chip className="text-[10px]">{person.role}</Chip>
                        </div>
                        <p className="font-data-mono text-data-mono text-[11px] text-on-surface-variant">{person.detail}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" mono>Active</Badge>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-on-surface-variant">
                        <Icon name="location_on" size={13} className="text-secondary" />
                        <span className="font-data-mono text-data-mono">Verified</span>
                      </div>
                    </div>
                  </div>
                ))}
                {station.gap && (
                  <div className="p-space-sm rounded-lg border border-dashed border-error bg-error-container/20 flex items-center justify-center gap-2">
                    <Icon name="person_add" size={18} className="text-error" />
                    <span className="font-label-md text-label-md text-error font-semibold">Open Slot — Coverage Gap</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-space-md">
          <h2 className="font-headline-md text-headline-md text-primary">Shift Timeline</h2>
          <Card>
            <Timeline items={timelineItems} />
          </Card>
        </div>
      </section>
    </div>
  );
}
