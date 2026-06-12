import { useEffect, useState } from "react";
import { useTimerStore } from "@/features/timer/store";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";

export function IdlePopup() {
  const { showIdlePopup, dismissIdlePopup } = useTimerStore();
  const [countdown, setCountdown] = useState(120);

  useEffect(() => {
    if (!showIdlePopup) {
      setCountdown(120);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showIdlePopup]);

  return (
    <AlertDialog open={showIdlePopup} onOpenChange={(open) => { if (!open) dismissIdlePopup(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still working?</AlertDialogTitle>
          <AlertDialogDescription>
            You have been idle for a while. Your timers will be paused in {countdown} seconds if you don't respond.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={dismissIdlePopup}>
            I'm here — resume
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
