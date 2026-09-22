import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type AlertAction = { label: string; onClick?: () => void; variant?: "primary" | "secondary" | "outline" | "danger" };

type AlertBannerProps = {
  variant?: "error" | "warning" | "info";
  icon?: string;
  title: string;
  description?: string;
  badge?: string;
  meta?: string;
  actions?: AlertAction[];
  className?: string;
};

const styles = {
  error: {
    wrap: "bg-error-container border-l-4 border-error text-on-error-container",
    icon: "bg-on-error text-error",
    title: "text-error",
  },
  warning: {
    wrap: "bg-surface-container-lowest border-l-4 border-error border border-outline-variant",
    icon: "bg-error-container text-error",
    title: "text-primary",
  },
  info: {
    wrap: "bg-surface-container-low border-l-4 border-secondary",
    icon: "bg-secondary/10 text-secondary",
    title: "text-primary",
  },
};

export default function AlertBanner({
  variant = "error",
  icon = "warning",
  title,
  description,
  badge,
  meta,
  actions,
  className,
}: AlertBannerProps) {
  const s = styles[variant];

  return (
    <div className={cn("p-space-md rounded-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 shadow-sm", s.wrap, className)}>
      <div className="flex items-start gap-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm", s.icon)}>
          <Icon name={icon} size={20} filled={variant === "error"} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {badge && (
              <Badge variant="error" mono className="font-bold uppercase">
                {badge}
              </Badge>
            )}
            {meta && <span className="font-data-mono text-data-mono text-on-surface-variant">{meta}</span>}
          </div>
          <div className={cn("font-title-sm text-title-sm font-bold mt-1", s.title)}>{title}</div>
          {description && (
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "outline"}
              size="sm"
              onClick={action.onClick}
              className="flex-1 lg:flex-none"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
