import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AppUsageRecord {
  app_name: string;
  window_title: string | null;
  total_seconds: number;
}

interface SessionSummary {
  id: number;
  task_title: string;
  started_at: string;
  stopped_at: string | null;
  total_seconds: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function ActivityPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionApps, setSessionApps] = useState<AppUsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<SessionSummary[]>(
          `SELECT t.id, COALESCE(tk.title, 'Task #' || t.task_id) as task_title,
                  t.started_at, t.stopped_at, t.total_seconds
           FROM time_entries t
           LEFT JOIN tasks tk ON tk.id = t.task_id
           WHERE t.user_id = $1 AND t.stopped_at IS NOT NULL
           ORDER BY t.started_at DESC LIMIT 20`,
          [user.id],
        );
        setSessions(rows);
        if (rows.length > 0) {
          setSelectedSessionId(rows[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [user]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const fetch = async () => {
      try {
        const apps = await invoke<AppUsageRecord[]>("get_app_usage", {
          timeEntryId: selectedSessionId,
        });
        setSessionApps(apps);
      } catch (err) {
        console.error("Failed to fetch app usage:", err);
        setSessionApps([]);
      }
    };
    fetch();
  }, [selectedSessionId]);

  const selected = sessions.find((s) => s.id === selectedSessionId);
  const maxAppSeconds = Math.max(...sessionApps.map((a) => a.total_seconds), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Activity</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No completed timer sessions yet.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/timer")}>
              <Clock className="mr-2 h-4 w-4" /> Start a Timer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Sessions</h2>
            {sessions.map((s) => (
              <Card
                key={s.id}
                className={selectedSessionId === s.id ? "ring-2 ring-primary cursor-pointer" : "cursor-pointer"}
                onClick={() => setSelectedSessionId(s.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{s.task_title}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatTime(s.started_at)} — {s.stopped_at ? formatTime(s.stopped_at) : "now"}
                    <span className="ml-2 font-medium">{formatDuration(s.total_seconds)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-2">
            {selected && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    App Usage — {selected.task_title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sessionApps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No app data recorded for this session.</p>
                  ) : (
                    <div className="space-y-4">
                      {sessionApps.map((app, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium truncate">{app.app_name}</span>
                            <span className="text-muted-foreground shrink-0 ml-2">{formatDuration(app.total_seconds)}</span>
                          </div>
                          {app.window_title && (
                            <p className="text-xs text-muted-foreground truncate">{app.window_title}</p>
                          )}
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(app.total_seconds / maxAppSeconds) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between text-sm font-medium">
                          <span>Total</span>
                          <span>{formatDuration(sessionApps.reduce((a, b) => a + b.total_seconds, 0))}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
