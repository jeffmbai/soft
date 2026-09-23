"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Loading from "@/components/Loading";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmationModal,
  Icon,
} from "@/components/ui";
import {
  acceptSwap,
  approveSwap,
  cancelSwap,
  claimOpenShift,
  fetchOpenShifts,
  fetchSwapRequests,
  formatShiftRange,
  SKILL_LABELS,
  SWAP_STATUS_LABELS,
  type SwapRequestResponse,
} from "@/lib/api";
import type { Skill } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/cn";
import { liveQueryOptions } from "@/lib/live-query";
import { toastApiError, toastSuccess } from "@/lib/toast";

type SwapAction = "accept" | "approve" | "cancel" | "claim";
type ViewTab = "pool" | "activity";

type PendingConfirm = {
  swapId: string;
  action: SwapAction;
  item: SwapRequestResponse;
};

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function shiftHours(startsAt: string, endsAt: string): string {
  return `${((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3600000).toFixed(1)}h`;
}

function formatShiftDate(startsAt: string, timezone: string) {
  const d = new Date(startsAt);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone }),
    shortDay: d.toLocaleDateString("en-US", { weekday: "short", timeZone: timezone }),
    day: d.toLocaleDateString("en-US", { day: "numeric", timeZone: timezone }),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: timezone }),
  };
}

function tzLabel(timezone: string): string {
  return timezone.split("/").pop()?.replace("_", " ") ?? timezone;
}

function ShiftSummary({ item }: { item: SwapRequestResponse }) {
  const skill = item.shift.required_skill as Skill;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-slate-900">{item.shift.location_name}</p>
      <p className="text-slate-600">
        {formatShiftRange(item.shift.starts_at, item.shift.ends_at, item.shift.location_timezone)}
      </p>
      <div className="flex gap-2">
        <Badge variant="outline">{SKILL_LABELS[skill]}</Badge>
        <span className="text-xs text-slate-500 font-data-mono">
          {shiftHours(item.shift.starts_at, item.shift.ends_at)}
        </span>
      </div>
    </div>
  );
}

function confirmCopy(action: SwapAction, item: SwapRequestResponse) {
  switch (action) {
    case "claim":
      return { title: "Claim this shift?", description: "This shift will be added to your schedule.", confirmLabel: "Claim shift", variant: "default" as const, icon: "event_available" };
    case "accept":
      return { title: "Accept swap request?", description: `You'll take ${item.requester.name}'s shift. A manager must approve.`, confirmLabel: "Accept swap", variant: "default" as const, icon: "swap_horiz" };
    case "approve":
      return { title: item.type === "drop" ? "Approve drop?" : "Approve swap?", description: item.type === "drop" ? "Shift moves to the open pool." : "Assignments will update.", confirmLabel: "Approve", variant: "default" as const, icon: "done_all" };
    case "cancel":
      return { title: "Cancel this request?", description: "The shift stays on the original assignee.", confirmLabel: "Cancel request", variant: "danger" as const, icon: "cancel" };
  }
}

function DateBadge({ startsAt, timezone, featured = false }: { startsAt: string; timezone: string; featured?: boolean }) {
  const date = formatShiftDate(startsAt, timezone);
  return (
    <div
      className={cn(
        "shrink-0 w-18 flex flex-col items-center justify-center rounded-lg border text-center py-2.5",
        featured ? "bg-slate-800 text-white border-slate-800" : "bg-slate-50 text-slate-900 border-slate-200",
      )}
    >
      <span className={cn("font-data-mono uppercase tracking-wider text-[9px]", featured ? "text-slate-300" : "text-slate-500")}>{date.shortDay}</span>
      <span className="text-2xl font-bold leading-none mt-0.5">{date.day}</span>
      <span className={cn("font-data-mono text-[9px] mt-0.5", featured ? "text-slate-300" : "text-slate-500")}>{date.month}</span>
    </div>
  );
}

function PoolShiftCard({
  item,
  featured = false,
  viewerIsStaff,
  onClaim,
}: {
  item: SwapRequestResponse;
  featured?: boolean;
  viewerIsStaff: boolean;
  onClaim: () => void;
}) {
  const skill = item.shift.required_skill as Skill;
  const date = formatShiftDate(item.shift.starts_at, item.shift.location_timezone);
  const range = formatShiftRange(item.shift.starts_at, item.shift.ends_at, item.shift.location_timezone);
  const eligible = item.can_claim;
  const poolOpen = item.status === "approved" && item.type === "drop";
  const dimmed = viewerIsStaff && !eligible;

  return (
    <article
      className={cn(
        "rounded-xl border bg-white overflow-hidden",
        featured ? "border-slate-300 shadow-sm" : "border-slate-200",
        dimmed && "opacity-75",
      )}
    >
      <div className={cn("p-4 flex gap-4", featured && "sm:p-5")}>
        <DateBadge startsAt={item.shift.starts_at} timezone={item.shift.location_timezone} featured={featured && (eligible || !viewerIsStaff)} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{item.shift.location_name}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{date.weekday} · {range}</p>
            </div>
            <Badge variant="outline" mono className="shrink-0 text-[10px]">
              {eligible || (!viewerIsStaff && poolOpen) ? "OPEN" : "UNAVAILABLE"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">{SKILL_LABELS[skill]}</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">{shiftHours(item.shift.starts_at, item.shift.ends_at)}</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">{tzLabel(item.shift.location_timezone)}</span>
          </div>
          <p className="text-xs text-slate-500">
            {item.requester.name === "Open shift" ? "In the open pool" : `Released by ${item.requester.name}`}
          </p>
        </div>
      </div>
      <div className="px-4 pb-4">
        {eligible ? (
          <Button variant={featured ? "primary" : "outline"} fullWidth size="sm" onClick={onClaim}>
            Claim shift
          </Button>
        ) : (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {item.claim_block_reason ?? (viewerIsStaff ? "Not eligible to claim" : "Available for staff to claim")}
          </p>
        )}
      </div>
    </article>
  );
}

function RequestCard({ item, onAction }: { item: SwapRequestResponse; onAction: (action: SwapAction) => void }) {
  const skill = item.shift.required_skill as Skill;
  const range = formatShiftRange(item.shift.starts_at, item.shift.ends_at, item.shift.location_timezone);
  const needsAction = item.can_accept || item.can_approve || item.can_claim || item.can_cancel;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <Avatar initials={initials(item.requester.name)} size="md" variant="default" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" mono className="text-[10px]">{item.type}</Badge>
            <Badge variant="default" className="text-[10px]">{SWAP_STATUS_LABELS[item.status]}</Badge>
            <Badge variant="outline" className="text-[10px]">{SKILL_LABELS[skill]}</Badge>
          </div>
          <p className="font-medium text-slate-900 text-sm">{item.shift.location_name}</p>
          <p className="text-xs text-slate-500">{range}</p>
          {item.type === "swap" && item.target ? (
            <p className="text-xs text-slate-600">{item.requester.name} → {item.target.name}</p>
          ) : (
            <p className="text-xs text-slate-600">{item.requester.name}</p>
          )}
        </div>
      </div>
      {needsAction && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
          {item.can_accept && <Button variant="outline" size="sm" onClick={() => onAction("accept")}>Accept</Button>}
          {item.can_approve && <Button variant="primary" size="sm" onClick={() => onAction("approve")}>Approve</Button>}
          {item.can_claim && <Button variant="primary" size="sm" onClick={() => onAction("claim")}>Claim</Button>}
          {item.can_cancel && <Button variant="outline" size="sm" onClick={() => onAction("cancel")}>Cancel</Button>}
        </div>
      )}
    </article>
  );
}

export default function OpenShiftsView() {
  const { user } = useAuth();
  const isStaff = user?.role === "staff";
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [view, setView] = useState<ViewTab>(isStaff ? "pool" : "activity");
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const queryClient = useQueryClient();

  const live = liveQueryOptions();
  const { data: openPool, isLoading: poolLoading } = useQuery({
    queryKey: ["open-shifts"],
    queryFn: fetchOpenShifts,
    ...live,
  });
  const { data: requests, isLoading: reqLoading } = useQuery({
    queryKey: ["swap-requests"],
    queryFn: fetchSwapRequests,
    ...live,
  });

  const mutation = useMutation({
    mutationFn: async ({ swapId, action }: { swapId: string; action: SwapAction }) => {
      if (action === "accept") return acceptSwap(swapId);
      if (action === "approve") return approveSwap(swapId);
      if (action === "cancel") return cancelSwap(swapId);
      return claimOpenShift(swapId);
    },
    onSuccess: (_, { action }) => {
      setPending(null);
      const msg: Record<SwapAction, string> = { claim: "Shift claimed", approve: "Request approved", accept: "Swap accepted", cancel: "Request cancelled" };
      toastSuccess(msg[action]);
      void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["open-shifts"] });
      void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => { toastApiError(err, "Action failed"); setPending(null); },
  });

  const pendingApproval = useMemo(() => (requests ?? []).filter((r) => r.status === "pending_manager"), [requests]);
  const myActivity = useMemo(() => {
    if (!user) return [];
    return (requests ?? []).filter(
      (r) => !(r.type === "drop" && r.status === "approved") && (r.requester.id === user.id || r.target?.id === user.id),
    );
  }, [requests, user]);

  const claimable = (openPool ?? []).filter((r) => r.can_claim);
  const locked = (openPool ?? []).filter((r) => !r.can_claim);
  const poolCount = openPool?.length ?? 0;
  const activityList = isStaff ? myActivity : (requests ?? []).filter((r) => r.status !== "approved" || r.type === "swap");

  if (poolLoading || reqLoading) return <Loading variant="inline" message="Loading open shifts…" />;

  const confirm = pending ? confirmCopy(pending.action, pending.item) : null;
  const tabs: { id: ViewTab; label: string; count: number }[] = isStaff
    ? [{ id: "pool", label: "Open pool", count: poolCount }, { id: "activity", label: "My activity", count: myActivity.length }]
    : [{ id: "activity", label: "Requests", count: pendingApproval.length }, { id: "pool", label: "Open pool", count: poolCount }];

  return (
    <div className="flex flex-col gap-5 pb-10 max-w-5xl">
      <header className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
        <h1 className="font-headline-md text-headline-md font-bold text-slate-900">Open Shifts Pool</h1>
        <p className="text-sm text-slate-600 mt-1">
          {isStaff
            ? "Claim released shifts that match your skills."
            : "Approve drop and swap requests via notifications. The open pool shows shifts waiting for staff to claim."}
        </p>
        {isManager && pendingApproval.length > 0 && (
          <p className="text-sm text-slate-700 mt-3 flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 w-fit">
            <Icon name="notifications" size={16} className="text-slate-500" />
            {pendingApproval.length} pending — check notifications to approve
          </p>
        )}
        <div className="flex gap-4 mt-4">
          {[
            { label: "Open", value: poolCount },
            { label: isStaff ? "Claimable" : "In pool", value: isStaff ? claimable.length : poolCount },
            { label: "Pending", value: pendingApproval.length },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-data-mono">{s.label}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === tab.id ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {tab.label}
            <span className="text-[10px] font-data-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{tab.count}</span>
          </button>
        ))}
      </div>

      {view === "pool" ? (
        <div className="space-y-6">
          {claimable.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Available to you</h2>
              <div className="space-y-3">
                {claimable.map((item) => (
                  <PoolShiftCard
                    key={item.id}
                    item={item}
                    featured
                    viewerIsStaff={isStaff}
                    onClaim={() => setPending({ swapId: item.id, action: "claim", item })}
                  />
                ))}
              </div>
            </section>
          )}
          {locked.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {isStaff ? (claimable.length ? "Other open shifts" : "Open shifts") : "Open pool — staff can claim these"}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {locked.map((item) => (
                  <PoolShiftCard
                    key={item.id}
                    item={item}
                    viewerIsStaff={isStaff}
                    onClaim={() => setPending({ swapId: item.id, action: "claim", item })}
                  />
                ))}
              </div>
            </section>
          )}
          {poolCount === 0 && (
            <Card className="py-12 text-center border-dashed border-slate-200">
              <p className="text-slate-900 font-medium">No open shifts</p>
              <p className="text-sm text-slate-500 mt-1">Approved drops appear here for staff to claim.</p>
            </Card>
          )}
        </div>
      ) : (
        <section className="space-y-3">
          {activityList.length === 0 ? (
            <Card className="py-10 text-center border-slate-200">
              <p className="text-slate-500 text-sm">No active requests</p>
            </Card>
          ) : (
            activityList.map((item) => (
              <RequestCard key={item.id} item={item} onAction={(action) => setPending({ swapId: item.id, action, item })} />
            ))
          )}
        </section>
      )}

      {pending && confirm && (
        <ConfirmationModal
          open
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
          icon={confirm.icon}
          loading={mutation.isPending}
          onClose={() => !mutation.isPending && setPending(null)}
          onConfirm={() => mutation.mutate({ swapId: pending.swapId, action: pending.action })}
        >
          <ShiftSummary item={pending.item} />
        </ConfirmationModal>
      )}
    </div>
  );
}
