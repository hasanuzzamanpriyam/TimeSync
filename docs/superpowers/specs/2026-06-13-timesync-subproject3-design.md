# TimeSync Sub-project 3: Dashboard & Reports

## Overview

Build the Dashboard and Reports modules for the TimeSync desktop application. Dashboard shows 6 real-time widgets pulling from local SQLite with ERP fallback. Reports provide employee/project views with CSV export and PDF printing.

## Architecture

### Data Flow

Each dashboard widget is an independent hook that:
1. Queries local SQLite via `getDatabase()` on mount
2. Returns `{ data, isLoading, error }` for the UI
3. On mount, also attempts ERP sync if `sync_metadata` indicates online
4. Failed queries do NOT affect other widgets — each handles its own error state

Reports follow the same pattern: hooks query SQLite with optional date/project/user filters.

### Dashboard

```
src/features/dashboard/
├── hooks/
│   ├── useTodayHours.ts
│   ├── useWeeklyHours.ts
│   ├── useActiveTask.ts
│   ├── useCompletedTasks.ts
│   ├── useProductivity.ts
│   └── useAttendanceStatus.ts
├── components/
│   ├── DashboardPage.tsx     ← 3×2 grid layout
│   ├── StatCard.tsx          ← reusable metric card
│   └── ActiveTaskCard.tsx    ← running task + elapsed time
```

#### Database Queries

- **Today's Hours**: `SELECT COALESCE(SUM(total_seconds), 0) FROM time_entries WHERE date(started_at) = date('now') AND user_id = $1`
- **Weekly Hours**: `SELECT COALESCE(SUM(total_seconds), 0) FROM time_entries WHERE started_at >= date('now', 'weekday 1', '-7 days') AND user_id = $1`
- **Active Task**: `SELECT t.* FROM tasks t JOIN time_entries te ON t.id = te.task_id WHERE te.is_running = 1 AND te.user_id = $1 LIMIT 1`
- **Completed Tasks (today)**: `SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND updated_at >= date('now') AND created_by = $1`
- **Productivity %**: `SELECT COALESCE(SUM(CASE WHEN type='work' THEN total_seconds ELSE 0 END) * 100.0 / NULLIF(SUM(total_seconds), 0), 0) FROM time_entries WHERE date(started_at) = date('now') AND user_id = $1`
- **Attendance Status**: Query `time_entries` for today with type='work' to determine checked-in state

### Reports

```
src/features/reports/
├── hooks/
│   ├── useEmployeeReport.ts
│   └── useProjectReport.ts
├── components/
│   ├── ReportsPage.tsx       ← tab navigation
│   ├── EmployeeReport.tsx    ← table with user/task/hours
│   ├── ProjectReport.tsx     ← table with project/task/hours
│   ├── ReportFilters.tsx     ← date range, user/project dropdown
│   └── ReportExport.tsx      ← Print PDF + Download CSV
```

#### Report Queries

- **Employee Report**: `SELECT u.id, u.name, t.title, te.total_seconds, te.started_at FROM time_entries te JOIN tasks t ON te.task_id = t.id JOIN users u ON te.user_id = u.id WHERE te.started_at BETWEEN $1 AND $2 ORDER BY u.name, te.started_at`
- **Project Report**: `SELECT p.name AS project, t.title AS task, te.total_seconds, u.name AS user FROM time_entries te JOIN tasks t ON te.task_id = t.id LEFT JOIN projects p ON t.project_id = p.id JOIN users u ON te.user_id = u.id WHERE te.started_at BETWEEN $1 AND $2 ORDER BY p.name, t.title`

### Export

- **CSV**: Build string manually, create Blob, download via `URL.createObjectURL`
- **PDF**: `window.print()` with `@media print` CSS rules for clean formatting
- Both export buttons respect current date range/project/user filters

### Routes

- `/dashboard` — already exists, swap placeholder for `DashboardPage`
- `/reports` — already exists, swap placeholder for `ReportsPage`
- No sub-routes needed — tabs within the page handle Employee/Project views

### Dependencies

- `date-fns` already installed (from Sub-project 2)

### No New ShadCN Components Needed

`StatCard` uses existing `Card`. `ReportFilters` uses existing `Select`, `Input`. No new ui components required.

### Attendance Status (Placeholder)

Attendance (Check In/Out/Break) is not built in this sub-project. The `useAttendanceStatus` hook returns `null` with a `note: "Attendance module not yet available"`. The `StatCard` shows a disabled state. Full attendance tracking is deferred.

### ERP Fallback (Future)

Each hook checks `sync_metadata` for online status. If online and local data is stale, attempts ERP API call. This is scaffolding only — full ERP sync is Sub-project 4.

### Error Handling

- Each hook catches errors and returns `error` state
- Dashboard widgets show `StatCard` with error state (red indicator + retry)
- Reports show toast notification on failure
- Loading state: skeleton shimmer on each widget independently

## Files to Create/Modify

### New Files (14)
1. `src/features/dashboard/hooks/useTodayHours.ts`
2. `src/features/dashboard/hooks/useWeeklyHours.ts`
3. `src/features/dashboard/hooks/useActiveTask.ts`
4. `src/features/dashboard/hooks/useCompletedTasks.ts`
5. `src/features/dashboard/hooks/useProductivity.ts`
6. `src/features/dashboard/hooks/useAttendanceStatus.ts`
7. `src/features/dashboard/components/StatCard.tsx`
8. `src/features/dashboard/components/ActiveTaskCard.tsx`
9. `src/features/dashboard/components/DashboardPage.tsx`
10. `src/features/reports/hooks/useEmployeeReport.ts`
11. `src/features/reports/hooks/useProjectReport.ts`
12. `src/features/reports/components/ReportFilters.tsx`
13. `src/features/reports/components/ReportExport.tsx`
14. `src/features/reports/components/ReportsPage.tsx`

### Modified Files (1)
15. `src/routes/index.tsx` — swap placeholder pages for real components
