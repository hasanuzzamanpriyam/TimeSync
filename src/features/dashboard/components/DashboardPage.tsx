import { useTodayHours, useWeeklyHours, useActiveTask, useCompletedTasks, useProductivity, useAttendanceStatus } from "@/features/dashboard/hooks";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { ActiveTaskCard } from "@/features/dashboard/components/ActiveTaskCard";
import { AppUsageCard } from "@/features/activity/components/AppUsageCard";
import { Clock, CalendarDays, CheckCircle2, TrendingUp, UserCheck } from "lucide-react";

export function DashboardPage() {
  const today = useTodayHours();
  const weekly = useWeeklyHours();
  const active = useActiveTask();
  const completed = useCompletedTasks();
  const productivity = useProductivity();
  const attendance = useAttendanceStatus();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Today's Hours" value={`${today.hours}h`} icon={<Clock className="h-5 w-5" />} isLoading={today.isLoading} error={today.error} />
        <StatCard title="Weekly Hours" value={`${weekly.hours}h`} icon={<CalendarDays className="h-5 w-5" />} isLoading={weekly.isLoading} error={weekly.error} />
        <ActiveTaskCard task={active.task} isLoading={active.isLoading} error={active.error} />
        <StatCard title="Completed Today" value={completed.count} icon={<CheckCircle2 className="h-5 w-5" />} isLoading={completed.isLoading} error={completed.error} />
        <StatCard title="Productivity" value={`${productivity.percentage}%`} icon={<TrendingUp className="h-5 w-5" />} isLoading={productivity.isLoading} error={productivity.error} />
        <StatCard title="Attendance" value={attendance.status === "unavailable" ? "N/A" : attendance.status.replace("_", " ")} icon={<UserCheck className="h-5 w-5" />} isLoading={attendance.isLoading} error={attendance.error} />
      </div>
      <AppUsageCard />
    </div>
  );
}
