import { cn } from "@/lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  accent?: "secondary" | "error" | "none";
  hover?: boolean;
};

export function Card({ children, className, padding = true, accent = "none", hover }: CardProps) {
  return (
    <div
      className={cn(
        "relative bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden",
        padding && "p-space-md",
        hover && "hover:border-outline transition-colors",
        className,
      )}
    >
      {accent !== "none" && (
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1",
            accent === "secondary" && "bg-secondary",
            accent === "error" && "bg-error",
          )}
        />
      )}
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-space-sm", className)}>
      <div className="flex items-center gap-space-sm min-w-0">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-headline-md text-headline-md text-primary truncate">{title}</h2>
          {subtitle && (
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardSection({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-3",
        className,
      )}
    >
      <h3 className="font-label-md text-label-md font-semibold text-primary flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
