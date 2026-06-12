import { differenceInSeconds } from "date-fns";
import { TimeEntryType } from "@/types";
import { getDatabase } from "@/lib/db";

export interface TimerInstance {
  taskId: number;
  timeEntryId: number;
  type: TimeEntryType;
  startedAt: Date;
  pausedAt?: Date;
  status: "running" | "paused" | "stopped";
  totalSeconds: number;
}

type TimerTickCallback = (timer: TimerInstance) => void;

const STORAGE_KEY = "timesync_timers";

export class TimerEngine {
  private timers: Map<number, TimerInstance> = new Map();
  private intervals: Map<number, ReturnType<typeof setInterval>> = new Map();
  private onTick: TimerTickCallback | null = null;

  constructor() {
    this.loadFromStorage();
    this.recoverRunningTimers();
  }

  setOnTick(cb: TimerTickCallback) {
    this.onTick = cb;
  }

  getTimer(taskId: number): TimerInstance | undefined {
    return this.timers.get(taskId);
  }

  getAllTimers(): TimerInstance[] {
    return Array.from(this.timers.values());
  }

  async startTimer(
    taskId: number,
    type: TimeEntryType = "work",
  ): Promise<TimerInstance> {
    const existing = this.timers.get(taskId);
    if (existing && existing.status !== "stopped") {
      return existing;
    }

    const db = await getDatabase();
    const { useAuthStore } = await import("@/features/auth/store");
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error("User not authenticated");

    const now = new Date().toISOString();
    const result = await db.execute(
      `INSERT INTO time_entries (task_id, user_id, type, started_at, is_running, total_seconds)
       VALUES ($1, $2, $3, $4, 1, 0)`,
      [taskId, userId, type, now],
    );

    const timer: TimerInstance = {
      taskId,
      timeEntryId: result.lastInsertId!,
      type,
      startedAt: new Date(),
      status: "running",
      totalSeconds: 0,
    };

    this.timers.set(taskId, timer);
    this.startInterval(taskId);
    this.saveToStorage();

    return timer;
  }

  async pauseTimer(taskId: number): Promise<void> {
    const timer = this.timers.get(taskId);
    if (!timer || timer.status !== "running") return;

    this.stopInterval(taskId);
    timer.status = "paused";
    timer.pausedAt = new Date();
    timer.totalSeconds += differenceInSeconds(new Date(), timer.startedAt);

    const db = await getDatabase();
    await db.execute(
      `UPDATE time_entries SET paused_at = $1, total_seconds = $2, is_running = 0 WHERE id = $3`,
      [timer.pausedAt.toISOString(), timer.totalSeconds, timer.timeEntryId],
    );

    this.saveToStorage();
    this.onTick?.(timer);
  }

  async resumeTimer(taskId: number): Promise<void> {
    const timer = this.timers.get(taskId);
    if (!timer || timer.status !== "paused") return;

    timer.status = "running";
    timer.startedAt = new Date();

    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE time_entries SET resumed_at = $1, is_running = 1 WHERE id = $2`,
      [now, timer.timeEntryId],
    );

    this.startInterval(taskId);
    this.saveToStorage();
  }

  async stopTimer(taskId: number): Promise<TimerInstance> {
    const timer = this.timers.get(taskId);
    if (!timer) throw new Error("Timer not found");

    this.stopInterval(taskId);

    if (timer.status === "running") {
      timer.totalSeconds += differenceInSeconds(new Date(), timer.startedAt);
    }

    timer.status = "stopped";

    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE time_entries SET stopped_at = $1, total_seconds = $2, is_running = 0 WHERE id = $3`,
      [now, timer.totalSeconds, timer.timeEntryId],
    );

    this.timers.delete(taskId);
    this.saveToStorage();
    this.onTick?.(timer);

    return timer;
  }

  discardTimer(taskId: number): void {
    const timer = this.timers.get(taskId);
    if (!timer) return;
    this.stopInterval(taskId);
    this.timers.delete(taskId);
    this.saveToStorage();
  }

  private startInterval(taskId: number) {
    this.stopInterval(taskId);
    const interval = setInterval(() => {
      const timer = this.timers.get(taskId);
      if (!timer || timer.status !== "running") return;

      timer.totalSeconds =
        (timer.totalSeconds ?? 0) +
        differenceInSeconds(new Date(), timer.startedAt);
      timer.startedAt = new Date();

      this.saveToStorage();
      this.onTick?.(timer);
    }, 1000);
    this.intervals.set(taskId, interval);
  }

  private stopInterval(taskId: number) {
    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }
  }

  private saveToStorage() {
    try {
      const data = Array.from(this.timers.values()).map((t) => ({
        taskId: t.taskId,
        timeEntryId: t.timeEntryId,
        type: t.type,
        startedAt: t.startedAt.toISOString(),
        pausedAt: t.pausedAt?.toISOString(),
        status: t.status,
        totalSeconds: t.totalSeconds,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage quota exceeded, ignore
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const item of data) {
        this.timers.set(item.taskId, {
          taskId: item.taskId,
          timeEntryId: item.timeEntryId,
          type: item.type,
          startedAt: new Date(item.startedAt),
          pausedAt: item.pausedAt ? new Date(item.pausedAt) : undefined,
          status: item.status,
          totalSeconds: item.totalSeconds,
        });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private async recoverRunningTimers() {
    for (const [taskId, timer] of this.timers) {
      if (timer.status === "running") {
        timer.totalSeconds += differenceInSeconds(new Date(), timer.startedAt);
        timer.startedAt = new Date();

        const db = await getDatabase();
        try {
          await db.execute(
            `UPDATE time_entries SET total_seconds = $1 WHERE id = $2`,
            [timer.totalSeconds, timer.timeEntryId],
          );
        } catch {
          // db may not be ready yet
        }

        this.startInterval(taskId);
      }
    }
  }
}

export const timerEngine = new TimerEngine();
