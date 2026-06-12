# TimeSync — Sub-project 2: Task & Time Tracking

## Overview

Task management (CRUD, assign, prioritize) and time tracking (parallel timers, idle detection, activity logging, break tracking) with offline-first SQLite storage.

## Tech Stack Additions

- `date-fns` — date/time formatting and arithmetic
- `@tauri-apps/plugin-shell` (optional) — for native idle detection fallback

## Database Schema (new tables)

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  erp_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES projects(id),
  assigned_to INTEGER REFERENCES users(id),
  priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','on_hold','completed','cancelled')),
  estimated_minutes INTEGER,
  erp_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'work' CHECK(type IN ('work','break')),
  started_at TEXT NOT NULL,
  paused_at TEXT,
  resumed_at TEXT,
  stopped_at TEXT,
  total_seconds INTEGER DEFAULT 0,
  is_running INTEGER DEFAULT 0,
  erp_synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  keyboard_count INTEGER DEFAULT 0,
  mouse_count INTEGER DEFAULT 0,
  idle_seconds INTEGER DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now'))
);
```

## Timer Engine

```
TimerEngine class:
  - timers: Map<number, TimerState>
  - tick interval: 1000ms
  - start(taskId, type) → creates time_entry
  - pause(taskId) → saves elapsed, marks paused
  - resume(taskId) → creates new time_entry or resumes existing
  - stop(taskId) → finalizes time_entry
  - getElapsed(taskId) → totalSeconds + (now - lastResumeOrStart)

TimerState = { taskId, startedAt, pausedAt, totalSeconds, status, type }
```

## Idle Detection

```
IdleDetector service:
  - Listens: mousemove, keydown, mousedown, click, scroll
  - After 5 min idle → show modal popup: "Still working?" + [Still Here] / [Pause All]
  - After 7 min idle (2 min after popup) → auto-pause ALL timers
  - Logs keyboard_count and mouse_count per 5-min interval to activity_logs
  - On resume from idle → log idle seconds
```

## Task Management

- **TaskList** — table with columns: title, project, priority, status, assignee, estimated, timer action
- **TaskCard** — compact card used in timer and dashboard views
- **TaskForm** — modal dialog for create/edit (title, description, project, priority, assignee, estimated hours)
- **TaskDetail** — full view with inline timer controls, activity log
- **Filters** — by status, priority, project — persisted in URL search params
- **Offline CRUD** — tasks created offline get local_id; synced when online

## Features (file structure)

```
src/features/tasks/
├── components/
│   ├── TaskList.tsx
│   ├── TaskCard.tsx
│   ├── TaskForm.tsx
│   └── TaskDetail.tsx
├── store.ts

src/features/timer/
├── components/
│   ├── TimerDashboard.tsx
│   ├── TimerControls.tsx
│   └── IdlePopup.tsx
├── engine.ts        ← TimerEngine class
├── idle-detector.ts ← IdleDetector service
├── store.ts

src/features/activity/
├── store.ts
└── activity-logger.ts
```

## Cross-Platform Notes

- Idle detection uses DOM events (`mousemove`, `keydown`) which work on Windows, macOS, Linux
- Activity counting uses the same DOM events
- For OS-level idle detection in the future, a Tauri plugin or Rust crate can supplement DOM detection
- SQLite is cross-platform by design (bundled with Tauri)
- Timer accuracy uses `Date.now()` timestamps — consistent across all platforms

## Spec Self-Review Checklist

- [x] No placeholders or TODOs
- [x] Schema matches component needs (tasks → time_entries → activity_logs)
- [x] Timer engine design consistent: start/pause/resume/stop all covered
- [x] Idle detection covers popup → auto-pause → logging
- [x] Scope focused: only tasks + timer + activity (no dashboard, reports, or ERP sync yet)
- [x] Cross-platform approach documented
