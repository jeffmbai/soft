import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type DataTableProps = {
  title: string;
  count?: string;
  onExport?: () => void;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function DataTable({
  title,
  count,
  onExport,
  toolbar,
  footer,
  children,
  className,
}: DataTableProps) {
  return (
    <div className={cn("bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden", className)}>
      <div className="px-space-md py-space-sm border-b border-outline-variant flex items-center justify-between bg-surface-container-low gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-title-sm text-title-sm text-primary font-bold truncate">{title}</span>
          {count && (
            <Badge variant="default" mono className="shrink-0">
              {count}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {toolbar}
          {onExport !== undefined && (
            <button
              type="button"
              title="Export CSV"
              onClick={onExport}
              className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors"
            >
              <Icon name="download" size={16} />
            </button>
          )}
        </div>
      </div>
      {children}
      {footer}
    </div>
  );
}
