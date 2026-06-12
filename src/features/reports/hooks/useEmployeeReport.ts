import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

export interface EmployeeReportRow {
  user_id: number;
  user_name: string;
  task_title: string;
  total_seconds: number;
  date: string;
}

interface UseEmployeeReportResult {
  rows: EmployeeReportRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEmployeeReport(startDate?: string, endDate?: string): UseEmployeeReportResult {
  const [rows, setRows] = useState<EmployeeReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const fetch = async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const start = startDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const end = endDate ?? new Date().toISOString().split("T")[0];
      const result = await db.select<Record<string, any>[]>(
        `SELECT u.id as user_id, u.name as user_name, t.title as task_title, te.total_seconds, te.started_at as date
         FROM time_entries te JOIN tasks t ON te.task_id = t.id JOIN users u ON te.user_id = u.id
         WHERE te.started_at BETWEEN $1 AND $2 ORDER BY u.name, te.started_at`,
        [start, end],
      );
      setRows(result.map((r) => ({
        user_id: r.user_id,
        user_name: r.user_name,
        task_title: r.task_title,
        total_seconds: r.total_seconds,
        date: r.date,
      })));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load employee report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [user, startDate, endDate]);

  return { rows, isLoading, error, refetch: fetch };
}
