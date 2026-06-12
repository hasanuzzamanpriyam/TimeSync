import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { router } from "@/routes";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { Toaster } from "@/components/ui/sonner";

function AppContent() {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return <RouterProvider router={router} />;
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
