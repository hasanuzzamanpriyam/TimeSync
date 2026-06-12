import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute, AdminRoute } from "@/features/auth/components/ProtectedRoute";

function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Dashboard will be built in Sub-project 3.</p>
    </div>
  );
}

function TasksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Tasks</h1>
      <p className="text-muted-foreground">Task management will be built in Sub-project 2.</p>
    </div>
  );
}

function TimerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Timer</h1>
      <p className="text-muted-foreground">Time tracking will be built in Sub-project 2.</p>
    </div>
  );
}

function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="text-muted-foreground">Reports will be built in Sub-project 3.</p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Settings will be built in Sub-project 4.</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          {
            path: "tasks",
            element: <TasksPage />,
          },
          {
            path: "timer",
            element: <TimerPage />,
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
        ],
      },
    ],
  },
  {
    path: "/",
    element: <AdminRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "settings",
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]);
