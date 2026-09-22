import { create } from "zustand";
import type { Skill } from "@/lib/api";

export type AddShiftPrefill = {
  dayOffset?: number;
  skill?: Skill;
};

type ScheduleUiState = {
  addShiftOpen: boolean;
  prefill: AddShiftPrefill | null;
  requestPublish: boolean;
  openAddShift: (prefill?: AddShiftPrefill) => void;
  closeAddShift: () => void;
  triggerPublish: () => void;
  clearPublishRequest: () => void;
};

export const useScheduleUiStore = create<ScheduleUiState>((set) => ({
  addShiftOpen: false,
  prefill: null,
  requestPublish: false,
  openAddShift: (prefill) => set({ addShiftOpen: true, prefill: prefill ?? null }),
  closeAddShift: () => set({ addShiftOpen: false, prefill: null }),
  triggerPublish: () => set({ requestPublish: true }),
  clearPublishRequest: () => set({ requestPublish: false }),
}));

/** @deprecated Use useScheduleUiStore directly */
export function useScheduleUi() {
  return useScheduleUiStore();
}

/** @deprecated Use useScheduleUiStore directly */
export function useScheduleUiOptional() {
  return useScheduleUiStore();
}
