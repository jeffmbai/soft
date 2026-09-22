"use client";

import { useAuth } from "@/providers/AuthProvider";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar role={user.role} />
      <div className="pl-[248px] flex flex-col min-h-screen">
        <TopNav
          userName={user.name}
          userRole={user.role}
          onLogout={() => void logout()}
        />
        <main className="flex-1 p-margin">{children}</main>
      </div>
    </div>
  );
}
