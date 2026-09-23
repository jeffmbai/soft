"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartDatum } from "@/lib/dashboard-metrics";
import { CHART_COLORS } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/cn";

type Props = {
  data: ChartDatum[];
  valueSuffix?: string;
  color?: string;
  activeId?: string | null;
  onDatumClick?: (datum: ChartDatum) => void;
};

export default function SimpleBarChart({
  data,
  valueSuffix = "",
  color = CHART_COLORS[0],
  activeId,
  onDatumClick,
}: Props) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-on-surface-variant">
        No data for this period
      </div>
    );
  }

  const drillable = !!onDatumClick;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e3e5" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#45464d" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#45464d" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #c6c6cd",
            fontSize: 12,
          }}
          formatter={(value) => [`${value}${valueSuffix}`, ""]}
          labelFormatter={(label) => `${label}${drillable ? " · click to drill" : ""}`}
        />
        <Bar
          dataKey="value"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          className={cn(drillable && "cursor-pointer")}
          onClick={(barData) => {
            if (drillable && barData) onDatumClick(barData as unknown as ChartDatum);
          }}
        >
          {data.map((entry) => {
            const isActive = activeId != null && entry.id === activeId;
            const dimmed = activeId != null && !isActive;
            return (
              <Cell
                key={entry.id ?? entry.name}
                fill={entry.fill ?? color}
                fillOpacity={dimmed ? 0.25 : 1}
                stroke={isActive ? color : "none"}
                strokeWidth={isActive ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
