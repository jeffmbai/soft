"use client";

import { useState } from "react";
import {
  AlertBanner,
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  MetricsRow,
  PageHeader,
  SegmentedControl,
  StatCard,
} from "@/components/ui";

const metrics = [
  { label: "Unfilled Shifts", value: "2", tone: "error" as const },
  { label: "Awaiting Manager", value: "1", tone: "default" as const },
  { label: "Peer Swaps Open", value: "3", tone: "secondary" as const },
  { label: "Weekly OT Guard", value: "0.0h", tone: "muted" as const },
];

const unitPools = [
  { name: "Unit Alpha Floor", tz: "PT", open: 1, note: "100% Core Roles Covered", urgent: false },
  { name: "Unit Beta Kitchen", tz: "PT", open: 2, note: "1 Drop Pending Claim", urgent: true },
  { name: "Unit Gamma Hall", tz: "ET", open: 0, note: "Full Evening Coverage", urgent: false },
  { name: "Unit Delta Bistro", tz: "ET", open: 0, note: "Roster Locked for Tomorrow", urgent: false },
];

export default function OpenShiftsView() {
  const [requestFilter, setRequestFilter] = useState("all");

  return (
    <div className="flex flex-col gap-space-lg">
      <AlertBanner
        variant="warning"
        icon="lock_clock"
        title="Schedule Freeze & Cutoff Policy Active"
        badge="STRICT ENFORCEMENT"
        description="Shifts freeze 48h prior to start. Late swaps require manager override. Peer releases trigger expedited review."
        actions={[
          { label: "Override Code", variant: "outline" },
          { label: "View Labor Rules", variant: "primary" },
        ]}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <PageHeader
          title="Open Shifts Pool & Coverage Marketplace"
          description="Real-time swap requests, drop mitigation, and compliance checks across all units."
          badge={
            <Badge variant="live" mono className="border border-secondary">
              LIVE DISPATCH
            </Badge>
          }
        />
        <MetricsRow metrics={metrics} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
        <section className="xl:col-span-8 flex flex-col gap-space-md">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Icon name="sync_alt" size={20} className="text-secondary" />
              <h2 className="font-headline-md text-headline-md text-primary">Active Shift Swap & Drop Requests</h2>
            </div>
            <SegmentedControl
              label="Filter:"
              options={[
                { id: "all", label: "All (3)" },
                { id: "swaps", label: "Swaps" },
                { id: "drops", label: "Drops" },
                { id: "cancelled", label: "Cancelled" },
              ]}
              value={requestFilter}
              onChange={setRequestFilter}
              size="sm"
            />
          </div>

          <Card>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" mono className="bg-primary text-on-primary rounded">SWAP-REQ #842</Badge>
                <Badge variant="warning">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                  Awaiting Manager Approval
                </Badge>
                <span className="font-data-mono text-data-mono text-outline">Staff B accepted 14m ago</span>
              </div>
              <div className="flex items-center gap-1 font-data-mono text-data-mono text-on-surface-variant">
                <Icon name="verified_user" size={16} className="text-secondary" />
                Both compliant, 0 OT risk, rest window 14h
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center py-4">
              {[
                { initials: "SA", name: "Staff A", role: "Role A • Unit Alpha", tag: "Giving Up", shift: "Sat Oct 25 • 18:00 - 01:00", detail: "7.0h Scheduled • Main Station", claim: false },
                null,
                { initials: "SB", name: "Staff B", role: "Role A • Lead", tag: "Claiming", shift: "Takes: Sat Oct 25 • 18:00 - 01:00", detail: "Weekly Total Post-Swap: 36.0h", claim: true },
              ].map((side, i) =>
                side === null ? (
                  <div key="connector" className="md:col-span-1 flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                      <Icon name="swap_horiz" size={20} />
                    </div>
                  </div>
                ) : (
                  <div key={side.initials} className="md:col-span-5 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar initials={side.initials} size="sm" variant={side.claim ? "secondary" : "default"} className={!side.claim ? "bg-primary-container text-on-primary rounded-full" : "rounded-full"} />
                        <div>
                          <div className="font-title-sm text-title-sm text-primary leading-tight">{side.name}</div>
                          <div className="font-data-mono text-data-mono text-outline">{side.role}</div>
                        </div>
                      </div>
                      <Badge variant={side.claim ? "live" : "default"} mono>{side.tag}</Badge>
                    </div>
                    <div className="bg-surface-container-lowest p-2 rounded border border-outline-variant flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name={side.claim ? "event_available" : "event"} size={18} className="text-secondary" />
                        <div>
                          <div className="font-label-md text-label-md text-primary">{side.shift}</div>
                          <div className="font-data-mono text-data-mono text-outline">{side.detail}</div>
                        </div>
                      </div>
                      <span className="font-data-mono text-data-mono text-secondary font-bold">PT</span>
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-surface-container-high">
              <div className="flex items-center gap-2">
                <Icon name="check_circle" size={16} className="text-secondary" />
                <span className="font-data-mono text-data-mono text-on-surface-variant">Rest standard verified (local labor law)</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">Decline</Button>
                <Button variant="secondary" size="sm" icon="done_all">Approve Swap</Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" mono className="bg-primary text-on-primary rounded">DROP-REQ #843</Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Icon name="campaign" size={14} />
                  Up for Grabs Pool
                </Badge>
                <span className="font-data-mono text-data-mono text-error font-bold flex items-center gap-1">
                  <Icon name="timer" size={14} />
                  Expires in 18h
                </span>
              </div>
              <Badge variant="outline" mono>3 Eligible Bidders</Badge>
            </div>
            <div className="py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar initials="SE" size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-title-sm text-title-sm text-primary">Staff E</span>
                    <span className="font-data-mono text-data-mono text-outline">• Role C, Unit Alpha</span>
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-primary">Sun Oct 26 • 11:00 - 17:00</span>
                    <span>(6.0h Shift)</span>
                  </div>
                </div>
              </div>
              <Button variant="primary" size="sm">Assign Best Match</Button>
            </div>
          </Card>
        </section>

        <section className="xl:col-span-4 flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="psychology" size={20} className="text-secondary" />
              <h2 className="font-headline-md text-headline-md text-primary">Smart Auto-Coverage</h2>
            </div>
            <Badge variant="live" mono>AUTO MATCH</Badge>
          </div>

          <Card className="flex flex-col gap-space-md">
            <div className="bg-surface-container-low p-space-sm rounded-lg border border-outline-variant">
              <div className="flex items-center justify-between text-outline font-data-mono text-data-mono text-[11px] uppercase">
                <span>Target Open Shift</span>
                <span className="text-error font-bold">PRIORITY HIGH</span>
              </div>
              <div className="mt-1">
                <div className="font-title-sm text-title-sm text-primary">Lead Role — Station A</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">Tonight, Sat Oct 25 • 17:30 - 23:30 (6.0h)</div>
              </div>
            </div>

            {[
              { initials: "SF", name: "Staff F", match: "98% SKILL MATCH", ot: "0.0h (Safe)", best: true },
              { initials: "SG", name: "Staff G", match: "87% Match", ot: "+1.2h OT", best: false },
            ].map((c) => (
              <div key={c.initials} className={`border rounded-lg p-3 relative ${c.best ? "border-secondary" : "border-outline-variant"}`}>
                {c.best && (
                  <div className="absolute -top-2.5 right-3 bg-secondary text-on-secondary font-badge-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {c.match}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Avatar initials={c.initials} size="sm" variant={c.best ? "secondary" : "default"} className="rounded-full" />
                  <div>
                    <div className="font-title-sm text-title-sm text-primary">{c.name}</div>
                    <div className="font-data-mono text-data-mono text-outline text-[11px]">Role A • 1.4 mi away</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 my-2.5 bg-surface-container-low p-2 rounded text-center">
                  {[
                    { label: "OT Risk", value: c.ot },
                    { label: "Rest Turn", value: "16.5h" },
                    { label: "Fairness", value: "+12 Pts" },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="font-data-mono text-data-mono text-[10px] text-outline">{stat.label}</div>
                      <div className="font-data-mono text-data-mono text-secondary font-bold">{stat.value}</div>
                    </div>
                  ))}
                </div>
                <Button variant={c.best ? "secondary" : "outline"} size="sm" fullWidth>
                  {c.best ? "Dispatch Shift" : "Offer Shift"}
                </Button>
              </div>
            ))}

            <div className="border border-error bg-error-container/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Avatar initials="SH" size="sm" variant="error" className="rounded-full" />
                <div>
                  <div className="font-title-sm text-title-sm text-primary flex items-center gap-1.5">
                    Staff H
                    <Icon name="block" size={16} className="text-error" />
                  </div>
                  <div className="font-data-mono text-data-mono text-outline text-[11px]">Lead • Certified</div>
                </div>
                <Badge variant="error" mono className="ml-auto font-bold bg-error text-on-error">BLOCKED</Badge>
              </div>
              <div className="mt-2.5 bg-error-container border-l-2 border-error p-2 rounded-r">
                <div className="font-label-md text-label-md text-on-error-container font-bold flex items-center gap-1">
                  <Icon name="warning" size={14} />
                  Statutory Rest Breach
                </div>
                <p className="font-data-mono text-data-mono text-on-error-container text-[11px] mt-0.5">
                  Blocked: rest window under 10h between shifts.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-sm border-b border-surface-container-high gap-2">
          <div className="flex items-center gap-2">
            <Icon name="hub" size={20} className="text-secondary" />
            <h3 className="font-headline-md text-headline-md text-primary">Inter-Unit Coverage Matrix</h3>
            <span className="font-data-mono text-data-mono text-outline">Dual Timezone (PT & ET)</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm pt-space-sm">
          {unitPools.map((unit) => (
            <StatCard
              key={unit.name}
              label={unit.name}
              value={String(unit.open)}
              sub={unit.note}
              alert={unit.urgent}
              className="!p-3"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
