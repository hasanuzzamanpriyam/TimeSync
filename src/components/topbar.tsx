import { useState, useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sun,
  Moon,
  LogOut,
  User,
  Bell,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useActivityStore } from "@/features/activity/store";
import { invoke } from "@tauri-apps/api/core";

export function TopBar() {
  const { user, logout, authMode, loginTimestamp } = useAuthStore();
  const { isTrackingPaused, setPaused } = useActivityStore();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!loginTimestamp) {
      setElapsed("");
      return;
    }
    const tick = () => {
      const diff = Date.now() - loginTimestamp;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) { setElapsed("<1m"); return; }
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [loginTimestamp]);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">TimeSync</span>
        {user && (
          <>
            <span className="text-sm text-muted-foreground">|</span>
            <span className="text-sm">{user.full_name}</span>
            <span className="text-xs text-muted-foreground capitalize">({user.role})</span>
            {elapsed && (
              <>
                <span className="text-sm text-muted-foreground">|</span>
                <span className="text-sm text-muted-foreground">{elapsed}</span>
              </>
            )}
          </>
        )}
        <Badge
          variant={authMode === "demo" ? "secondary" : authMode === "erp" ? "default" : "outline"}
          className="text-[10px] px-1.5 py-0 h-5"
        >
          {authMode === "demo" ? "Demo" : authMode === "erp" ? "ERP" : "Auto"}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            const next = !isTrackingPaused;
            await invoke("set_idle_state", { idle: next });
            setPaused(next);
          }}
          aria-label={isTrackingPaused ? "Resume app tracking" : "Pause app tracking"}
        >
          {isTrackingPaused ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.full_name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {user?.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
