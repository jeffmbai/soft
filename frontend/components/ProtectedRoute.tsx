"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/providers/AuthProvider";
import type { UserRole } from "@/lib/api";

interface Props {
  children: ReactNode;
  roles?: UserRole[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
    if (!loading && user && roles && !roles.includes(user.role)) {
      router.replace("/");
    }
  }, [loading, user, roles, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!user) return null;
  if (roles && !roles.includes(user.role)) return null;

  return <>{children}</>;
}
