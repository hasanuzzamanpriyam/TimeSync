import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface UseProductivityResult {
  percentage: number;
  isLoading: boolean;
  error: string | null;
}

export function useProductivity(): UseProductivityResult {
  const [percentage, setPercentage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<{ pct: number }[]>(
          `SELECT COALESCE(SUM(CASE WHEN type='work' THEN total_seconds ELSE 0 END) * 100.0 / NULLIF(SUM(total_seconds), 0), 0) as pct FROM time_entries WHERE date(started_at) = date('now') AND user_id = $1`,
          [user.id],
        );
        if (!cancelled) setPercentage(Math.round(rows[0]?.pct ?? 0));
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load productivity");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { percentage, isLoading, error };
}
