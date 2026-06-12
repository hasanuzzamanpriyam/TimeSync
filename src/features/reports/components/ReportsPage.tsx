import { useState } from "react";
import { useEmployeeReport, useProjectReport } from "@/features/reports/hooks";
import { ReportFilters } from "@/features/reports/components/ReportFilters";
import { ReportExport } from "@/features/reports/components/ReportExport";
import { EmployeeReport } from "@/features/reports/components/EmployeeReport";
import { ProjectReport } from "@/features/reports/components/ProjectReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function monthStartISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

export function ReportsPage() {
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [activeTab, setActiveTab] = useState("employee");

  const employee = useEmployeeReport(startDate, endDate);
  const project = useProjectReport(startDate, endDate);

  const currentRows = activeTab === "employee" ? employee.rows : project.rows;

  const handleCsv = () => {
    if (currentRows.length === 0) return;
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
        </TabsList>
        <TabsContent value="employee" className="mt-4">
          <EmployeeReport rows={employee.rows} isLoading={employee.isLoading} />
        </TabsContent>
        <TabsContent value="project" className="mt-4">
          <ProjectReport rows={project.rows} isLoading={project.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
