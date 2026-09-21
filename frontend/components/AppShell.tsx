"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

const navByRole: Record<string, { href: string; label: string }[]> = {
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/locations", label: "Locations" },
    { href: "/users", label: "Users" },
  ],
  manager: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/schedule", label: "Schedule" },
    { href: "/swaps", label: "Swap Queue" },
    { href: "/on-duty", label: "On Duty" },
  ],
  staff: [
    { href: "/my-schedule", label: "My Schedule" },
    { href: "/availability", label: "Availability" },
    { href: "/open-shifts", label: "Open Shifts" },
  ],
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const nav = user ? navByRole[user.role] ?? [] : [];

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-teal-800 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold tracking-tight">
              ShiftSync
            </Link>
            <nav className="flex gap-4 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`hover:text-teal-200 transition-colors ${pathname === item.href ? "text-teal-200 font-medium" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span>
                {user.name}{" "}
                <span className="text-teal-300 capitalize">({user.role})</span>
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">{children}</main>
      <footer className="text-center text-xs text-slate-400 py-4">
        Coastal Eats — ShiftSync v0.1
      </footer>
    </div>
  );
}
