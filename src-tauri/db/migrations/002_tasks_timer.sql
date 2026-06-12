CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  erp_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE TABLE IF NOT EXISTS time_entries (
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

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  keyboard_count INTEGER DEFAULT 0,
  mouse_count INTEGER DEFAULT 0,
  idle_seconds INTEGER DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now'))
);
