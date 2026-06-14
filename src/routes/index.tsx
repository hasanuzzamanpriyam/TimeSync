import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { RegisterPage } from "@/features/auth/components/RegisterPage";
import { ProtectedRoute, AdminRoute } from "@/features/auth/components/ProtectedRoute";
import { TaskList } from "@/features/tasks/components/TaskList";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { ReportsPage } from "@/features/reports/components/ReportsPage";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { TimerPage } from "@/features/timer/components/TimerPage";
import { ActivityPage } from "@/features/activity/components/ActivityPage";
import { TeamPage } from "@/features/teams/components/TeamPage";

function TasksPage() {
  return (
    <div className="space-y-4">
      <TaskList />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
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
          {
            path: "activity",
            element: <ActivityPage />,
          },
          {
            path: "team",
            element: <TeamPage />,
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
            element: <AdminPage />,
          },
        ],
      },
    ],
  },
]);
