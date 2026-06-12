import { useEffect, useState } from "react";
import { useTimerStore } from "@/features/timer/store";
import { TimerInstance } from "@/features/timer/engine";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimerDisplayProps {
  timer: TimerInstance;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TimerDisplay({ timer }: TimerDisplayProps) {
  const { pauseTimer, resumeTimer, stopTimer } = useTimerStore();
  const [display, setDisplay] = useState(timer.totalSeconds);

  useEffect(() => {
    setDisplay(timer.totalSeconds);
  }, [timer.totalSeconds]);

  const isRunning = timer.status === "running";
  const isPaused = timer.status === "paused";

  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">Task #{timer.taskId}</p>
          <p className={cn(
            "text-xl font-mono font-bold tabular-nums",
            isRunning && "text-green-600 dark:text-green-400",
            isPaused && "text-yellow-600 dark:text-yellow-400",
          )}>
            {formatTime(display)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isRunning && (
            <Button size="icon" variant="ghost" onClick={() => pauseTimer(timer.taskId)}>
              <Pause className="h-4 w-4" />
            </Button>
          )}
          {isPaused && (
            <Button size="icon" variant="ghost" onClick={() => resumeTimer(timer.taskId)}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => stopTimer(timer.taskId)}>
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
