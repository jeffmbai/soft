"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Dot,
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
  activeId?: string | null;
  onDatumClick?: (datum: ChartDatum) => void;
};

export default function SimpleAreaChart({
  data,
  valueSuffix = "h",
  activeId,
  onDatumClick,
}: Props) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-on-surface-variant">
        No hours scheduled
      </div>
    );
  }

  const drillable = !!onDatumClick;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #c6c6cd",
            fontSize: 12,
          }}
          formatter={(value) => [`${value}${valueSuffix}`, "Hours"]}
          labelFormatter={(label) => `${label}${drillable ? " · click to drill" : ""}`}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS[0]}
          strokeWidth={2}
          fill="url(#areaFill)"
          activeDot={{ r: 6, strokeWidth: 2, stroke: CHART_COLORS[0] }}
          dot={(props) => {
            const { cx, cy, payload } = props;
            const datum = payload as ChartDatum;
            const isActive = activeId != null && datum.id === activeId;
            return (
              <Dot
                key={datum.id ?? datum.name}
                cx={cx}
                cy={cy}
                r={isActive ? 6 : 4}
                fill={isActive ? CHART_COLORS[0] : "#fff"}
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                className={cn(drillable && "cursor-pointer")}
                onClick={() => {
                  if (drillable) onDatumClick(datum);
                }}
              />
            );
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
