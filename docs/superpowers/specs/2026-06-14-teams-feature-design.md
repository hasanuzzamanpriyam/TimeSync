# Teams Feature Design

## Overview
Admin creates teams, assigns managers, and managers oversee their team members' tasks and time entries.

## Schema

### Migration 6: teams & team_members
```sql
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_manager INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(team_id, user_id)
);
```

## Roles & Permissions
- **Admin** — full CRUD on teams, add/remove members, toggle manager status
- **Manager** (is_manager=1 for a team) — view team's members, tasks, time entries; assign tasks
- **Employee** — no team management, sees own work

## Backend (Rust Tauri Commands)
New commands in lib.rs:
- `create_team(name, description)` → team
- `update_team(id, name, description)` → team
- `delete_team(id)` → void
- `get_teams()` → team[]
- `get_team_members(team_id)` → member[]
- `add_team_member(team_id, user_id, is_manager)` → void
- `remove_team_member(team_id, user_id)` → void
- `set_team_manager(team_id, user_id, is_manager)` → void
- `get_managed_teams(user_id)` → team[] (teams where user is manager)

## Frontend

### Admin (new "Teams" tab in /settings)
- Table of teams with create/edit/delete
- Click team → expand drawer/dialog showing members
- Member list with add/remove and manager toggle

### Manager (new /team route)
- Shows teams where user is manager
- For each team: member list, member tasks, member time entries
- Can assign tasks to team members (reuse TaskForm with team filter)

### Navigation
- Sidebar: "Team" nav item (visible to manager, admin)
- Route: `/team` → TeamPage (protected, managers+admin)

### Reuse existing patterns
- Zustand store: `src/features/teams/store.ts`
- shadcn Table, Dialog, Select, Button, Input components
- Existing task form patterns for task assignment
