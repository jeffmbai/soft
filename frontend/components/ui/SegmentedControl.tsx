"use client";

import { cn } from "@/lib/cn";

export type SegmentOption = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  dot?: boolean;
};

type SegmentedControlProps = {
  options: SegmentOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

export default function SegmentedControl({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center bg-surface-container-low border border-outline-variant",
        size === "sm" ? "p-0.5 rounded-lg gap-0" : "p-1 rounded-xl gap-0",
        className,
      )}
    >
      {label && (
        <span className="font-label-md text-label-md text-outline px-2 shrink-0">{label}</span>
      )}
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "font-label-md text-label-md transition-all flex items-center gap-1",
              size === "sm" ? "px-2 py-0.5 rounded" : "px-2.5 py-1 rounded-lg",
              active
                ? "bg-surface-container-lowest text-primary shadow-sm font-semibold"
                : "text-on-surface-variant hover:text-primary",
            )}
          >
            {opt.dot && active && <span className="w-1.5 h-1.5 rounded-full bg-error" />}
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
