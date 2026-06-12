import { useTimerStore } from "@/features/timer/store";
import { TimerDisplay } from "@/features/timer/components/TimerDisplay";
import { cn } from "@/lib/utils";

export function TimerBar() {
  const timers = useTimerStore((s) => s.timers);

  if (timers.length === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-2",
      "flex items-center gap-2 overflow-x-auto",
    )}>
      {timers.map((timer) => (
        <div key={timer.taskId} className="min-w-[280px]">
          <TimerDisplay timer={timer} />
        </div>
      ))}
    </div>
  );
}
