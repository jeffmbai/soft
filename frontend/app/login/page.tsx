"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import Loading from "@/components/Loading";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@coastaleats.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      const from = searchParams.get("from");
      router.replace(from && from !== "/login" ? from : "/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md relative">
      {submitting && <Loading variant="overlay" message="Signing in…" />}
      <h1 className="text-2xl font-bold text-teal-800 mb-1">ShiftSync</h1>
      <p className="text-slate-500 text-sm mb-6">Coastal Eats Staff Scheduling</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-teal-700 text-white py-2 rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors"
        >
          Sign In
        </button>
      </form>

      <div className="mt-6 pt-4 border-t text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-600">Demo accounts (password: password123)</p>
        <p>Admin: admin@coastaleats.com</p>
        <p>Manager: manager.west@coastaleats.com</p>
        <p>Staff: sam@coastaleats.com</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-container">
      <Suspense fallback={<Loading variant="page" message="Loading login…" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
