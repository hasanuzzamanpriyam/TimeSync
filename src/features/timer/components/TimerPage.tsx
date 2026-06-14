import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";
import { useTimerStore } from "@/features/timer/store";
import { TimerInstance } from "@/features/timer/engine";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Square, Monitor, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: number;
  title: string;
}

interface AppUsageRecord {
  app_name: string;
  window_title: string | null;
  total_seconds: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function TimerPage() {
  const { user } = useAuthStore();
  const { startTimer, pauseTimer, resumeTimer, stopTimer } = useTimerStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<TimerInstance | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [sessionApps, setSessionApps] = useState<AppUsageRecord[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [activeTimeEntryId, setActiveTimeEntryId] = useState<number | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<Task[]>(
          "SELECT id, title FROM tasks WHERE status != 'completed' AND status != 'cancelled' ORDER BY created_at DESC",
        );
        setTasks(rows);
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      }
    };
    fetchTasks();
  }, []);

  // Poll for active window info when tracking is active
  useEffect(() => {
    if (!isTracking || !activeTimeEntryId) return;
    const interval = setInterval(async () => {
      try {
        const apps = await invoke<AppUsageRecord[]>("get_app_usage", {
          timeEntryId: activeTimeEntryId,
        });
        setSessionApps(apps);
      } catch (err) {
        console.error("Failed to fetch app usage:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isTracking, activeTimeEntryId]);

  // Tick timer display
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") return;
    const interval = setInterval(() => {
      if (activeTimer.status === "running") {
        setDisplaySeconds(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.status, activeTimer?.taskId]);

  const handleStart = async () => {
    if (!selectedTaskId || !user) return;
    try {
      const timer = await startTimer(selectedTaskId);
      setActiveTimer(timer);
      setDisplaySeconds(0);
      setSessionApps([]);
      setActiveTimeEntryId(timer.timeEntryId);
      await invoke("start_app_tracking", { timeEntryId: timer.timeEntryId });
      setIsTracking(true);
    } catch (err) {
      console.error("Failed to start timer:", err);
    }
  };

  const handlePause = async () => {
    if (!activeTimer) return;
    try {
      await pauseTimer(activeTimer.taskId);
      await invoke("set_idle_state", { idle: true });
      setActiveTimer(prev => prev ? { ...prev, status: "paused" } : null);
    } catch (err) {
      console.error("Failed to pause timer:", err);
    }
  };

  const handleResume = async () => {
    if (!activeTimer) return;
    try {
      await resumeTimer(activeTimer.taskId);
      await invoke("set_idle_state", { idle: false });
      setActiveTimer(prev => prev ? { ...prev, status: "running" } : null);
    } catch (err) {
      console.error("Failed to resume timer:", err);
    }
  };

  const handleStop = async () => {
    if (!activeTimer) return;
    try {
      await invoke("stop_app_tracking");
      await stopTimer(activeTimer.taskId);
      setIsTracking(false);
      setActiveTimer(null);
      setDisplaySeconds(0);
      setActiveTimeEntryId(null);
    } catch (err) {
      console.error("Failed to stop timer:", err);
    }
  };

  const isRunning = activeTimer?.status === "running";
  const isPaused = activeTimer?.status === "paused";

  const maxAppSeconds = Math.max(...sessionApps.map(a => a.total_seconds), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Timer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Time Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Task</label>
                <Select
                  value={selectedTaskId?.toString() ?? ""}
                  onValueChange={(v) => setSelectedTaskId(Number(v))}
                  disabled={isTracking}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id.toString()}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tasks available. Create one on the Tasks page first.
                  </p>
                )}
              </div>

              <div className="flex justify-center py-8">
                <div className="text-center">
                  <div className={cn(
                    "text-6xl font-mono font-bold tabular-nums",
                    isRunning && "text-green-600 dark:text-green-400",
                    isPaused && "text-yellow-600 dark:text-yellow-400",
                    !activeTimer && "text-muted-foreground",
                  )}>
                    {activeTimer ? formatTime(displaySeconds) : "00:00:00"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {isRunning ? "Running" : isPaused ? "Paused" : "Ready"}
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                {!activeTimer && (
                  <Button size="lg" onClick={handleStart} disabled={!selectedTaskId}>
                    <Play className="mr-2 h-5 w-5" /> Start
                  </Button>
                )}
                {isRunning && (
                  <>
                    <Button size="lg" variant="secondary" onClick={handlePause}>
                      <Pause className="mr-2 h-5 w-5" /> Pause
                    </Button>
                    <Button size="lg" variant="destructive" onClick={handleStop}>
                      <Square className="mr-2 h-5 w-5" /> Stop
                    </Button>
                  </>
                )}
                {isPaused && (
                  <>
                    <Button size="lg" onClick={handleResume}>
                      <Play className="mr-2 h-5 w-5" /> Resume
                    </Button>
                    <Button size="lg" variant="destructive" onClick={handleStop}>
                      <Square className="mr-2 h-5 w-5" /> Stop
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {activeTimer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  App Usage — This Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sessionApps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No app data yet. Tracking every 10 seconds...</p>
                ) : (
                  <div className="space-y-3">
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
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Session history coming soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
