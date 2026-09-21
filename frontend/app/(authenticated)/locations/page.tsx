import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <PlaceholderPage title="Locations" description="Admin location management — Phase 2+" />
    </ProtectedRoute>
  );
}
