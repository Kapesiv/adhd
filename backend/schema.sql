-- Käyttäjäasetukset
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  wake_time TEXT NOT NULL DEFAULT '07:00',
  sleep_hours REAL NOT NULL DEFAULT 7,
  intensity TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Push-ilmoitusten tilaukset
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Iltatoimien suoritushistoria
CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  completed_date TEXT NOT NULL UNIQUE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
