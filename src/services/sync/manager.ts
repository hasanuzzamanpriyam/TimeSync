import { syncQueue, SyncQueueItem } from "@/services/sync/queue";
import { taskApi } from "@/services/api/tasks";
import { timeEntryApi } from "@/services/api/time-entries";

type SyncEventName = "sync-start" | "sync-complete" | "item-processed" | "sync-error";
type SyncEventHandler = (data?: any) => void;

const RETRY_DELAYS = [1000, 5000, 15000];
const MAX_RETRIES = 3;

class SyncManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private listeners = new Map<SyncEventName, Set<SyncEventHandler>>();

  on(event: SyncEventName, handler: SyncEventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: SyncEventName, handler: SyncEventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: SyncEventName, data?: any) {
    this.listeners.get(event)?.forEach((h) => h(data));
  }

  async enqueue(
    entityType: "task" | "time_entry",
    entityId: number | null,
    action: "create" | "update" | "delete",
    payload: Record<string, any>,
  ): Promise<void> {
    await syncQueue.enqueue(entityType, entityId, action, payload);
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.emit("sync-start");

    try {
      const items = await syncQueue.getPending();
      for (const item of items) {
        if (item.retry_count >= MAX_RETRIES) {
          await syncQueue.markFailedFinal(item.id, item.last_error ?? "Max retries exceeded");
          this.emit("item-processed", { item, status: "failed" });
          continue;
        }

        await syncQueue.markProcessing(item.id);
        await this.delay(RETRY_DELAYS[item.retry_count] ?? 15000);

        try {
          await this.processItem(item);
          await syncQueue.markCompleted(item.id);
          this.emit("item-processed", { item, status: "completed" });
        } catch (err: any) {
          await syncQueue.markFailed(item.id, err?.message ?? "Unknown error");
          this.emit("item-processed", { item, status: "failed", error: err?.message });
        }
      }

      this.emit("sync-complete");
    } catch (err: any) {
      this.emit("sync-error", err?.message);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(item.payload);

    switch (item.entity_type) {
      case "task":
        switch (item.action) {
          case "create":
            await taskApi.pushTask(payload);
            break;
          case "update":
            await taskApi.updateTask(item.entity_id!, payload);
            break;
          case "delete":
            await taskApi.deleteTask(item.entity_id!);
            break;
        }
        break;

      case "time_entry":
        switch (item.action) {
          case "create":
            await timeEntryApi.pushTimeEntry(payload);
            break;
          case "update":
            await timeEntryApi.updateTimeEntry(item.entity_id!, payload);
            break;
        }
        break;
    }
  }

  async start(intervalMs: number = 300000): Promise<void> {
    this.stop();

    window.addEventListener("online", this.handleOnline);

    // Process immediately on start
    await this.processQueue();

    // Then periodically
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    window.removeEventListener("online", this.handleOnline);
  }

  private handleOnline = () => {
    this.processQueue();
  };

  async getPendingCount(): Promise<number> {
    return syncQueue.getPendingCount();
  }

  async getLastSyncTime(): Promise<string | null> {
    return syncQueue.getLastSyncTime();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const syncManager = new SyncManager();
