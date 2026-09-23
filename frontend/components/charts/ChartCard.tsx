"use client";

import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  drill?: React.ReactNode;
  isDrilled?: boolean;
  className?: string;
  height?: number;
};

export default function ChartCard({
  title,
  subtitle,
  children,
  drill,
  isDrilled,
  className,
  height = 220,
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        "space-y-2 transition-shadow",
        isDrilled && "ring-2 ring-secondary/30 shadow-md",
        className,
      )}
      padding
    >
      <CardHeader
        title={title}
        subtitle={drill ? `${subtitle ?? ""}${subtitle ? " · " : ""}Click a segment to drill down` : subtitle}
      />
      <div style={{ height }} className="w-full min-w-0">
        {children}
      </div>
      {drill}
    </Card>
  );
}
