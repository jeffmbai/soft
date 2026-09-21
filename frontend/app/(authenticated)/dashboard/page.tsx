"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { fetchLocations } from "@/lib/api";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
    enabled: user?.role === "admin" || user?.role === "manager",
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Welcome, {user?.name}</h1>
      <p className="text-slate-600 mb-6 capitalize">
        {user?.role} dashboard — Phase 1 foundation is live.
      </p>

      {(user?.role === "admin" || user?.role === "manager") && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Locations</h2>
          {isLoading ? (
            <p className="text-slate-500">Loading locations...</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {locations?.map((loc) => (
                <div key={loc.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="font-medium">{loc.name}</h3>
                  <p className="text-sm text-slate-500">{loc.address}</p>
                  <p className="text-xs text-teal-700 mt-1">{loc.timezone}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
