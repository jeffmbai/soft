"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { Button, Card, PageHeader } from "@/components/ui";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { toastApiError, toastSuccess } from "@/lib/toast";

export default function SettingsView() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: fetchNotificationPreferences,
  });

  const [inApp, setInApp] = useState(true);
  const [emailSim, setEmailSim] = useState(false);
  useEffect(() => {
    if (prefs) {
      setInApp(prefs.in_app);
      setEmailSim(prefs.email_sim);
    }
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: () => updateNotificationPreferences({ in_app: inApp, email_sim: emailSim }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toastSuccess("Preferences saved");
    },
    onError: (err) => toastApiError(err, "Could not save preferences"),
  });

  const dirty = prefs ? inApp !== prefs.in_app || emailSim !== prefs.email_sim : false;

  return (
    <div className="flex flex-col gap-space-lg max-w-2xl pb-24">
      <PageHeader title="Settings" description="Preferences and account actions" />

      <Card className="space-y-4">
        <h3 className="font-title-sm font-bold text-primary">Notifications</h3>
        <p className="text-sm text-on-surface-variant">
          Control in-app alerts and simulated email delivery.
        </p>
        {isLoading ? (
          <Loading variant="inline" message="Loading preferences…" />
        ) : (
          <>
            <label className="flex items-center justify-between gap-4 py-2">
              <span className="text-sm font-medium text-primary">In-app notifications</span>
              <input
                type="checkbox"
                checked={inApp}
                onChange={(e) => setInApp(e.target.checked)}
                className="h-4 w-4 rounded accent-secondary"
              />
            </label>
            <label className="flex items-center justify-between gap-4 py-2 border-t border-outline-variant/60 pt-4">
              <span className="text-sm font-medium text-primary">Email (simulated)</span>
              <input
                type="checkbox"
                checked={emailSim}
                onChange={(e) => setEmailSim(e.target.checked)}
                className="h-4 w-4 rounded accent-secondary"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save preferences"}
            </Button>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-title-sm font-bold text-primary">Session</h3>
        <p className="text-sm text-on-surface-variant">Signed in as {user?.email}</p>
        <Button variant="danger" size="sm" onClick={() => void logout()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
