import { create } from "zustand";

interface ActivityState {
  isTrackingPaused: boolean;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  isTrackingPaused: false,
  togglePause: () => set((s) => ({ isTrackingPaused: !s.isTrackingPaused })),
  setPaused: (paused) => set({ isTrackingPaused: paused }),
}));
