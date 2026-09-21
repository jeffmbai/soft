import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["staff"]}>
      <PlaceholderPage title="Open Shifts" description="Pick up dropped shifts — Phase 3" />
    </ProtectedRoute>
  );
}
