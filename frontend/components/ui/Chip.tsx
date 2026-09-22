import { cn } from "@/lib/cn";

type ChipVariant = "default" | "primary" | "secondary" | "location";

type ChipProps = {
  children: React.ReactNode;
  variant?: ChipVariant;
  dot?: boolean;
  className?: string;
};

const variants: Record<ChipVariant, string> = {
  default: "bg-surface-container-low text-on-surface-variant",
  primary: "bg-secondary/10 text-secondary ring-1 ring-secondary/20 font-bold",
  secondary: "bg-surface-container-high text-on-surface-variant",
  location: "bg-surface-container-low text-primary font-bold",
};

export default function Chip({ children, variant = "default", dot, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-data-mono text-data-mono text-[11px]",
        variants[variant],
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-secondary" />}
      {children}
    </span>
  );
}
