import { cn } from "@/lib/cn";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  className?: string;
};

export default function StatCard({ label, value, sub, alert, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "p-space-sm rounded-xl border flex flex-col justify-between",
        alert ? "bg-error-container/40 border-error-container" : "bg-surface-container-low border-outline-variant",
        className,
      )}
    >
      <span
        className={cn(
          "font-label-md text-label-md",
          alert ? "text-on-error-container font-semibold" : "text-on-surface-variant",
        )}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={cn("font-headline-md text-headline-md font-bold", alert ? "text-error" : "text-primary")}>
          {value}
        </span>
        {sub && (
          <span className={cn("font-data-mono text-data-mono", alert ? "text-error font-bold" : "text-outline")}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
