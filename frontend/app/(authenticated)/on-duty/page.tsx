import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["manager", "admin"]}>
      <PlaceholderPage title="On Duty" description="Live on-duty board — Phase 4" />
    </ProtectedRoute>
  );
}
