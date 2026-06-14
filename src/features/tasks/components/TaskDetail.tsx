import { useState } from "react";
import { Task } from "@/types";
import { useTaskStore } from "@/features/tasks/store";
import { useTimerStore } from "@/features/timer/store";
import { TaskForm } from "@/features/tasks/components/TaskForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Play, Pause, Square, Pen, Trash2 } from "lucide-react";

interface TaskDetailProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetail({ task, open, onOpenChange }: TaskDetailProps) {
  const { deleteTask } = useTaskStore();
  const { startTimer, pauseTimer, resumeTimer, stopTimer, getTimerState } = useTimerStore();
  const [showEdit, setShowEdit] = useState(false);

  const timerState = getTimerState(task.id);
  const isRunning = timerState?.status === "running";
  const isPaused = timerState?.status === "paused";

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    try {
      await deleteTask(task.id);
      onOpenChange(false);
    } catch (err: any) {
      alert("Failed to delete task: " + (err?.message || err));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {task.title}
              <Badge variant="outline">{task.priority}</Badge>
              <Badge variant="outline">{task.status.replace("_", " ")}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            {task.estimated_minutes && (
              <p className="text-sm">Estimated: {task.estimated_minutes} minutes</p>
            )}
            <div className="flex items-center gap-2">
              {!isRunning && !isPaused && (
                <Button size="sm" onClick={() => startTimer(task.id)}>
                  <Play className="mr-1 h-4 w-4" /> Start
                </Button>
              )}
              {isRunning && (
                <Button size="sm" variant="secondary" onClick={() => pauseTimer(task.id)}>
                  <Pause className="mr-1 h-4 w-4" /> Pause
                </Button>
              )}
              {isPaused && (
                <Button size="sm" onClick={() => resumeTimer(task.id)}>
                  <Play className="mr-1 h-4 w-4" /> Resume
                </Button>
              )}
              {(isRunning || isPaused) && (
                <Button size="sm" variant="destructive" onClick={() => stopTimer(task.id)}>
                  <Square className="mr-1 h-4 w-4" /> Stop
                </Button>
              )}
            </div>
            {timerState && (
              <p className="text-2xl font-mono font-bold">
                {formatSeconds(timerState.totalSeconds)}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pen className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showEdit && (
        <TaskForm
          open={showEdit}
          onOpenChange={setShowEdit}
          editTask={task}
        />
      )}
    </>
  );
}

function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
