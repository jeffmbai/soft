import { cn } from "@/lib/cn";

export type TimelineItem = {
  id?: string;
  time: string;
  label: string;
  tone?: "ok" | "warn" | "error" | "neutral";
};

const dotColors = {
  ok: "bg-secondary",
  warn: "bg-amber-500",
  error: "bg-error",
  neutral: "bg-outline",
};

type TimelineProps = {
  items: TimelineItem[];
  className?: string;
};

export default function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((item, index) => (
        <div key={item.id ?? `${item.time}-${index}`} className="flex items-start gap-3">
          <span className="font-data-mono text-data-mono text-outline w-12 shrink-0">{item.time}</span>
          <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", dotColors[item.tone ?? "neutral"])} />
          <span className="font-body-sm text-body-sm text-primary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
