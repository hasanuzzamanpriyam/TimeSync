import { useAppUsage } from "@/features/activity/hooks/useAppUsage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor } from "lucide-react";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export function AppUsageCard() {
  const { apps, isLoading, error } = useAppUsage();

  const topApps = apps.slice(0, 5);
  const maxSeconds = Math.max(...topApps.map((a) => a.total_seconds), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          Top Apps Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : topApps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No app data yet today.</p>
        ) : (
          <div className="space-y-3">
            {topApps.map((app, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{app.app_name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {formatDuration(app.total_seconds)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(app.total_seconds / maxSeconds) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
