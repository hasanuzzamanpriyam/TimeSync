import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { router } from "@/routes";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { useTimerStore } from "@/features/timer/store";
import { TimerBar } from "@/features/timer/components/TimerBar";
import { IdlePopup } from "@/features/timer/components/IdlePopup";
import { Toaster } from "@/components/ui/sonner";
import { syncManager } from "@/services/sync";

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

  useEffect(() => {
    const initSync = async () => {
      const stored = await (await import("@/services/storage/secure")).secureStorage.get("erp_sync_interval");
      const interval = (stored as number) ?? 5;
      syncManager.start(interval * 60 * 1000);
    };
    initSync();
    return () => syncManager.stop();
  }, []);

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
