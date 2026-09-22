import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "secondary" | "error" | "outline" | "live" | "warning";

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-container-high text-on-surface-variant",
  secondary: "bg-secondary-container text-on-secondary-fixed",
  error: "bg-error-container text-on-error-container",
  outline: "bg-surface-container-lowest text-primary border border-outline-variant",
  live: "bg-secondary/10 text-secondary ring-1 ring-secondary/20",
  warning: "bg-amber-100 text-amber-900 border border-amber-300",
};

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  mono?: boolean;
};

export default function Badge({ children, variant = "default", className, mono }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-md text-label-md",
        mono && "font-badge-mono text-badge-mono",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
