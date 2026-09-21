import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["manager", "admin"]}>
      <PlaceholderPage title="Swap Queue" description="Manager swap approvals — Phase 3" />
    </ProtectedRoute>
  );
}
