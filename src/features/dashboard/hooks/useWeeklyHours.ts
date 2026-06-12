import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface UseWeeklyHoursResult {
  hours: number;
  isLoading: boolean;
  error: string | null;
}

export function useWeeklyHours(): UseWeeklyHoursResult {
  const [hours, setHours] = useState(0);
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
          `SELECT COALESCE(SUM(total_seconds), 0) as total FROM time_entries WHERE started_at >= date('now', 'weekday 1', '-7 days') AND user_id = $1`,
          [user.id],
        );
        if (!cancelled) setHours(rows[0]?.total ?? 0);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load weekly hours");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { hours: Math.round(hours / 3600 * 100) / 100, isLoading, error };
}
