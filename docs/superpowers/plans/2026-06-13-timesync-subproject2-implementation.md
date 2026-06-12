# TimeSync Sub-project 2: Task & Time Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add task management CRUD and parallel time tracking with idle detection and activity logging.

**Architecture:** New SQLite tables for tasks, time_entries, activity_logs. TimerEngine class manages parallel timers with 1s display ticks. IdleDetector service monitors DOM events. Zustand stores for task and timer state.

**Tech Stack:** React 18, TypeScript, Zustand, SQLite, date-fns, ShadCN UI

**Spec reference:** `docs/superpowers/specs/2026-06-13-timesync-subproject2-design.md`

---

### Task 1: Add New Database Migration

**Files:**
- Create: `src-tauri/db/migrations/002_tasks_timer.sql`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create migration SQL**

`src-tauri/db/migrations/002_tasks_timer.sql`:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  erp_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES projects(id),
  assigned_to INTEGER REFERENCES users(id),
  priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','on_hold','completed','cancelled')),
  estimated_minutes INTEGER,
  erp_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'work' CHECK(type IN ('work','break')),
  started_at TEXT NOT NULL,
  paused_at TEXT,
  resumed_at TEXT,
  stopped_at TEXT,
  total_seconds INTEGER DEFAULT 0,
  is_running INTEGER DEFAULT 0,
  erp_synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  keyboard_count INTEGER DEFAULT 0,
  mouse_count INTEGER DEFAULT 0,
  idle_seconds INTEGER DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Update lib.rs to include the new migration**

Read `src-tauri/src/lib.rs` and update the `run()` function to add the second migration:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../db/migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create tasks, time_entries, activity_logs tables",
            sql: include_str!("../db/migrations/002_tasks_timer.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:timesync.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify Rust compiles** (if cargo is available)

```bash
cd src-tauri
cargo check
```

---

### Task 2: Add TypeScript Types and npm Dependency

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Install date-fns**

```bash
npm install date-fns
```

- [ ] **Step 2: Add new types**

Update `src/types/index.ts`:

```ts
export type UserRole = "employee" | "manager" | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  erp_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_remember_me: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  expires_in: number;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "pending" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type TimeEntryType = "work" | "break";
export type TimerStatus = "running" | "paused" | "stopped";

export interface Project {
  id: number;
  name: string;
  description?: string;
  erp_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  project_id?: number;
  assigned_to?: number;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_minutes?: number;
  erp_id?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  type: TimeEntryType;
  started_at: string;
  paused_at?: string;
  resumed_at?: string;
  stopped_at?: string;
  total_seconds: number;
  is_running: boolean;
  erp_synced: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: number;
  keyboard_count: number;
  mouse_count: number;
  idle_seconds: number;
  recorded_at: string;
}
```

---

### Task 3: Create Task Zustand Store

**Files:**
- Create: `src/features/tasks/store.ts`

- [ ] **Step 1: Create the task store**

`src/features/tasks/store.ts`:

```ts
import { create } from "zustand";
import { Task, TaskPriority, TaskStatus } from "@/types";
import { getDatabase } from "@/lib/db";

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: number;
  search?: string;
}

interface TaskState {
  tasks: Task[];
  filters: TaskFilters;
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  createTask: (task: Omit<Task, "id" | "created_at" | "updated_at">) => Promise<Task>;
  updateTask: (id: number, task: Partial<Task>) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  setFilters: (filters: TaskFilters) => void;
  getFilteredTasks: () => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  filters: {},
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const rows = await db.select<Record<string, any>[]>(
        "SELECT * FROM tasks ORDER BY created_at DESC",
      );
      const tasks: Task[] = rows.map((r: Record<string, any>) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? undefined,
        project_id: r.project_id ?? undefined,
        assigned_to: r.assigned_to ?? undefined,
        priority: r.priority as TaskPriority,
        status: r.status as TaskStatus,
        estimated_minutes: r.estimated_minutes ?? undefined,
        erp_id: r.erp_id ?? undefined,
        created_by: r.created_by ?? undefined,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
      set({ tasks, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || "Failed to fetch tasks", isLoading: false });
    }
  },

  createTask: async (taskData) => {
    const db = await getDatabase();
    const { useAuthStore } = await import("@/features/auth/store");
    const userId = useAuthStore.getState().user?.id;

    const result = await db.execute(
      `INSERT INTO tasks (title, description, project_id, assigned_to, priority, status, estimated_minutes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        taskData.title,
        taskData.description ?? null,
        taskData.project_id ?? null,
        taskData.assigned_to ?? null,
        taskData.priority,
        taskData.status || "pending",
        taskData.estimated_minutes ?? null,
        userId ?? null,
      ],
    );

    const newTask: Task = {
      id: result.lastInsertId,
      ...taskData,
      status: taskData.status || "pending",
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({ tasks: [newTask, ...state.tasks] }));
    return newTask;
  },

  updateTask: async (id, taskData) => {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (taskData.title !== undefined) { fields.push("title = $1"); values.push(taskData.title); }
    if (taskData.description !== undefined) { fields.push("description = $"+(fields.length+1)); values.push(taskData.description); }
    if (taskData.priority !== undefined) { fields.push("priority = $"+(fields.length+1)); values.push(taskData.priority); }
    if (taskData.status !== undefined) { fields.push("status = $"+(fields.length+1)); values.push(taskData.status); }
    if (taskData.project_id !== undefined) { fields.push("project_id = $"+(fields.length+1)); values.push(taskData.project_id); }
    if (taskData.assigned_to !== undefined) { fields.push("assigned_to = $"+(fields.length+1)); values.push(taskData.assigned_to); }
    if (taskData.estimated_minutes !== undefined) { fields.push("estimated_minutes = $"+(fields.length+1)); values.push(taskData.estimated_minutes); }

    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");

    await db.execute(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${fields.length + 1}`,
      [...values, id],
    );

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...taskData, updated_at: new Date().toISOString() } : t,
      ),
    }));
  },

  deleteTask: async (id) => {
    const db = await getDatabase();
    await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  setFilters: (filters) => set({ filters }),

  getFilteredTasks: () => {
    const { tasks, filters } = get();
    return tasks.filter((t) => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.project_id && t.project_id !== filters.project_id) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(s) && !t.description?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  },
}));
```

---

### Task 4: Create Task UI Components

**Files:**
- Create: `src/features/tasks/components/TaskList.tsx`
- Create: `src/features/tasks/components/TaskCard.tsx`
- Create: `src/features/tasks/components/TaskForm.tsx`
- Create: `src/features/tasks/components/TaskDetail.tsx`

- [ ] **Step 1: Create TaskCard**

`src/features/tasks/components/TaskCard.tsx`:

```tsx
import { Task } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = {
  low: "bg-slate-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  on_hold: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

interface TaskCardProps {
  task: Task;
  onStartTimer?: (taskId: number) => void;
  onClick?: () => void;
}

export function TaskCard({ task, onStartTimer, onClick }: TaskCardProps) {
  return (
    <Card
      className={cn("cursor-pointer hover:shadow-md transition-shadow", onClick && "cursor-pointer")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold truncate flex-1">{task.title}</h3>
          <div className="flex items-center gap-2 ml-2">
            <Badge className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>
            <Badge variant="outline" className={statusColors[task.status]}>
              {task.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
        )}
        {task.estimated_minutes && (
          <p className="text-xs text-muted-foreground mt-2">
            Estimated: {task.estimated_minutes}m
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create TaskForm**

`src/features/tasks/components/TaskForm.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTaskStore } from "@/features/tasks/store";
import { TaskPriority, TaskStatus, Task } from "@/types";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTask?: Task | null;
}

export function TaskForm({ open, onOpenChange, editTask }: TaskFormProps) {
  const { createTask, updateTask } = useTaskStore();
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [description, setDescription] = useState(editTask?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(editTask?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(editTask?.status ?? "pending");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    editTask?.estimated_minutes?.toString() ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editTask) {
        await updateTask(editTask.id, {
          title,
          description: description || undefined,
          priority,
          status,
          estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
        });
      } else {
        await createTask({
          title,
          description: description || undefined,
          priority,
          status,
          estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
        });
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editTask ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="est">Estimated (minutes)</Label>
            <Input id="est" type="number" min="0" value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editTask ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create TaskList**

`src/features/tasks/components/TaskList.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useTaskStore } from "@/features/tasks/store";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskForm } from "@/features/tasks/components/TaskForm";
import { TaskDetail } from "@/features/tasks/components/TaskDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskPriority, TaskStatus, Task } from "@/types";

export function TaskList() {
  const { tasks, fetchTasks, setFilters, getFilteredTasks } = useTaskStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = getFilteredTasks();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Task
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFilters({ search: e.target.value });
            }}
          />
        </div>
        <Select onValueChange={(v) => setFilters({ status: v as TaskStatus || undefined })}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => setFilters({ priority: v as TaskPriority || undefined })}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {filtered.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => setSelectedTask(task)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No tasks found.</p>
        )}
      </div>

      <TaskForm open={showForm} onOpenChange={setShowForm} />
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create TaskDetail**

`src/features/tasks/components/TaskDetail.tsx`:

```tsx
import { useState } from "react";
import { Task } from "@/types";
import { useTaskStore } from "@/features/tasks/store";
import { useTimerStore } from "@/features/timer/store";
import { TaskForm } from "@/features/tasks/components/TaskForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Play, Pause, Square, Pen, Trash2 } from "lucide-react";

interface TaskDetailProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetail({ task, open, onOpenChange }: TaskDetailProps) {
  const { updateTask, deleteTask } = useTaskStore();
  const { startTimer, pauseTimer, resumeTimer, stopTimer, getTimerState } = useTimerStore();
  const [showEdit, setShowEdit] = useState(false);

  const timerState = getTimerState(task.id);
  const isRunning = timerState?.status === "running";
  const isPaused = timerState?.status === "paused";

  const handleDelete = async () => {
    if (confirm("Delete this task?")) {
      await deleteTask(task.id);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {task.title}
              <Badge variant="outline">{task.priority}</Badge>
              <Badge variant="outline">{task.status.replace("_", " ")}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            {task.estimated_minutes && (
              <p className="text-sm">Estimated: {task.estimated_minutes} minutes</p>
            )}
            <div className="flex items-center gap-2">
              {!isRunning && !isPaused && (
                <Button size="sm" onClick={() => startTimer(task.id)}>
                  <Play className="mr-1 h-4 w-4" /> Start
                </Button>
              )}
              {isRunning && (
                <Button size="sm" variant="secondary" onClick={() => pauseTimer(task.id)}>
                  <Pause className="mr-1 h-4 w-4" /> Pause
                </Button>
              )}
              {isPaused && (
                <Button size="sm" onClick={() => resumeTimer(task.id)}>
                  <Play className="mr-1 h-4 w-4" /> Resume
                </Button>
              )}
              {(isRunning || isPaused) && (
                <Button size="sm" variant="destructive" onClick={() => stopTimer(task.id)}>
                  <Square className="mr-1 h-4 w-4" /> Stop
                </Button>
              )}
            </div>
            {timerState && (
              <p className="text-2xl font-mono font-bold">
                {formatSeconds(timerState.totalSeconds)}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pen className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showEdit && (
        <TaskForm
          open={showEdit}
          onOpenChange={setShowEdit}
          editTask={task}
        />
      )}
    </>
  );
}

function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
```

---

### Task 5: Create Timer Engine

**Files:**
- Create: `src/features/timer/engine.ts`

- [ ] **Step 1: Create the TimerEngine class**

`src/features/timer/engine.ts`:

```ts
import { TimerStatus } from "@/types";

export interface TimerState {
  taskId: number;
  status: TimerStatus;
  totalSeconds: number;
  startedAt: number;
  lastResumedAt: number | null;
  type: "work" | "break";
}

type TimerListener = (state: Map<number, TimerState>) => void;

const STORAGE_KEY = "timesync-active-timers";

class TimerEngine {
  private timers: Map<number, TimerState> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<TimerListener> = new Set();

  constructor() {
    this.restoreFromStorage();
  }

  private restoreFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as [number, TimerState][];
        this.timers = new Map(data);
      }
    } catch {}
  }

  private persistToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.timers]));
    } catch {}
  }

  private ensureTick() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      const now = Date.now();
      for (const [id, state] of this.timers) {
        if (state.status === "running" && state.lastResumedAt) {
          state.totalSeconds = Math.floor((now - state.lastResumedAt) / 1000) +
            (state.totalSeconds - Math.floor((state.lastResumedAt - state.startedAt) / 1000));
        }
      }
      this.notify();
    }, 1000);
  }

  private stopTick() {
    if (this.timers.size === 0 && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.timers));
  }

  subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener);
    listener(this.timers);
    return () => this.listeners.delete(listener);
  }

  start(taskId: number, type: "work" | "break" = "work"): TimerState {
    const now = Date.now();
    const state: TimerState = {
      taskId,
      status: "running",
      totalSeconds: 0,
      startedAt: now,
      lastResumedAt: now,
      type,
    };
    this.timers.set(taskId, state);
    this.ensureTick();
    this.persistToStorage();
    this.notify();
    return state;
  }

  pause(taskId: number): TimerState | null {
    const state = this.timers.get(taskId);
    if (!state || state.status !== "running") return null;
    const now = Date.now();
    if (state.lastResumedAt) {
      state.totalSeconds += Math.floor((now - state.lastResumedAt) / 1000);
    }
    state.status = "paused";
    state.lastResumedAt = null;
    this.persistToStorage();
    this.notify();
    return state;
  }

  resume(taskId: number): TimerState | null {
    const state = this.timers.get(taskId);
    if (!state || state.status !== "paused") return null;
    state.status = "running";
    state.lastResumedAt = Date.now();
    this.persistToStorage();
    this.notify();
    return state;
  }

  stop(taskId: number): { totalSeconds: number; startedAt: number } | null {
    const state = this.timers.get(taskId);
    if (!state) return null;
    const now = Date.now();
    if (state.status === "running" && state.lastResumedAt) {
      state.totalSeconds += Math.floor((now - state.lastResumedAt) / 1000);
    }
    const result = { totalSeconds: state.totalSeconds, startedAt: state.startedAt };
    this.timers.delete(taskId);
    this.persistToStorage();
    this.stopTick();
    this.notify();
    return result;
  }

  pauseAll(): void {
    for (const [id] of this.timers) {
      this.pause(id);
    }
  }

  getState(taskId: number): TimerState | undefined {
    return this.timers.get(taskId);
  }

  getAllStates(): Map<number, TimerState> {
    return new Map(this.timers);
  }

  getActiveCount(): number {
    let count = 0;
    for (const state of this.timers.values()) {
      if (state.status === "running") count++;
    }
    return count;
  }
}

export const timerEngine = new TimerEngine();
```

---

### Task 6: Create Timer Zustand Store

**Files:**
- Create: `src/features/timer/store.ts`

- [ ] **Step 1: Create the timer store**

`src/features/timer/store.ts`:

```ts
import { create } from "zustand";
import { timerEngine, TimerState } from "@/features/timer/engine";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface TimerStoreState {
  activeTimers: Map<number, TimerState>;
  subscribe: () => () => void;
  startTimer: (taskId: number, type?: "work" | "break") => Promise<void>;
  pauseTimer: (taskId: number) => Promise<void>;
  resumeTimer: (taskId: number) => Promise<void>;
  stopTimer: (taskId: number) => Promise<void>;
  pauseAllTimers: () => Promise<void>;
  getTimerState: (taskId: number) => TimerState | undefined;
}

async function saveTimeEntry(
  taskId: number,
  type: "work" | "break",
  action: "start" | "pause" | "resume" | "stop",
  totalSeconds?: number,
  startedAt?: number,
) {
  const user = useAuthStore.getState().user;
  if (!user) return;

  const db = await getDatabase();

  if (action === "start") {
    await db.execute(
      `INSERT INTO time_entries (task_id, user_id, type, started_at, is_running)
       VALUES ($1, $2, $3, datetime('now'), 1)`,
      [taskId, user.id, type],
    );
  } else if (action === "pause") {
    await db.execute(
      `UPDATE time_entries SET paused_at = datetime('now'), is_running = 0
       WHERE task_id = $1 AND is_running = 1`,
      [taskId],
    );
  } else if (action === "stop") {
    await db.execute(
      `UPDATE time_entries SET stopped_at = datetime('now'), total_seconds = $2, is_running = 0
       WHERE task_id = $1 AND is_running = 1`,
      [taskId, totalSeconds ?? 0],
    );
  }
}

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  activeTimers: new Map(),

  subscribe: () => {
    return timerEngine.subscribe((timers) => {
      set({ activeTimers: new Map(timers) });
    });
  },

  startTimer: async (taskId, type = "work") => {
    timerEngine.start(taskId, type);
    await saveTimeEntry(taskId, type, "start");
  },

  pauseTimer: async (taskId) => {
    timerEngine.pause(taskId);
    await saveTimeEntry(taskId, "work", "pause");
  },

  resumeTimer: async (taskId) => {
    timerEngine.resume(taskId);
    await saveTimeEntry(taskId, "work", "resume");
  },

  stopTimer: async (taskId) => {
    const result = timerEngine.stop(taskId);
    if (result) {
      await saveTimeEntry(taskId, "work", "stop", result.totalSeconds, result.startedAt);
    }
  },

  pauseAllTimers: async () => {
    timerEngine.pauseAll();
    const { activeTimers } = get();
    for (const [taskId] of activeTimers) {
      await saveTimeEntry(taskId, "work", "pause");
    }
  },

  getTimerState: (taskId) => timerEngine.getState(taskId),
}));
```

---

### Task 7: Create Idle Detector

**Files:**
- Create: `src/features/timer/idle-detector.ts`

- [ ] **Step 1: Create the idle detection service**

`src/features/timer/idle-detector.ts`:

```ts
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const AUTO_PAUSE_AFTER_MS = 2 * 60 * 1000;
const ACTIVITY_LOG_INTERVAL_MS = 5 * 60 * 1000;

type IdleStatus = "active" | "idle_popup" | "idle_auto_paused";

type IdleListener = (status: IdleStatus, idleSeconds: number) => void;

class IdleDetector {
  private lastActivity = Date.now();
  private idlePopupShown = false;
  private idleAutoPaused = false;
  private keyboardCount = 0;
  private mouseCount = 0;
  private lastLogTime = Date.now();
  private checkIntervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<IdleListener> = new Set();
  private status: IdleStatus = "active";

  subscribe(listener: IdleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start() {
    const events = ["mousemove", "mousedown", "keydown", "click", "scroll", "touchstart"];

    const onActivity = (e: Event) => {
      this.lastActivity = Date.now();
      this.idlePopupShown = false;
      this.idleAutoPaused = false;

      if (e.type === "keydown") {
        this.keyboardCount++;
      } else if (e.type.startsWith("mouse") || e.type === "scroll") {
        this.mouseCount++;
      }

      if (this.status !== "active") {
        this.status = "active";
        this.notify();
      }
    };

    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    this.checkIntervalId = setInterval(() => {
      this.checkIdle();
      this.maybeLogActivity();
    }, 5000);
  }

  stop() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  private checkIdle() {
    const elapsed = Date.now() - this.lastActivity;

    if (elapsed < IDLE_THRESHOLD_MS) {
      if (this.status !== "active") {
        this.status = "active";
        this.notify();
      }
      return;
    }

    if (elapsed >= IDLE_THRESHOLD_MS && !this.idlePopupShown) {
      this.idlePopupShown = true;
      this.status = "idle_popup";
      this.notify();
    }

    if (elapsed >= IDLE_THRESHOLD_MS + AUTO_PAUSE_AFTER_MS && !this.idleAutoPaused) {
      this.idleAutoPaused = true;
      this.status = "idle_auto_paused";
      this.notify();
    }
  }

  private async maybeLogActivity() {
    const elapsed = Date.now() - this.lastLogTime;
    if (elapsed < ACTIVITY_LOG_INTERVAL_MS) return;

    const { useAuthStore } = await import("@/features/auth/store");
    const user = useAuthStore.getState().user;
    if (!user) return;

    const { getDatabase } = await import("@/lib/db");
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO activity_logs (user_id, keyboard_count, mouse_count, idle_seconds)
       VALUES ($1, $2, $3, $4)`,
      [user.id, this.keyboardCount, this.mouseCount,
       Math.floor((Date.now() - this.lastActivity) / 1000)],
    );

    this.keyboardCount = 0;
    this.mouseCount = 0;
    this.lastLogTime = Date.now();
  }

  private notify() {
    const idleMs = this.status === "active" ? 0 : Date.now() - this.lastActivity;
    this.listeners.forEach((fn) => fn(this.status, Math.floor(idleMs / 1000)));
  }

  getIdleStatus(): IdleStatus {
    return this.status;
  }

  resetActivity() {
    this.lastActivity = Date.now();
    this.idlePopupShown = false;
    this.idleAutoPaused = false;
    this.status = "active";
  }
}

export const idleDetector = new IdleDetector();
```

---

### Task 8: Create Timer UI Components

**Files:**
- Create: `src/components/ui/select.tsx` (ShadCN Select)
- Create: `src/components/ui/dialog.tsx` (ShadCN Dialog)
- Create: `src/components/ui/textarea.tsx` (ShadCN Textarea)
- Create: `src/features/timer/components/TimerDashboard.tsx`
- Create: `src/features/timer/components/TimerControls.tsx`
- Create: `src/features/timer/components/IdlePopup.tsx`

- [ ] **Step 1: Install missing ShadCN components**

```bash
npx shadcn@latest add select dialog textarea
```

If CLI unavailable, create them manually from ShadCN registry.

- [ ] **Step 2: Create IdlePopup**

`src/features/timer/components/IdlePopup.tsx`:

```tsx
import { useEffect, useState } from "react";
import { idleDetector } from "@/features/timer/idle-detector";
import { useTimerStore } from "@/features/timer/store";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function IdlePopup() {
  const [visible, setVisible] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const { pauseAllTimers } = useTimerStore();

  useEffect(() => {
    const unsub = idleDetector.subscribe((status, seconds) => {
      setIdleSeconds(seconds);
      if (status === "idle_popup") {
        setVisible(true);
      } else if (status === "idle_auto_paused") {
        pauseAllTimers();
        setVisible(false);
      } else if (status === "active") {
        setVisible(false);
      }
    });
    return unsub;
  }, [pauseAllTimers]);

  const handleStillHere = () => {
    idleDetector.resetActivity();
    setVisible(false);
  };

  const handlePauseAll = () => {
    pauseAllTimers();
    idleDetector.resetActivity();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl p-6 max-w-sm mx-4 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-semibold">Are you still working?</h2>
        <p className="text-sm text-muted-foreground">
          You've been idle for {Math.floor(idleSeconds / 60)} minutes.
          Your timers will be paused automatically if you're away.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handlePauseAll}>
            Pause All
          </Button>
          <Button onClick={handleStillHere}>
            Still Here
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create TimerControls**

`src/features/timer/components/TimerControls.tsx`:

```tsx
import { useState, useEffect } from "react";
import { timerEngine, TimerState } from "@/features/timer/engine";
import { useTimerStore } from "@/features/timer/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Square, Clock } from "lucide-react";

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface TimerControlsProps {
  taskId: number;
  taskTitle: string;
}

export function TimerControls({ taskId, taskTitle }: TimerControlsProps) {
  const { startTimer, pauseTimer, resumeTimer, stopTimer, getTimerState } = useTimerStore();
  const [state, setState] = useState<TimerState | undefined>(getTimerState(taskId));
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = timerEngine.subscribe((timers) => {
      setState(timers.get(taskId));
      setTick((t) => t + 1);
    });
    return unsub;
  }, [taskId]);

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium truncate max-w-[200px]">{taskTitle}</span>
          {state?.status === "running" && (
            <Badge variant="default" className="bg-green-500">Running</Badge>
          )}
          {state?.status === "paused" && (
            <Badge variant="secondary">Paused</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-mono font-bold min-w-[100px] text-right">
            {state ? formatTime(state.totalSeconds) : "00:00:00"}
          </span>
          {!state && (
            <Button size="sm" onClick={() => startTimer(taskId)}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          {state?.status === "running" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => pauseTimer(taskId)}>
                <Pause className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => stopTimer(taskId)}>
                <Square className="h-4 w-4" />
              </Button>
            </>
          )}
          {state?.status === "paused" && (
            <>
              <Button size="sm" onClick={() => resumeTimer(taskId)}>
                <Play className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => stopTimer(taskId)}>
                <Square className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create TimerDashboard**

`src/features/timer/components/TimerDashboard.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useTimerStore } from "@/features/timer/store";
import { useTaskStore } from "@/features/tasks/store";
import { TimerControls } from "@/features/timer/components/TimerControls";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Plus } from "lucide-react";

export function TimerDashboard() {
  const { subscribe, activeTimers, startTimer } = useTimerStore();
  const { tasks, fetchTasks } = useTaskStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  useEffect(() => {
    const unsub = subscribe();
    fetchTasks();
    return unsub;
  }, [subscribe, fetchTasks]);

  const activeTaskIds = new Set(activeTimers.keys());
  const nonTimeredTasks = tasks.filter((t) => !activeTaskIds.has(t.id));

  const handleQuickStart = () => {
    if (!selectedTaskId) return;
    startTimer(parseInt(selectedTaskId));
    setSelectedTaskId("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Timer</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a task..." />
            </SelectTrigger>
            <SelectContent>
              {nonTimeredTasks.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleQuickStart} disabled={!selectedTaskId}>
            <Play className="mr-2 h-4 w-4" /> Start
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">
          Active Timers ({activeTimers.size})
        </h2>
        {activeTimers.size === 0 && (
          <div className="text-center py-12 border rounded-lg">
            <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No active timers.</p>
            <p className="text-sm text-muted-foreground">
              Select a task above and click Start.
            </p>
          </div>
        )}
        {[...activeTimers.entries()].map(([taskId, state]) => {
          const task = tasks.find((t) => t.id === taskId);
          return (
            <TimerControls
              key={taskId}
              taskId={taskId}
              taskTitle={task?.title ?? `Task #${taskId}`}
            />
          );
        })}
      </div>
    </div>
  );
}
```

---

### Task 9: Wire Timer Subscription in App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Initialize timer and idle detector in App**

Update `src/App.tsx`:

```tsx
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { router } from "@/routes";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { useTimerStore } from "@/features/timer/store";
import { idleDetector } from "@/features/timer/idle-detector";
import { IdlePopup } from "@/features/timer/components/IdlePopup";
import { Toaster } from "@/components/ui/sonner";

function AppContent() {
  const checkSession = useAuthStore((state) => state.checkSession);
  const subscribe = useTimerStore((state) => state.subscribe);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    const unsub = subscribe();
    idleDetector.start();
    return () => {
      unsub();
      idleDetector.stop();
    };
  }, [subscribe]);

  return (
    <>
      <RouterProvider router={router} />
      <IdlePopup />
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="timesync-ui-theme">
      <AppContent />
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
```

---

### Task 10: Update Route Pages

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Wire TaskList and TimerDashboard into routes**

Update `src/routes/index.tsx`:

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute, AdminRoute } from "@/features/auth/components/ProtectedRoute";
import { TaskList } from "@/features/tasks/components/TaskList";
import { TimerDashboard } from "@/features/timer/components/TimerDashboard";

function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Dashboard will be built in Sub-project 3.</p>
    </div>
  );
}

function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="text-muted-foreground">Reports will be built in Sub-project 3.</p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Settings will be built in Sub-project 4.</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          {
            path: "tasks",
            element: <TaskList />,
          },
          {
            path: "timer",
            element: <TimerDashboard />,
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
        ],
      },
    ],
  },
  {
    path: "/",
    element: <AdminRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "settings",
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]);
```

---

### Task 11: Build and Verify

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Run Vite build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add task management and time tracking with idle detection"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Tasks CRUD (Task 3-4) ✓, Timer engine (Task 5) ✓, Timer store (Task 6) ✓, Idle detection (Task 7) ✓, Timer UI (Task 8) ✓, Activity logging (Task 7) ✓, Routes (Task 10) ✓
- [x] **No placeholders:** All code complete, no TODOs or vague steps
- [x] **Type consistency:** `TimerState` interface matches between engine.ts and store.ts, Task types from types/index.ts used consistently
- [x] **DB schema consistent:** Migration SQL matches types defined in types/index.ts
