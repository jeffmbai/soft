import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["staff"]}>
      <PlaceholderPage title="My Schedule" description="Staff schedule view — Phase 2" />
    </ProtectedRoute>
  );
}
