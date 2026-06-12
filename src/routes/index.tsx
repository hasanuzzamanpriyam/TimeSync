import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute, AdminRoute } from "@/features/auth/components/ProtectedRoute";
import { TaskList } from "@/features/tasks/components/TaskList";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { ReportsPage } from "@/features/reports/components/ReportsPage";

function TasksPage() {
  return (
    <div className="space-y-4">
      <TaskList />
    </div>
  );
}

function TimerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Timer</h1>
      <p className="text-muted-foreground">Time tracking UI coming soon.</p>
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
