"use client";

import { useAuth } from "@/providers/AuthProvider";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileView() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-space-lg max-w-2xl pb-24">
      <PageHeader title="Profile" description="Your ShiftSync account" />

      <Card className="flex items-start gap-4">
        <Avatar initials={initials(user.name)} size="xl" variant="secondary" />
        <div className="flex-1 min-w-0">
          <h2 className="font-headline-md text-headline-md font-bold text-primary">{user.name}</h2>
          <p className="text-sm text-on-surface-variant mt-1">{user.email}</p>
          <Badge variant="secondary" className="mt-3 capitalize">{user.role}</Badge>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-title-sm font-bold text-primary">Account details</h3>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-outline-variant/60 pb-2">
            <dt className="text-on-surface-variant">User ID</dt>
            <dd className="font-data-mono text-primary truncate">{user.id}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-outline-variant/60 pb-2">
            <dt className="text-on-surface-variant">Email</dt>
            <dd className="text-primary">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-on-surface-variant">Role</dt>
            <dd className="capitalize text-primary">{user.role}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
