import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface UseCompletedTasksResult {
  count: number;
  isLoading: boolean;
  error: string | null;
}

export function useCompletedTasks(): UseCompletedTasksResult {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<{ total: number }[]>(
          `SELECT COUNT(*) as total FROM tasks WHERE status = 'completed' AND updated_at >= date('now') AND created_by = $1`,
          [user.id],
        );
        if (!cancelled) setCount(rows[0]?.total ?? 0);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load completed tasks");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { count, isLoading, error };
}
