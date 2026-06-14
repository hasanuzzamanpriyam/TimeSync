import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface AppUsageReportRow {
  date: string;
  user_id: number;
  user_name: string;
  app_name: string;
  window_title: string | null;
  total_seconds: number;
}

interface UseAppUsageReportResult {
  rows: AppUsageReportRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAppUsageReport(
  startDate?: string,
  endDate?: string,
  userId?: number | null,
  appFilter?: string,
): UseAppUsageReportResult {
  const [rows, setRows] = useState<AppUsageReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<AppUsageReportRow[]>("get_app_usage_report", {
        user_id: userId ?? null,
        startDate: startDate ?? new Date().toISOString().split("T")[0],
        endDate: endDate ?? new Date().toISOString().split("T")[0],
        appFilter: appFilter && appFilter.trim() ? appFilter.trim() : null,
      });
      setRows(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load app usage report");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, userId, appFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rows, isLoading, error, refetch: fetch };
}
