"use client";

import { cn } from "@/lib/cn";

const locations = [
  { id: "west", label: "West", tz: "PT", time: "14:42" },
  { id: "east", label: "East", tz: "ET", time: "17:42" },
  { id: "all", label: "All Units", tz: null, time: null },
];

type LocationTabsProps = {
  active?: string;
  compact?: boolean;
};

export default function LocationTabs({ active = "west", compact }: LocationTabsProps) {
  return (
    <div className="inline-flex items-center p-1 rounded-full bg-surface-container-low border border-outline-variant/60">
      {locations.map((loc) => {
        const isActive = loc.id === active;
        return (
          <button
            key={loc.id}
            type="button"
            className={cn(
              "relative px-3 py-1.5 rounded-full font-label-md text-label-md transition-all duration-200",
              isActive
                ? "bg-surface-container-lowest text-primary shadow-sm font-semibold"
                : "text-on-surface-variant hover:text-primary",
              compact && "px-2.5 py-1",
            )}
          >
            <span>{loc.label}</span>
            {loc.tz && (
              <span
                className={cn(
                  "ml-1.5 font-badge-mono text-badge-mono text-[10px]",
                  isActive ? "text-secondary" : "text-outline",
                )}
              >
                {loc.time}
              </span>
            )}
            {isActive && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-secondary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
