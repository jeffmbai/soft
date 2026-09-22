"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import {
  approveSwap,
  fetchNotifications,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/cn";
import { toastApiError, toastSuccess } from "@/lib/toast";

function needsApproval(n: NotificationItem): boolean {
  return n.type === "approval_required" && n.payload?.action === "approve" && !!n.payload?.swap_id;
}

export default function NotificationsMenu() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const isManager = user?.role === "admin" || user?.role === "manager";

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  const actionCount = (notifications ?? []).filter((n) => !n.read_at && needsApproval(n)).length;

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const approveMutation = useMutation({
    mutationFn: (swapId: string) => approveSwap(swapId),
    onSuccess: () => {
      toastSuccess("Request approved");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["open-shifts"] });
    },
    onError: (err) => toastApiError(err, "Could not approve"),
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleOpenNotification(n: NotificationItem) {
    if (!n.read_at) readMutation.mutate(n.id);
    if (needsApproval(n) || n.payload?.swap_id) {
      setOpen(false);
      router.push("/open-shifts");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <Icon name="notifications" size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-h-[min(28rem,70vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg z-50">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
            <div>
              <p className="font-semibold text-slate-900 text-sm">Notifications</p>
              {actionCount > 0 && isManager && (
                <p className="text-xs text-slate-500 mt-0.5">{actionCount} need your approval</p>
              )}
            </div>
            <Link
              href="/open-shifts"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              Open pool
            </Link>
          </div>

          {!notifications?.length ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "px-4 py-3 hover:bg-slate-50 transition-colors",
                    !n.read_at && "bg-slate-50/80",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => handleOpenNotification(n)}
                  >
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-data-mono">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </button>

                  {isManager && needsApproval(n) && n.payload?.swap_id && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={approveMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          approveMutation.mutate(n.payload!.swap_id!);
                          if (!n.read_at) readMutation.mutate(n.id);
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNotification(n);
                        }}
                      >
                        Review
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
