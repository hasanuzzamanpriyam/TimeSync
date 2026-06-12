# TimeSync Sub-project 4: ERP Integration + Sync + Admin

## Overview

Build the ERP sync engine, API service layer, and Admin settings UI for TimeSync. Enables offline-first task/time tracking with automatic synchronization to an ERP backend via REST API. Admin interface for ERP configuration and local user management.

## Architecture

### Sync Engine

```
src/services/sync/
├── queue.ts        ← SQLite-backed sync queue
├── manager.ts      ← SyncManager singleton
└── index.ts        ← barrel
```

#### Sync Queue Table

New migration `003_sync.sql`:

```sql
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

- `entity_type`: `'task'`, `'time_entry'`
- `action`: `'create'`, `'update'`, `'delete'`
- `status`: `pending` → `processing` → `completed` or `failed`
- Sequential processing (one item at a time to preserve operation order)

#### SyncManager Class

**API:**
- `enqueue(entityType, entityId, action, payload)` — add operation to queue
- `processQueue()` — iterate pending items, call ERP API, mark synced
- `start(intervalMs)` — begin periodic sync loop
- `stop()` — stop periodic sync
- `getPendingCount()` — number of unsynced items
- `getLastSyncTime()` — timestamp of last successful sync

**Callbacks:**
- `onSyncStart` — queue processing began
- `onSyncComplete` — all pending items processed
- `onItemProcessed(result)` — each item result
- `onSyncError(error)` — unrecoverable error

**Retry logic:**
- Exponential backoff: 1s → 5s → 15s
- Max 3 retries per item
- After 3 failures, status set to `failed`, item skipped
- User can manually retry failed items

**Online detection:**
- `navigator.onLine` for instant status
- Periodic ping to ERP base URL every 60s as health check
- On reconnect: auto-trigger `processQueue()`

### ERP API Services

```
src/services/api/
├── auth.ts              ← existing (login, refresh, logout)
├── tasks.ts             ← new
└── time-entries.ts      ← new
```

#### Tasks API (`src/services/api/tasks.ts`)

```ts
export const taskApi = {
  fetchTasks: (): Promise<Task[]>,
  pushTask: (task: Partial<Task>): Promise<Task>,
  updateTask: (id: number, data: Partial<Task>): Promise<Task>,
  deleteTask: (id: number): Promise<void>,
};
```

#### Time Entries API (`src/services/api/time-entries.ts`)

```ts
export const timeEntryApi = {
  pushTimeEntry: (entry: Partial<TimeEntry>): Promise<TimeEntry>,
  updateTimeEntry: (id: number, data: Partial<TimeEntry>): Promise<TimeEntry>,
};
```

All API functions use the shared Axios instance from `@/lib/api.ts` which handles JWT auth + refresh.

### Admin

```
src/features/admin/components/
├── AdminPage.tsx
├── ErpSettings.tsx
└── UserManagement.tsx
```

#### ERP Settings (`ErpSettings.tsx`)

- **Base URL** — text input, saved to secure storage via `secureStorage.set()`
- **Sync Interval** — number input (1-60 minutes), default 5
- **Test Connection** — button that pings `{baseUrl}/api/health` or similar
- **Manual Sync** — button that calls `syncManager.processQueue()`
- **Status** — shows last sync time, pending item count, connection status

#### User Management (`UserManagement.tsx`)

- **User List** — table from local `users` table with role badges
- **Create User** — dialog with username, email, password, role (Employee/Manager/Admin)
- **Edit User** — same dialog pre-filled
- **Delete User** — soft delete (`is_active = false`)
- **Roles**: Employee (default), Manager, Admin

#### Admin Page (`AdminPage.tsx`)

- Tabs: Settings | Users
- Protected by existing `AdminRoute`

### Data Flow

1. **Offline Create:** User creates task → saved to local SQLite → `syncManager.enqueue('task', id, 'create', data)`
2. **Online Sync:** SyncManager process loop picks up pending items → calls `taskApi.pushTask()` → receives ERP ID → updates local record's `erp_id` → marks item completed
3. **Update/Delete:** Same pattern — local change + queue entry → ERP sync updates ERP record
4. **ERP Config:** Stored in secure storage, loaded on app init by SyncManager

### Routes

- `/settings` — already exists under `AdminRoute`, swap placeholder for `AdminPage`

### Wire-up

In `App.tsx`:
- On mount: `syncManager.start(interval)` where interval comes from ERP settings
- On unmount: `syncManager.stop()`
- Online/offline event listeners trigger queue processing

### Dependencies

- No new npm packages needed. Uses existing `axios`, `@tauri-apps/plugin-sql`, and `secureStorage`.

### Error Handling

- Queue items with 3 failed retries are marked `failed` with `last_error` stored
- Admin UI shows failed items count and allows manual retry
- API errors during sync don't crash the app — SyncManager catches all errors
- Network errors during online operations fall back to local save + queue

## Files to Create/Modify

### New Files (8)
1. `src-tauri/db/migrations/003_sync.sql`
2. `src/services/api/tasks.ts`
3. `src/services/api/time-entries.ts`
4. `src/services/sync/queue.ts`
5. `src/services/sync/manager.ts`
6. `src/services/sync/index.ts`
7. `src/features/admin/components/ErpSettings.tsx`
8. `src/features/admin/components/UserManagement.tsx`
9. `src/features/admin/components/AdminPage.tsx`

### Modified Files (3)
10. `src-tauri/src/lib.rs` — register migration v3
11. `src/App.tsx` — init sync manager
12. `src/routes/index.tsx` — swap settings placeholder for AdminPage
