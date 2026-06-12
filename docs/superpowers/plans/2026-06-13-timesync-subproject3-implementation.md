# TimeSync Sub-project 3: Dashboard & Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dashboard (6 live widgets in a 3x2 grid) and Reports (Employee + Project views with CSV/PDF export) using local SQLite with ERP fallback scaffolding.

**Architecture:** Each dashboard widget is an independent hook querying SQLite. Reports use hooks with date/project/user filters. CSV via Blob download, PDF via `window.print()`. No new Zustand stores needed — components call hooks directly.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3, ShadCN UI, date-fns, SQLite via `@tauri-apps/plugin-sql`

---

### Task 1: Create Dashboard Hooks

**Files:**
- Create: `src/features/dashboard/hooks/useTodayHours.ts`
- Create: `src/features/dashboard/hooks/useWeeklyHours.ts`
- Create: `src/features/dashboard/hooks/useActiveTask.ts`
- Create: `src/features/dashboard/hooks/useCompletedTasks.ts`
- Create: `src/features/dashboard/hooks/useProductivity.ts`
- Create: `src/features/dashboard/hooks/useAttendanceStatus.ts`
- Create: `src/features/dashboard/hooks/index.ts`

- [ ] **Step 1: Create `src/features/dashboard/hooks/useTodayHours.ts`**

```ts
import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface UseTodayHoursResult {
  hours: number;
  isLoading: boolean;
  error: string | null;
}

export function useTodayHours(): UseTodayHoursResult {
  const [hours, setHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<{ total: number }[]>(
          `SELECT COALESCE(SUM(total_seconds), 0) as total FROM time_entries WHERE date(started_at) = date('now') AND user_id = $1`,
          [user.id],
        );
        if (!cancelled) {
          setHours(rows[0]?.total ?? 0);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load today's hours");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { hours: Math.round(hours / 3600 * 100) / 100, isLoading, error };
}
```

- [ ] **Step 2: Create `src/features/dashboard/hooks/useWeeklyHours.ts`**

```ts
import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface UseWeeklyHoursResult {
  hours: number;
  isLoading: boolean;
  error: string | null;
}

export function useWeeklyHours(): UseWeeklyHoursResult {
  const [hours, setHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<{ total: number }[]>(
          `SELECT COALESCE(SUM(total_seconds), 0) as total FROM time_entries WHERE started_at >= date('now', 'weekday 1', '-7 days') AND user_id = $1`,
          [user.id],
        );
        if (!cancelled) setHours(rows[0]?.total ?? 0);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load weekly hours");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { hours: Math.round(hours / 3600 * 100) / 100, isLoading, error };
}
```

- [ ] **Step 3: Create `src/features/dashboard/hooks/useActiveTask.ts`**

```ts
import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { Task } from "@/types";
import { useAuthStore } from "@/features/auth/store";

interface UseActiveTaskResult {
  task: Task | null;
  isLoading: boolean;
  error: string | null;
}

export function useActiveTask(): UseActiveTaskResult {
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<Record<string, any>[]>(
          `SELECT t.* FROM tasks t JOIN time_entries te ON t.id = te.task_id WHERE te.is_running = 1 AND te.user_id = $1 LIMIT 1`,
          [user.id],
        );
        if (!cancelled) {
          if (rows.length > 0) {
            const r = rows[0];
            setTask({
              id: r.id,
              title: r.title,
              description: r.description ?? undefined,
              project_id: r.project_id ?? undefined,
              assigned_to: r.assigned_to ?? undefined,
              priority: r.priority,
              status: r.status,
              estimated_minutes: r.estimated_minutes ?? undefined,
              erp_id: r.erp_id ?? undefined,
              created_by: r.created_by ?? undefined,
              created_at: r.created_at,
              updated_at: r.updated_at,
            });
          } else {
            setTask(null);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load active task");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { task, isLoading, error };
}
```

- [ ] **Step 4: Create `src/features/dashboard/hooks/useCompletedTasks.ts`**

```ts
import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface UseCompletedTasksResult {
  count: number;
  isLoading: boolean;
  error: string | null;
}

export function useCompletedTasks(): UseCompletedTasksResult {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<{ total: number }[]>(
          `SELECT COUNT(*) as total FROM tasks WHERE status = 'completed' AND updated_at >= date('now') AND created_by = $1`,
          [user.id],
        );
        if (!cancelled) setCount(rows[0]?.total ?? 0);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load completed tasks");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { count, isLoading, error };
}
```

- [ ] **Step 5: Create `src/features/dashboard/hooks/useProductivity.ts`**

```ts
import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

interface UseProductivityResult {
  percentage: number;
  isLoading: boolean;
  error: string | null;
}

export function useProductivity(): UseProductivityResult {
  const [percentage, setPercentage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<{ pct: number }[]>(
          `SELECT COALESCE(SUM(CASE WHEN type='work' THEN total_seconds ELSE 0 END) * 100.0 / NULLIF(SUM(total_seconds), 0), 0) as pct FROM time_entries WHERE date(started_at) = date('now') AND user_id = $1`,
          [user.id],
        );
        if (!cancelled) setPercentage(Math.round(rows[0]?.pct ?? 0));
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load productivity");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user]);

  return { percentage, isLoading, error };
}
```

- [ ] **Step 6: Create `src/features/dashboard/hooks/useAttendanceStatus.ts`**

```ts
import { useState } from "react";

interface UseAttendanceStatusResult {
  status: "checked_in" | "checked_out" | "on_break" | "unavailable";
  note: string;
  isLoading: boolean;
  error: string | null;
}

export function useAttendanceStatus(): UseAttendanceStatusResult {
  return {
    status: "unavailable",
    note: "Attendance module not yet available",
    isLoading: false,
    error: null,
  };
}
```

- [ ] **Step 7: Create `src/features/dashboard/hooks/index.ts`**

```ts
export { useTodayHours } from "./useTodayHours";
export { useWeeklyHours } from "./useWeeklyHours";
export { useActiveTask } from "./useActiveTask";
export { useCompletedTasks } from "./useCompletedTasks";
export { useProductivity } from "./useProductivity";
export { useAttendanceStatus } from "./useAttendanceStatus";
```

- [ ] **Step 8: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/features/dashboard/hooks/
git commit -m "feat: add dashboard hooks (today, weekly, active, completed, productivity, attendance)"
```

---

### Task 2: Create Dashboard UI Components

**Files:**
- Create: `src/features/dashboard/components/StatCard.tsx`
- Create: `src/features/dashboard/components/ActiveTaskCard.tsx`
- Create: `src/features/dashboard/components/DashboardPage.tsx`

- [ ] **Step 1: Create `src/features/dashboard/components/StatCard.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function StatCard({ title, value, icon, isLoading, error, className }: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        {isLoading ? (
          <div className="mt-2 h-8 w-24 bg-muted animate-pulse rounded" />
        ) : error ? (
          <p className="mt-2 text-sm text-destructive">Error loading</p>
        ) : (
          <p className="mt-2 text-3xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `src/features/dashboard/components/ActiveTaskCard.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types";
import { Play } from "lucide-react";

interface ActiveTaskCardProps {
  task: Task | null;
  isLoading?: boolean;
  error?: string | null;
}

export function ActiveTaskCard({ task, isLoading, error }: ActiveTaskCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">Active Task</p>
        {isLoading ? (
          <div className="mt-2 h-8 w-48 bg-muted animate-pulse rounded" />
        ) : error ? (
          <p className="mt-2 text-sm text-destructive">Error loading</p>
        ) : task ? (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              <p className="text-lg font-semibold truncate">{task.title}</p>
            </div>
            <Badge variant="outline" className="mt-1">{task.priority}</Badge>
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">No active task</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `src/features/dashboard/components/DashboardPage.tsx`**

```tsx
import { useTodayHours, useWeeklyHours, useActiveTask, useCompletedTasks, useProductivity, useAttendanceStatus } from "@/features/dashboard/hooks";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { ActiveTaskCard } from "@/features/dashboard/components/ActiveTaskCard";
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
    </div>
  );
}
```

- [ ] **Step 4: Create directory (if needed)**

Run: `mkdir -p C:\Users\CT\Desktop\Tracker\src\features\dashboard\components`

- [ ] **Step 5: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/features/dashboard/components/
git commit -m "feat: add dashboard UI components (StatCard, ActiveTaskCard, DashboardPage)"
```

---

### Task 3: Create Report Hooks

**Files:**
- Create: `src/features/reports/hooks/useEmployeeReport.ts`
- Create: `src/features/reports/hooks/useProjectReport.ts`
- Create: `src/features/reports/hooks/index.ts`

- [ ] **Step 1: Create `src/features/reports/hooks/useEmployeeReport.ts`**

```ts
import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

export interface EmployeeReportRow {
  user_id: number;
  user_name: string;
  task_title: string;
  total_seconds: number;
  date: string;
}

interface UseEmployeeReportResult {
  rows: EmployeeReportRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEmployeeReport(startDate?: string, endDate?: string): UseEmployeeReportResult {
  const [rows, setRows] = useState<EmployeeReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const fetch = async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const start = startDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const end = endDate ?? new Date().toISOString().split("T")[0];
      const result = await db.select<Record<string, any>[]>(
        `SELECT u.id as user_id, u.name as user_name, t.title as task_title, te.total_seconds, te.started_at as date
         FROM time_entries te JOIN tasks t ON te.task_id = t.id JOIN users u ON te.user_id = u.id
         WHERE te.started_at BETWEEN $1 AND $2 ORDER BY u.name, te.started_at`,
        [start, end],
      );
      setRows(result.map((r) => ({
        user_id: r.user_id,
        user_name: r.user_name,
        task_title: r.task_title,
        total_seconds: r.total_seconds,
        date: r.date,
      })));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load employee report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [user, startDate, endDate]);

  return { rows, isLoading, error, refetch: fetch };
}
```

- [ ] **Step 2: Create `src/features/reports/hooks/useProjectReport.ts`**

```ts
import { useState, useEffect } from "react";
import { getDatabase } from "@/lib/db";
import { useAuthStore } from "@/features/auth/store";

export interface ProjectReportRow {
  project_name: string | null;
  task_title: string;
  user_name: string;
  total_seconds: number;
  date: string;
}

interface UseProjectReportResult {
  rows: ProjectReportRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProjectReport(startDate?: string, endDate?: string): UseProjectReportResult {
  const [rows, setRows] = useState<ProjectReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const fetch = async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const start = startDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const end = endDate ?? new Date().toISOString().split("T")[0];
      const result = await db.select<Record<string, any>[]>(
        `SELECT p.name as project_name, t.title as task_title, u.name as user_name, te.total_seconds, te.started_at as date
         FROM time_entries te JOIN tasks t ON te.task_id = t.id LEFT JOIN projects p ON t.project_id = p.id JOIN users u ON te.user_id = u.id
         WHERE te.started_at BETWEEN $1 AND $2 ORDER BY p.name, t.title`,
        [start, end],
      );
      setRows(result.map((r) => ({
        project_name: r.project_name,
        task_title: r.task_title,
        user_name: r.user_name,
        total_seconds: r.total_seconds,
        date: r.date,
      })));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load project report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [user, startDate, endDate]);

  return { rows, isLoading, error, refetch: fetch };
}
```

- [ ] **Step 3: Create `src/features/reports/hooks/index.ts`**

```ts
export { useEmployeeReport } from "./useEmployeeReport";
export type { EmployeeReportRow } from "./useEmployeeReport";
export { useProjectReport } from "./useProjectReport";
export type { ProjectReportRow } from "./useProjectReport";
```

- [ ] **Step 4: Create directories**

Run: `mkdir -p C:\Users\CT\Desktop\Tracker\src\features\reports\hooks`

- [ ] **Step 5: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/features/reports/hooks/
git commit -m "feat: add report hooks (employee, project)"
```

---

### Task 4: Create Report UI Components

**Files:**
- Create: `src/features/reports/components/ReportFilters.tsx`
- Create: `src/features/reports/components/ReportExport.tsx`
- Create: `src/features/reports/components/EmployeeReport.tsx`
- Create: `src/features/reports/components/ProjectReport.tsx`
- Create: `src/features/reports/components/ReportsPage.tsx`

- [ ] **Step 1: Install missing ShadCN components**

Run: `cd C:\Users\CT\Desktop\Tracker && "n" | npx shadcn@latest add table tabs`
Expected: Both components created under `src/components/ui/`

- [ ] **Step 2: Create `src/features/reports/components/ReportFilters.tsx`**

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportFiltersProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
}

export function ReportFilters({ startDate, endDate, onStartDateChange, onEndDateChange }: ReportFiltersProps) {
  return (
    <div className="flex items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="start">Start Date</Label>
        <Input id="start" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="end">End Date</Label>
        <Input id="end" type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/features/reports/components/ReportExport.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

interface ReportExportProps {
  onPrint: () => void;
  onCsv: () => void;
}

export function ReportExport({ onPrint, onCsv }: ReportExportProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrint}>
        <Printer className="mr-1 h-4 w-4" /> Print PDF
      </Button>
      <Button variant="outline" size="sm" onClick={onCsv}>
        <Download className="mr-1 h-4 w-4" /> Export CSV
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/features/reports/components/EmployeeReport.tsx`**

```tsx
import { EmployeeReportRow } from "@/features/reports/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EmployeeReportProps {
  rows: EmployeeReportRow[];
  isLoading: boolean;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

export function EmployeeReport({ rows, isLoading }: EmployeeReportProps) {
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (rows.length === 0) return <p className="text-muted-foreground">No data for selected period.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Task</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.user_name}</TableCell>
            <TableCell>{r.task_title}</TableCell>
            <TableCell>{formatHours(r.total_seconds)}</TableCell>
            <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Create `src/features/reports/components/ProjectReport.tsx`**

```tsx
import { ProjectReportRow } from "@/features/reports/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProjectReportProps {
  rows: ProjectReportRow[];
  isLoading: boolean;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

export function ProjectReport({ rows, isLoading }: ProjectReportProps) {
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (rows.length === 0) return <p className="text-muted-foreground">No data for selected period.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Task</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.project_name ?? "No Project"}</TableCell>
            <TableCell>{r.task_title}</TableCell>
            <TableCell>{r.user_name}</TableCell>
            <TableCell>{formatHours(r.total_seconds)}</TableCell>
            <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 6: Create `src/features/reports/components/ReportsPage.tsx`**

```tsx
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
```

- [ ] **Step 7: Create directory**

Run: `mkdir -p C:\Users\CT\Desktop\Tracker\src\features\reports\components`

- [ ] **Step 8: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/features/reports/components/ src/components/ui/table.tsx src/components/ui/tabs.tsx
git commit -m "feat: add report UI components (filters, export, employee, project, reports page)"
```

---

### Task 5: Wire Routes + Build

**Files:**
- Modify: `src/routes/index.tsx` — import `DashboardPage` and `ReportsPage`, replace placeholders

- [ ] **Step 1: Update `src/routes/index.tsx`**

Replace the `DashboardPage` function with:
```tsx
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { ReportsPage } from "@/features/reports/components/ReportsPage";
```

Replace the inline `function DashboardPage()` with nothing (remove it). Replace the inline `function ReportsPage()` with nothing (remove it).

Change route elements:
```tsx
{
  path: "dashboard",
  element: <DashboardPage />,
},
...
{
  path: "reports",
  element: <ReportsPage />,
},
```

- [ ] **Step 2: TypeScript check**

Run: `cd C:\Users\CT\Desktop\Tracker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build**

Run: `cd C:\Users\CT\Desktop\Tracker && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
cd C:\Users\CT\Desktop\Tracker
git add src/routes/index.tsx
git commit -m "feat: wire dashboard and reports routes"
```

---

### Task 6: Push to Remote

- [ ] **Step 1: Push**

```bash
cd C:\Users\CT\Desktop\Tracker
git push
```
Expected: All commits pushed to `origin/main`
