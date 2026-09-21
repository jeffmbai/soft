import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["manager", "admin"]}>
      <PlaceholderPage title="Schedule" description="Week calendar and shift editor — Phase 2" />
    </ProtectedRoute>
  );
}
