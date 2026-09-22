"use client";

import { useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";

export default function SettingsView() {
  const { user, logout } = useAuth();
  const [inApp, setInApp] = useState(true);
  const [emailSim, setEmailSim] = useState(true);

  return (
    <div className="flex flex-col gap-space-lg max-w-2xl pb-24">
      <PageHeader title="Settings" description="Preferences and account actions" />

      <Card className="space-y-4">
        <h3 className="font-title-sm font-bold text-primary">Notifications</h3>
        <p className="text-sm text-on-surface-variant">
          Notification delivery preferences (full sync coming in Phase 3).
        </p>
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
        <Button variant="outline" size="sm" disabled>
          Save preferences
        </Button>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-title-sm font-bold text-primary">Session</h3>
        <p className="text-sm text-on-surface-variant">
          Signed in as {user?.email}
        </p>
        <Button variant="danger" size="sm" onClick={() => void logout()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
