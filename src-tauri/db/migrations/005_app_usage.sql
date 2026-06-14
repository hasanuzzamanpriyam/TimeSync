CREATE TABLE IF NOT EXISTS app_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time_entry_id INTEGER NOT NULL REFERENCES time_entries(id),
  app_name TEXT NOT NULL,
  window_title TEXT,
  duration_seconds INTEGER DEFAULT 10,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_usage_time_entry ON app_usage(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_app_usage_recorded_at ON app_usage(recorded_at);
