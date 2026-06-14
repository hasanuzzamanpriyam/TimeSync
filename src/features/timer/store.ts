import { create } from "zustand";
import { timerEngine, TimerInstance } from "@/features/timer/engine";
import { idleDetector } from "@/features/timer/idle-detector";
import { TimeEntryType } from "@/types";

interface TimerState {
  timers: TimerInstance[];
  showIdlePopup: boolean;
  isPaused: boolean;

  startTimer: (taskId: number, type?: TimeEntryType) => Promise<TimerInstance>;
  pauseTimer: (taskId: number) => Promise<void>;
  resumeTimer: (taskId: number) => Promise<void>;
  stopTimer: (taskId: number) => Promise<void>;
  discardTimer: (taskId: number) => void;
  getTimerState: (taskId: number) => TimerInstance | undefined;
  getAllTimers: () => TimerInstance[];
  dismissIdlePopup: () => void;
  init: () => void;
  destroy: () => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  timers: [],
  showIdlePopup: false,
  isPaused: false,

  init: () => {
    timerEngine.setOnTick((timer) => {
      set((state) => ({
        timers: state.timers.map((t) =>
          t.taskId === timer.taskId ? timer : t,
        ),
      }));
    });

    const allTimers = timerEngine.getAllTimers();
    set({ timers: allTimers });

    idleDetector.setOnStateChange((state) => {
      if (state === "idle") {
        set({ showIdlePopup: true });
      } else if (state === "paused") {
        set({ showIdlePopup: false, isPaused: true });
        const running = timerEngine.getAllTimers().filter((t) => t.status === "running");
        for (const t of running) {
          timerEngine.pauseTimer(t.taskId);
        }
      } else if (state === "active") {
        set({ showIdlePopup: false, isPaused: false });
      }
    });

    idleDetector.start();
  },

  destroy: () => {
    idleDetector.stop();
  },

  startTimer: async (taskId, type = "work") => {
    const timer = await timerEngine.startTimer(taskId, type);
    set((state) => ({
      timers: [...state.timers.filter((t) => t.taskId !== taskId), timer],
    }));
    return timer;
  },

  pauseTimer: async (taskId) => {
    await timerEngine.pauseTimer(taskId);
    const timer = timerEngine.getTimer(taskId);
    if (timer) {
      set((state) => ({
        timers: state.timers.map((t) =>
          t.taskId === taskId ? timer : t,
        ),
      }));
    }
  },

  resumeTimer: async (taskId) => {
    await timerEngine.resumeTimer(taskId);
    const timer = timerEngine.getTimer(taskId);
    if (timer) {
      set((state) => ({
        timers: state.timers.map((t) =>
          t.taskId === taskId ? timer : t,
        ),
      }));
    }
  },

  stopTimer: async (taskId) => {
    await timerEngine.stopTimer(taskId);
    set((state) => ({
      timers: state.timers.filter((t) => t.taskId !== taskId),
    }));
  },

  discardTimer: (taskId) => {
    timerEngine.discardTimer(taskId);
    set((state) => ({
      timers: state.timers.filter((t) => t.taskId !== taskId),
    }));
  },

  getTimerState: (taskId) => {
    return timerEngine.getTimer(taskId);
  },

  getAllTimers: () => {
    return timerEngine.getAllTimers();
  },

  dismissIdlePopup: () => {
    set({ showIdlePopup: false });
  },
}));
