"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/providers/AuthProvider";
import Loading from "@/components/Loading";

interface Props {
  children: ReactNode;
}

/** Client-side hydration guard. Route access is enforced in middleware. */
export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading variant="inline" message="Loading your session…" />;
  }

  if (!user) {
    return <Loading variant="inline" message="Redirecting to login…" />;
  }

  return <>{children}</>;
}
