import type { StaffMemberResponse } from "@/lib/api";

/** Demo hourly rate for projected labor cost (not payroll-accurate). */
export const BASE_HOURLY_RATE = 18;
export const OT_MULTIPLIER = 1.5;
export const OT_THRESHOLD = 40;

export type StaffOvertimeCost = {
  id: string;
  name: string;
  assignedHours: number;
  regularHours: number;
  otHours: number;
  regularCost: number;
  otCost: number;
  totalCost: number;
};

export type OvertimeCostProjection = {
  totalLaborCost: number;
  projectedOtCost: number;
  projectedOtHours: number;
  staffAtRisk: number;
  byStaff: StaffOvertimeCost[];
};

export function computeOvertimeCost(staff: StaffMemberResponse[]): OvertimeCostProjection {
  const byStaff: StaffOvertimeCost[] = staff.map((s) => {
    const assignedHours = s.assigned_hours;
    const regularHours = Math.min(assignedHours, OT_THRESHOLD);
    const otHours = Math.max(0, assignedHours - OT_THRESHOLD);
    const regularCost = regularHours * BASE_HOURLY_RATE;
    const otCost = otHours * BASE_HOURLY_RATE * OT_MULTIPLIER;
    return {
      id: s.id,
      name: s.name,
      assignedHours,
      regularHours,
      otHours,
      regularCost,
      otCost,
      totalCost: regularCost + otCost,
    };
  });

  return {
    totalLaborCost: byStaff.reduce((n, s) => n + s.totalCost, 0),
    projectedOtCost: byStaff.reduce((n, s) => n + s.otCost, 0),
    projectedOtHours: byStaff.reduce((n, s) => n + s.otHours, 0),
    staffAtRisk: byStaff.filter((s) => s.assignedHours >= 35).length,
    byStaff: [...byStaff].sort((a, b) => b.otCost - a.otCost),
  };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    amount,
  );
}
