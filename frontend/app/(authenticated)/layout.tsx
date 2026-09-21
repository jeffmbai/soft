import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
