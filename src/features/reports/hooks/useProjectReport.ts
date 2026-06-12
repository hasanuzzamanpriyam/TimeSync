import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

export interface ProjectReportRow {
  project_name: string | null;
  task_title: string;
  user_name: string;
  total_seconds: number;
  date: string;
}

interface UseProjectReportResult {
  rows: ProjectReportRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProjectReport(startDate?: string, endDate?: string): UseProjectReportResult {
  const [rows, setRows] = useState<ProjectReportRow[]>([]);
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
        `SELECT p.name as project_name, t.title as task_title, u.name as user_name, te.total_seconds, te.started_at as date
         FROM time_entries te JOIN tasks t ON te.task_id = t.id LEFT JOIN projects p ON t.project_id = p.id JOIN users u ON te.user_id = u.id
         WHERE te.started_at BETWEEN $1 AND $2 ORDER BY p.name, t.title`,
        [start, end],
      );
      setRows(result.map((r) => ({
        project_name: r.project_name,
        task_title: r.task_title,
        user_name: r.user_name,
        total_seconds: r.total_seconds,
        date: r.date,
      })));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load project report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [user, startDate, endDate]);

  return { rows, isLoading, error, refetch: fetch };
}
