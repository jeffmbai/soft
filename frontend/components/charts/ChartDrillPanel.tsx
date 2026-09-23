"use client";

import Link from "next/link";
import { Badge, Button, Icon } from "@/components/ui";
import type { DrillAction, DrillItem } from "@/lib/chart-drill";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  items: DrillItem[];
  action?: DrillAction;
  onClose: () => void;
  emptyMessage?: string;
};

export default function ChartDrillPanel({ title, items, action, onClose, emptyMessage }: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-outline-variant animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] font-data-mono uppercase tracking-wider text-secondary">Drill-down</p>
          <h3 className="font-label-md font-semibold text-primary text-sm">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-outline hover:text-primary hover:bg-surface-container-low transition-colors"
          aria-label="Close drill-down"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-on-surface-variant py-2">{emptyMessage ?? "No matching records."}</p>
      ) : (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-surface-container-low text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-primary truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-on-surface-variant truncate">{item.subtitle}</p>
                )}
              </div>
              {item.badge && (
                <Badge variant={item.badgeVariant ?? "default"} className="shrink-0">
                  {item.badge}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {action && (
        <Link href={action.href} className={cn("inline-block mt-2")}>
          <Button variant="outline" size="sm">{action.label}</Button>
        </Link>
      )}
    </div>
  );
}
