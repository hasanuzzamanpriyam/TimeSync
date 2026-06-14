import { useState } from "react";
import { useAuthStore } from "@/features/auth/store";
import { useEmployeeReport, useProjectReport, useAppUsageReport } from "@/features/reports/hooks";
import { ReportFilters } from "@/features/reports/components/ReportFilters";
import { ReportExport } from "@/features/reports/components/ReportExport";
import { EmployeeReport } from "@/features/reports/components/EmployeeReport";
import { ProjectReport } from "@/features/reports/components/ProjectReport";
import { AppUsageReport } from "@/features/reports/components/AppUsageReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function monthStartISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

export function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [activeTab, setActiveTab] = useState("employee");
  const [appUsageUserId, setAppUsageUserId] = useState<string>("");
  const [appFilter, setAppFilter] = useState("");

  const isManagerOrAdmin = user?.role === "manager" || user?.role === "admin";

  const employee = useEmployeeReport(startDate, endDate);
  const project = useProjectReport(startDate, endDate);
const appUsageUserIdResolved = appUsageUserId === "__all__" ? null : appUsageUserId ? parseInt(appUsageUserId) : null;
const appUsage = useAppUsageReport(
    startDate,
    endDate,
    appUsageUserIdResolved ?? (isManagerOrAdmin ? null : user?.id),
    appFilter,
);

  const currentRows = activeTab === "employee" ? employee.rows
    : activeTab === "project" ? project.rows
    : appUsage.rows;

  const handleCsv = () => {
    if (currentRows.length === 0) return;
    if (activeTab === "app-usage") {
      const headers = ["Date", "User", "Application", "Window Title", "Duration (s)"];
      const csvRows = [headers.join(",")];
      for (const r of currentRows) {
        const row = r as any;
        csvRows.push(`"${row.date}","${row.user_name}","${row.app_name}","${(row.window_title ?? "")}","${row.total_seconds}"`);
      }
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `app-usage-report-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const headers = activeTab === "employee"
      ? ["Employee", "Task", "Hours", "Date"]
      : ["Project", "Task", "User", "Hours", "Date"];
    const csvRows = [headers.join(",")];
    for (const r of currentRows) {
      if (activeTab === "employee") {
        const er = r as any;
        csvRows.push(`"${er.user_name}","${er.task_title}",${(er.total_seconds / 3600).toFixed(2)},"${new Date(er.date).toLocaleDateString()}"`);
      } else {
        const pr = r as any;
        csvRows.push(`"${pr.project_name ?? ""}","${pr.task_title}","${pr.user_name}",${(pr.total_seconds / 3600).toFixed(2)},"${new Date(pr.date).toLocaleDateString()}"`);
      }
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reports</h1>
        <ReportExport onPrint={handlePrint} onCsv={handleCsv} />
      </div>

      <ReportFilters startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="employee">Employee Report</TabsTrigger>
          <TabsTrigger value="project">Project Report</TabsTrigger>
          <TabsTrigger value="app-usage">App Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="employee" className="mt-4">
          <EmployeeReport rows={employee.rows} isLoading={employee.isLoading} />
        </TabsContent>
        <TabsContent value="project" className="mt-4">
          <ProjectReport rows={project.rows} isLoading={project.isLoading} />
        </TabsContent>
        <TabsContent value="app-usage" className="mt-4 space-y-4">
          <div className="flex gap-4">
            {isManagerOrAdmin && (
              <div className="flex items-center gap-2">
                <Label htmlFor="user-select">User</Label>
                <Select value={appUsageUserId} onValueChange={setAppUsageUserId}>
                  <SelectTrigger id="user-select" className="w-48">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Users</SelectItem>
                    {employee.rows
                      .filter((r, i, arr) => arr.findIndex((x) => x.user_id === r.user_id) === i)
                      .map((r) => (
                        <SelectItem key={r.user_id} value={String(r.user_id)}>
                          {r.user_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="app-filter">App</Label>
              <Input
                id="app-filter"
                placeholder="Filter by app name..."
                value={appFilter}
                onChange={(e) => setAppFilter(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
          <AppUsageReport rows={appUsage.rows} isLoading={appUsage.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
