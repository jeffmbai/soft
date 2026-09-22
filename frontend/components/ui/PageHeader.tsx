import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import { cn } from "@/lib/cn";

type Stat = { label: string; value: string; sub?: string; alert?: boolean };

type PageHeaderProps = {
  eyebrow?: string;
  badge?: React.ReactNode;
  title: string;
  description?: string;
  stats?: Stat[];
  className?: string;
};

export default function PageHeader({
  eyebrow,
  badge,
  title,
  description,
  stats,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col lg:flex-row lg:items-center justify-between gap-4", className)}>
      <div>
        {(eyebrow || badge) && (
          <div className="flex items-center gap-2 mb-1">
            {eyebrow && (
              <span className="font-data-mono text-data-mono text-secondary font-bold">{eyebrow}</span>
            )}
            {badge && (
              typeof badge === "string" ? (
                <Badge variant="secondary" mono>{badge}</Badge>
              ) : (
                badge
              )
            )}
          </div>
        )}
        <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">{title}</h1>
        {description && (
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{description}</p>
        )}
      </div>
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}
    </div>
  );
}
