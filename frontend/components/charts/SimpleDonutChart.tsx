"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartDatum } from "@/lib/dashboard-metrics";
import { CHART_COLORS } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/cn";

type Props = {
  data: ChartDatum[];
  centerLabel?: string;
  activeId?: string | null;
  onDatumClick?: (datum: ChartDatum) => void;
};

export default function SimpleDonutChart({
  data,
  centerLabel,
  activeId,
  onDatumClick,
}: Props) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((n, d) => n + d.value, 0);
  const drillable = !!onDatumClick;

  if (!total) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-on-surface-variant">
        No data
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", drillable && "cursor-pointer")}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
            onClick={(_, index) => {
              if (drillable && filtered[index]) onDatumClick(filtered[index]);
            }}
          >
            {filtered.map((entry, i) => {
              const isActive = activeId != null && entry.id === activeId;
              const dimmed = activeId != null && !isActive;
              return (
                <Cell
                  key={entry.id ?? entry.name}
                  fill={entry.fill ?? CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={dimmed ? 0.25 : 1}
                  stroke={isActive ? "#131b2e" : "none"}
                  strokeWidth={isActive ? 2 : 0}
                />
              );
            })}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #c6c6cd",
              fontSize: 12,
            }}
            formatter={(value, name) => [`${value}`, drillable ? `${name} · click to drill` : name]}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-headline-md font-bold text-primary">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
