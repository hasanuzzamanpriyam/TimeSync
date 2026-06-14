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
        "SELECT * FROM tasks WHERE status != 'cancelled' ORDER BY created_at DESC",
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
      id: result.lastInsertId!,
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
    await db.execute("UPDATE tasks SET status = 'cancelled' WHERE id = $1", [id]);
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
