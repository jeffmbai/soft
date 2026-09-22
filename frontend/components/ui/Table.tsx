import { cn } from "@/lib/cn";

export function Table({ children, className, minWidth = "800px" }: { children: React.ReactNode; className?: string; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left border-collapse", className)} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-outline-variant bg-surface-container text-on-surface-variant font-label-md text-label-md">
        {children}
      </tr>
    </thead>
  );
}

export function TableHeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("py-2.5 px-3 font-semibold", className)}>{children}</th>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">{children}</tbody>;
}

export function TableRow({
  children,
  selected,
  onClick,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors group",
        onClick && "cursor-pointer",
        selected ? "bg-secondary/8 ring-1 ring-inset ring-secondary/20" : "hover:bg-surface-container-low",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("py-space-md px-3", className)}>
      {children}
    </td>
  );
}
