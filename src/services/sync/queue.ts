import { getDatabase } from "@/lib/db";

export type SyncAction = "create" | "update" | "delete";
export type SyncEntityType = "task" | "time_entry";
export type SyncStatus = "pending" | "processing" | "completed" | "failed";

export interface SyncQueueItem {
  id: number;
  entity_type: SyncEntityType;
  entity_id: number | null;
  action: SyncAction;
  payload: string;
  status: SyncStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const syncQueue = {
  async enqueue(
    entityType: SyncEntityType,
    entityId: number | null,
    action: SyncAction,
    payload: Record<string, any>,
  ): Promise<number> {
    const db = await getDatabase();
    const result = await db.execute(
      `INSERT INTO sync_queue (entity_type, entity_id, action, payload, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [entityType, entityId, action, JSON.stringify(payload)],
    );
    return result.lastInsertId!;
  },

  async getPending(): Promise<SyncQueueItem[]> {
    const db = await getDatabase();
    return db.select<SyncQueueItem[]>(
      `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY id ASC`,
    );
  },

  async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed')`,
    );
    return rows[0]?.count ?? 0;
  },

  async markProcessing(id: number): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE sync_queue SET status = 'processing', updated_at = datetime('now') WHERE id = $1`,
      [id],
    );
  },

  async markCompleted(id: number): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE sync_queue SET status = 'completed', updated_at = datetime('now') WHERE id = $1`,
      [id],
    );
  },

  async markFailed(id: number, error: string): Promise<void> {
    const db = await getDatabase();
    const item = await db.select<SyncQueueItem[]>(
      `SELECT * FROM sync_queue WHERE id = $1`,
      [id],
    );
    const retryCount = (item[0]?.retry_count ?? 0) + 1;
    await db.execute(
      `UPDATE sync_queue SET status = 'failed', retry_count = $1, last_error = $2, updated_at = datetime('now') WHERE id = $3`,
      [retryCount, error, id],
    );
  },

  async markFailedFinal(id: number, error: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE sync_queue SET status = 'failed', last_error = $1, updated_at = datetime('now') WHERE id = $2`,
      [error, id],
    );
  },

  async getLastSyncTime(): Promise<string | null> {
    const db = await getDatabase();
    const rows = await db.select<{ updated_at: string }[]>(
      `SELECT updated_at FROM sync_queue WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 1`,
    );
    return rows[0]?.updated_at ?? null;
  },
};
