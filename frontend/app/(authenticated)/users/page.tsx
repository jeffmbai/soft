import PlaceholderPage from "@/components/PlaceholderPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <PlaceholderPage title="User Management" description="Admin user CRUD — Phase 2+" />
    </ProtectedRoute>
  );
}
