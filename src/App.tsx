import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { router } from "@/routes";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { useTimerStore } from "@/features/timer/store";
import { TimerBar } from "@/features/timer/components/TimerBar";
import { IdlePopup } from "@/features/timer/components/IdlePopup";
import { Toaster } from "@/components/ui/sonner";

function AppContent() {
  const checkSession = useAuthStore((state) => state.checkSession);
  const initTimer = useTimerStore((state) => state.init);
  const destroyTimer = useTimerStore((state) => state.destroy);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    initTimer();
    return () => destroyTimer();
  }, [initTimer, destroyTimer]);

  return (
    <>
      <RouterProvider router={router} />
      <TimerBar />
      <IdlePopup />
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="timesync-ui-theme">
      <AppContent />
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
