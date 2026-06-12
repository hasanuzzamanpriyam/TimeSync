# TimeSync — Sub-project 1: Scaffold + Auth + UI Shell

## Overview

TimeSync is a cross-platform desktop time tracking application built with Tauri v2 + React + TypeScript. This document covers the first sub-project: project scaffold, authentication module, and UI shell.

## Technology Stack

| Layer | Choice |
|---|---|
| Desktop Framework | Tauri v2 |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, ShadCN UI |
| State Management | Zustand |
| Routing | React Router v6 |
| Local Database | `@tauri-apps/plugin-sql` (SQLite) |
| Secure Storage | `@tauri-apps/plugin-store` |
| HTTP Client | Axios (with interceptors) |
| Icons | lucide-react |
| Toasts | sonner |

## Project Structure

```
timesync/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs
│   │   └── db/
│   │       └── migrations/
│   ├── icons/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
├── src/
│   ├── assets/
│   ├── components/
│   │   └── ui/          # ShadCN UI primitives
│   ├── features/
│   │   └── auth/
│   │       ├── components/
│   │       │   ├── LoginPage.tsx
│   │       │   └── ProtectedRoute.tsx
│   │       ├── hooks/
│   │       │   └── useAuth.ts
│   │       └── store.ts
│   ├── lib/
│   │   ├── api.ts        # Axios instance + interceptors
│   │   ├── db.ts         # SQLite connection
│   │   └── utils.ts
│   ├── routes/
│   │   └── index.tsx
│   ├── services/
│   │   ├── api/
│   │   │   └── auth.ts
│   │   └── storage/
│   │       └── secure.ts
│   ├── store/
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── components.json       # ShadCN config
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## Database Schema

```sql
-- Users table mirrors ERP data for offline access
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('employee','manager','admin')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  erp_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Local sessions for token persistence
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  is_remember_me INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tracks sync state per table (prepares for offline)
CREATE TABLE sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL UNIQUE,
  last_synced_at TEXT,
  last_sync_status TEXT DEFAULT 'pending'
);
```

## Authentication Flow

1. User enters username/email + password on `/login`
2. `POST /api/auth/login` → returns `{ access_token, refresh_token, user }`
3. Tokens stored in Tauri secure store (encrypted at rest)
4. User data UPSERTed into local SQLite `users` table
5. Axios interceptor catches 401, auto-refreshes via refresh token, retries
6. `<ProtectedRoute>` checks auth store before rendering children

### Zustand Auth Store

```
State: user, isAuthenticated, isLoading, error
Actions: login(), logout(), refreshToken(), checkSession()
```

## Routes

| Path | Component | Access |
|---|---|---|
| `/login` | LoginPage | Public |
| `/` | Redirect to /dashboard | Protected |
| `/dashboard` | Placeholder | Protected |
| `/tasks` | Placeholder | Protected |
| `/timer` | Placeholder | Protected |
| `/reports` | Placeholder | Protected |
| `/settings` | Placeholder | Admin only |

## UI Shell

```
┌─────────────┬──────────────────────────────────────┐
│  SIDEBAR    │         MAIN CONTENT                  │
│             │                                       │
│  ◎ TimeSync │  [Breadcrumb]  [Notifications]  [👤] │
│             │                                       │
│  ◆ Dashboard│  ┌─────────────────────────────────┐ │
│  ◆ Tasks    │  │                                 │ │
│  ◆ Timer    │  │     <Outlet />                  │ │
│  ◆ Reports  │  │     (React Router)              │ │
│  ◆ Settings │  │                                 │ │
│             │  └─────────────────────────────────┘ │
│  ─────────  │                                       │
│  🌙 Dark    │                                       │
└─────────────┴──────────────────────────────────────┘
```

### Components
- **AppLayout** — Composes Sidebar + TopBar + `<Outlet>`
- **Sidebar** — Collapsible, nav links with active highlighting, role-based visibility
- **TopBar** — Breadcrumb, theme toggle (sun/moon), user avatar + dropdown
- **ThemeProvider** — ShadCN `next-themes` wrapper

### ShadCN Components Installed
Button, Input, Card, DropdownMenu, Avatar, Badge, Separator, Sheet (mobile), Toast, Label, Form

## Spec Self-Review Checklist

- [x] No placeholders or TODOs in spec
- [x] Internal consistency: schema matches auth flow, routes match UI shell, tech stack aligned
- [x] Scope is focused: only scaffold, auth, and UI shell (no task CRUD, timer, etc.)
- [x] No ambiguity: every design decision is explicit (Tauri v2, Zustand, SQLite plugin)
