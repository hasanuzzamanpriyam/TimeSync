# TimeSync Sub-project 4: ERP Integration + Sync + Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ERP sync engine (SQLite-backed queue + SyncManager), API service layer (tasks, time-entries), and Admin UI (ERP config, user management).

**Architecture:** SyncManager singleton with SQLite-backed queue, sequential processing with exponential backoff. API services use existing Axios instance. Admin UI under existing AdminRoute.

**Tech Stack:** React 18, TypeScript, SQLite via `@tauri-apps/plugin-sql`, Axios, ShadCN UI, lucide-react

---

### Task 1: Database Migration + Rust Update

**Files:**
- Create: `src-tauri/db/migrations/003_sync.sql`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `src-tauri/db/migrations/003_sync.sql`**

```sql
-- Migration v3: Sync queue table for offline-to-ERP sync

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

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
```

- [ ] **Step 2: Read `src-tauri/src/lib.rs` and add migration v3**

Read the existing file and add a new entry in the `add_migration` calls:

```rust
// After the v2 migration
.add_migration("003_sync", include_str!("../db/migrations/003_sync.sql"))
```

- [ ] **Step 3: TypeScript check** (Rust changes don't affect TS)

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src-tauri/db/migrations/003_sync.sql src-tauri/src/lib.rs
git commit -m "feat: add sync_queue migration v3"
```

---

### Task 2: Create Sync Queue Module

**Files:**
- Create: `src/services/sync/queue.ts`
- Create: `src/services/sync/index.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p C:\Users\CT\Desktop\Tracker\src\services\sync`

- [ ] **Step 2: Create `src/services/sync/queue.ts`**

```ts
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
```

- [ ] **Step 3: Create `src/services/sync/index.ts`**

```ts
export { syncQueue } from "./queue";
export type { SyncQueueItem, SyncAction, SyncEntityType, SyncStatus } from "./queue";
export { syncManager } from "./manager";
```

- [ ] **Step 4: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/services/sync/
git commit -m "feat: add sync queue module"
```

---

### Task 3: Create ERP API Services

**Files:**
- Create: `src/services/api/tasks.ts`
- Create: `src/services/api/time-entries.ts`

- [ ] **Step 1: Create `src/services/api/tasks.ts`**

```ts
import api from "@/lib/api";
import { Task } from "@/types";

export const taskApi = {
  async fetchTasks(): Promise<Task[]> {
    const response = await api.get<Task[]>("/tasks");
    return response.data;
  },

  async pushTask(task: Partial<Task>): Promise<Task> {
    const response = await api.post<Task>("/tasks", task);
    return response.data;
  },

  async updateTask(id: number, data: Partial<Task>): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}`, data);
    return response.data;
  },

  async deleteTask(id: number): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },
};
```

- [ ] **Step 2: Create `src/services/api/time-entries.ts`**

```ts
import api from "@/lib/api";
import { TimeEntry } from "@/types";

export const timeEntryApi = {
  async pushTimeEntry(entry: Partial<TimeEntry>): Promise<TimeEntry> {
    const response = await api.post<TimeEntry>("/time-entries", entry);
    return response.data;
  },

  async updateTimeEntry(id: number, data: Partial<TimeEntry>): Promise<TimeEntry> {
    const response = await api.put<TimeEntry>(`/time-entries/${id}`, data);
    return response.data;
  },
};
```

- [ ] **Step 3: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/services/api/tasks.ts src/services/api/time-entries.ts
git commit -m "feat: add ERP API services (tasks, time-entries)"
```

---

### Task 4: Create SyncManager

**Files:**
- Create: `src/services/sync/manager.ts`
- Modify: `src/services/sync/index.ts`

- [ ] **Step 1: Read `src/services/sync/queue.ts` to confirm the queue API, then create `src/services/sync/manager.ts`**

```ts
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
```

- [ ] **Step 2: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/services/sync/manager.ts
git commit -m "feat: add SyncManager with queue processing and retry"
```

---

### Task 5: Create Admin UI Components

**Files:**
- Create: `src/features/admin/components/ErpSettings.tsx`
- Create: `src/features/admin/components/UserManagement.tsx`
- Create: `src/features/admin/components/AdminPage.tsx`

- [ ] **Step 1: Create directory**

Run: `mkdir -p C:\Users\CT\Desktop\Tracker\src\features\admin\components`

- [ ] **Step 2: Create `src/features/admin/components/ErpSettings.tsx`**

```tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncManager } from "@/services/sync";
import { secureStorage } from "@/services/storage/secure";
import { Wifi, WifiOff, RefreshCw, Clock, HardDrive } from "lucide-react";

export function ErpSettings() {
  const [baseUrl, setBaseUrl] = useState("");
  const [syncInterval, setSyncInterval] = useState(5);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    secureStorage.get("erp_base_url").then((url) => { if (url) setBaseUrl(url as string); });
    secureStorage.get("erp_sync_interval").then((val) => { if (val) setSyncInterval(val as number); });
    updateStatus();

    const onlineHandler = () => setIsOnline(true);
    const offlineHandler = () => setIsOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    const statusInterval = setInterval(updateStatus, 5000);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      clearInterval(statusInterval);
    };
  }, []);

  const updateStatus = async () => {
    setPendingCount(await syncManager.getPendingCount());
    setLastSync(await syncManager.getLastSyncTime());
  };

  const handleSave = async () => {
    await secureStorage.set("erp_base_url", baseUrl);
    await secureStorage.set("erp_sync_interval", syncInterval);
    syncManager.stop();
    syncManager.start(syncInterval * 60 * 1000);
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { method: "GET", signal: AbortSignal.timeout(5000) });
      setTestResult(response.ok ? "Connected" : "Failed: " + response.statusText);
    } catch (err: any) {
      setTestResult("Error: " + (err?.message ?? "Unknown"));
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    await syncManager.processQueue();
    setIsSyncing(false);
    updateStatus();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>ERP Connection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="erp-url">Base URL</Label>
            <Input id="erp-url" placeholder="https://erp.example.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sync-interval">Sync Interval (minutes)</Label>
            <Input id="sync-interval" type="number" min="1" max="60" value={syncInterval} onChange={(e) => setSyncInterval(parseInt(e.target.value) || 5)} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave}>Save Settings</Button>
            <Button variant="outline" onClick={handleTestConnection}>Test Connection</Button>
            {testResult && <span className={`text-sm ${testResult === "Connected" ? "text-green-600" : "text-destructive"}`}>{testResult}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sync Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-destructive" />}
            <span>{isOnline ? "Online" : "Offline"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span>Pending: {pendingCount} items</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Last sync: {lastSync ? new Date(lastSync).toLocaleString() : "Never"}</span>
          </div>
          <Button variant="outline" onClick={handleSyncNow} disabled={isSyncing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/features/admin/components/UserManagement.tsx`**

```tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getDatabase } from "@/lib/db";
import { Plus, Pen, Trash2 } from "lucide-react";

interface LocalUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export function UserManagement() {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<LocalUser | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");

  const fetchUsers = async () => {
    const db = await getDatabase();
    const rows = await db.select<Record<string, any>[]>(
      "SELECT id, username, email, role, is_active FROM users ORDER BY id",
    );
    setUsers(rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      role: r.role,
      is_active: r.is_active,
    })));
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("employee");
    setShowForm(true);
  };

  const openEdit = (u: LocalUser) => {
    setEditUser(u);
    setUsername(u.username);
    setEmail(u.email);
    setPassword("");
    setRole(u.role);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDatabase();
    if (editUser) {
      if (password) {
        await db.execute(
          "UPDATE users SET username = $1, email = $2, role = $3, password_hash = $4 WHERE id = $5",
          [username, email, role, password, editUser.id],
        );
      } else {
        await db.execute(
          "UPDATE users SET username = $1, email = $2, role = $3 WHERE id = $4",
          [username, email, role, editUser.id],
        );
      }
    } else {
      await db.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        [username, email, password, role],
      );
    }
    setShowForm(false);
    fetchUsers();
  };

  const handleDelete = async (id: number) => {
    const db = await getDatabase();
    await db.execute("UPDATE users SET is_active = 0 WHERE id = $1", [id]);
    fetchUsers();
  };

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    employee: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Users</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add User</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleColors[u.role]}>{u.role}</Badge>
                </TableCell>
                <TableCell>{u.is_active ? "Active" : "Inactive"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pen className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uname">Username</Label>
              <Input id="uname" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uemail">Email</Label>
              <Input id="uemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upass">{editUser ? "New Password (leave blank to keep)" : "Password"}</Label>
              <Input id="upass" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required={!editUser} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">{editUser ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

- [ ] **Step 4: Create `src/features/admin/components/AdminPage.tsx`**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErpSettings } from "@/features/admin/components/ErpSettings";
import { UserManagement } from "@/features/admin/components/UserManagement";

export function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Settings</h1>
      <Tabs defaultValue="erp">
        <TabsList>
          <TabsTrigger value="erp">ERP Settings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="erp" className="mt-4">
          <ErpSettings />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 5: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/features/admin/
git commit -m "feat: add admin UI (ERP settings, user management)"
```

---

### Task 6: Wire Up in App and Routes

**Files:**
- Modify: `src/App.tsx` — init SyncManager
- Modify: `src/routes/index.tsx` — swap settings placeholder for AdminPage

- [ ] **Step 1: Read and modify `src/App.tsx`**

Read `C:\Users\CT\Desktop\Tracker\src\App.tsx`. Add import for `syncManager` and initialize it in a `useEffect`:

Add import:
```tsx
import { syncManager } from "@/services/sync";
```

Add this `useEffect` after the timer init effect:
```tsx
useEffect(() => {
  const initSync = async () => {
    const interval = (await import("@/services/storage/secure"))
      .secureStorage.get("erp_sync_interval") as number | undefined;
    syncManager.start((interval ?? 5) * 60 * 1000);
  };
  initSync();
  return () => syncManager.stop();
}, []);
```

- [ ] **Step 2: Read and modify `src/routes/index.tsx`**

Read `C:\Users\CT\Desktop\Tracker\src\routes\index.tsx`. Add import:
```tsx
import { AdminPage } from "@/features/admin/components/AdminPage";
```

Remove the inline `SettingsPage` function. Replace:
```tsx
{
  path: "settings",
  element: <SettingsPage />,
},
```
with:
```tsx
{
  path: "settings",
  element: <AdminPage />,
},
```

- [ ] **Step 3: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Build**

Run: `cd C:\Users\CT\Desktop\Tracker && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/App.tsx src/routes/index.tsx
git commit -m "feat: wire SyncManager and admin routes"
```

---

### Task 7: Push to Remote

- [ ] **Step 1: Push**

```bash
cd C:\Users\CT\Desktop\Tracker
git push
```
Expected: All commits pushed to `origin/main`
