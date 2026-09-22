"use client";

import { useEffect, useState } from "react";
import type { Location } from "@/lib/api";
import { SKILL_OPTIONS } from "@/lib/staff-utils";
import { Button } from "@/components/ui";

type StaffFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  locations: Location[];
  initial?: {
    name: string;
    email: string;
    desiredHours: number;
    availabilityTimezone: string;
    skillKeys: string[];
    locationIds: string[];
  };
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    email: string;
    desired_hours_per_week: number;
    availability_timezone: string;
    skills: string[];
    location_ids: string[];
    password?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
};

const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/New_York", label: "Eastern (ET)" },
];

export default function StaffFormModal({
  open,
  mode,
  locations,
  initial,
  onClose,
  onSubmit,
  isSubmitting,
}: StaffFormModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [desiredHours, setDesiredHours] = useState(32);
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [skills, setSkills] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setEmail(initial?.email ?? "");
    setDesiredHours(initial?.desiredHours ?? 32);
    setTimezone(initial?.availabilityTimezone ?? "America/Los_Angeles");
    setSkills(initial?.skillKeys ?? []);
    setLocationIds(initial?.locationIds ?? (locations[0] ? [locations[0].id] : []));
    setPassword("password123");
    setError(null);
  }, [open, initial, locations]);

  if (!open) return null;

  function toggleSkill(skill: string) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  function toggleLocation(id: string) {
    setLocationIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((l) => l !== id) : prev) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || skills.length === 0 || locationIds.length === 0) {
      setError("Name, email, at least one skill, and one location are required.");
      return;
    }
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        desired_hours_per_week: desiredHours,
        availability_timezone: timezone,
        skills,
        location_ids: locationIds,
        ...(mode === "create" ? { password } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save staff member");
    }
  }

  return (
    <>
      <button type="button" aria-label="Close dialog" onClick={onClose} className="fixed inset-0 bg-primary/30 z-50" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-headline-md text-headline-md font-bold text-primary mb-4">
          {mode === "create" ? "Add Staff Member" : "Edit Staff Member"}
        </h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block">
            <span className="font-label-md text-label-md text-on-surface-variant">Full name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
            />
          </label>
          <label className="block">
            <span className="font-label-md text-label-md text-on-surface-variant">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
            />
          </label>
          {mode === "create" && (
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">Temporary password</span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">Desired hours / week</span>
              <input
                type="number"
                min={0}
                max={80}
                value={desiredHours}
                onChange={(e) => setDesiredHours(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </label>
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">Timezone</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend className="font-label-md text-label-md text-on-surface-variant mb-2">Skills</legend>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.filter((o) => o.value).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleSkill(opt.value)}
                  className={`px-3 py-1 rounded-full font-label-md text-label-md border transition-colors ${
                    skills.includes(opt.value)
                      ? "bg-secondary text-on-secondary border-secondary"
                      : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-label-md text-label-md text-on-surface-variant mb-2">Certified locations</legend>
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => toggleLocation(loc.id)}
                  className={`px-3 py-1 rounded-full font-label-md text-label-md border transition-colors ${
                    locationIds.includes(loc.id)
                      ? "bg-secondary text-on-secondary border-secondary"
                      : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-error font-body-sm text-body-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="secondary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : mode === "create" ? "Create Staff" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
