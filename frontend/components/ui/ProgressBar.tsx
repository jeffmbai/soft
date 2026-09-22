import { cn } from "@/lib/cn";

type ProgressBarProps = {
  value: number;
  max?: number;
  variant?: "default" | "error" | "warning";
  showLabel?: boolean;
  label?: string;
  footer?: React.ReactNode;
  className?: string;
};

export default function ProgressBar({
  value,
  max = 100,
  variant = "default",
  showLabel,
  label,
  footer,
  className,
}: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className={cn("space-y-2", className)}>
      {(showLabel || label) && (
        <div className="flex justify-between font-data-mono text-data-mono text-[12px]">
          <span className="text-outline">{label ?? "Progress"}</span>
          {showLabel && (
            <span
              className={cn(
                "font-bold",
                variant === "error" ? "text-error" : variant === "warning" ? "text-amber-600" : "text-secondary",
              )}
            >
              {value}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            variant === "error" ? "bg-error" : variant === "warning" ? "bg-amber-500" : "bg-secondary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {footer}
    </div>
  );
}
