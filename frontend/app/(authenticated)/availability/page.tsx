import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["staff"]}>
      <PlaceholderPage title="Availability" description="Availability editor — Phase 2" />
    </ProtectedRoute>
  );
}
