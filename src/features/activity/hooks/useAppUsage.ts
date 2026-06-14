import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "@/features/auth/store";

interface AppUsageRecord {
  app_name: string;
  window_title: string | null;
  total_seconds: number;
}

export function useAppUsage() {
  const [apps, setApps] = useState<AppUsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetch = async () => {
      try {
        const result = await invoke<AppUsageRecord[]>("get_today_app_usage", {
          userId: user.id,
        });
        if (!cancelled) {
          setApps(result);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load app usage");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  return { apps, isLoading, error };
}
