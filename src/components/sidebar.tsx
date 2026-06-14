import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store";
import {
  LayoutDashboard,
  ListChecks,
  Timer,
  BarChart3,
  Settings,
  ChevronLeft,
  Clock,
  Monitor,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "manager", "admin"] as const },
  { to: "/tasks", label: "Tasks", icon: ListChecks, roles: ["employee", "manager", "admin"] as const },
  { to: "/timer", label: "Timer", icon: Timer, roles: ["employee", "manager", "admin"] as const },
  { to: "/activity", label: "Activity", icon: Monitor, roles: ["employee", "manager", "admin"] as const },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["employee", "manager", "admin"] as const },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] as const },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();

  const visibleItems = navItems.filter(
    (item) => user && (item.roles as readonly string[]).includes(user.role),
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Clock className="h-6 w-6 shrink-0 text-sidebar-primary" />
        {!collapsed && (
          <span className="font-semibold text-sidebar-primary">
            TimeSync
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn(
              "h-5 w-5 transition-transform",
              collapsed && "rotate-180",
            )}
          />
        </Button>
      </div>
    </aside>
  );
}
