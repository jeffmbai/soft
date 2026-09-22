import { cn } from "@/lib/cn";

export type MetricItem = {
  label: string;
  value: string;
  tone?: "default" | "error" | "secondary" | "muted";
};

const toneClasses: Record<NonNullable<MetricItem["tone"]>, string> = {
  default: "text-primary",
  error: "text-error",
  secondary: "text-secondary",
  muted: "text-on-secondary-container",
};

type MetricsRowProps = {
  metrics: MetricItem[];
  className?: string;
};

export default function MetricsRow({ metrics, className }: MetricsRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant",
        className,
      )}
    >
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={cn("px-3 py-1", i < metrics.length - 1 && "border-r border-outline-variant")}
        >
          <div className="font-data-mono text-data-mono text-outline uppercase text-[10px]">{m.label}</div>
          <div className={cn("font-headline-md text-headline-md font-bold", toneClasses[m.tone ?? "default"])}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}
