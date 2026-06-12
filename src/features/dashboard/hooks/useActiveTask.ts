import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { Task } from "@/types";
import { useAuthStore } from "@/features/auth/store";

interface UseActiveTaskResult {
  task: Task | null;
  isLoading: boolean;
  error: string | null;
}

export function useActiveTask(): UseActiveTaskResult {
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<Record<string, any>[]>(
          `SELECT t.* FROM tasks t JOIN time_entries te ON t.id = te.task_id WHERE te.is_running = 1 AND te.user_id = $1 LIMIT 1`,
          [user.id],
        );
        if (!cancelled) {
          if (rows.length > 0) {
            const r = rows[0];
            setTask({
              id: r.id,
              title: r.title,
              description: r.description ?? undefined,
              project_id: r.project_id ?? undefined,
              assigned_to: r.assigned_to ?? undefined,
              priority: r.priority,
              status: r.status,
              estimated_minutes: r.estimated_minutes ?? undefined,
              erp_id: r.erp_id ?? undefined,
              created_by: r.created_by ?? undefined,
              created_at: r.created_at,
              updated_at: r.updated_at,
            });
          } else {
            setTask(null);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load active task");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { task, isLoading, error };
}
